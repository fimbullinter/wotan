import { Linter } from './linter';
import {
    LintResult,
    FileSummary,
    Configuration,
    AbstractProcessor,
    DirectoryService,
    ConfigurationError,
    MessageHandler,
} from '@fimbul/ymir';
import * as path from 'path';
import * as ts from 'typescript';
import * as glob from 'glob';
import { unixifyPath, hasSupportedExtension, mapDefined, addUnique, flatMap } from './utils';
import { Minimatch, IMinimatch } from 'minimatch';
import { ProcessorLoader } from './services/processor-loader';
import { injectable } from 'inversify';
import { CachedFileSystem, FileKind } from './services/cached-file-system';
import { ConfigurationManager } from './services/configuration-manager';
import { ProjectHost } from './project-host';
import debug = require('debug');
import { normalizeGlob } from 'normalize-glob';

const log = debug('wotan:runner');

export interface LintOptions {
    config: string | undefined;
    files: ReadonlyArray<string>;
    exclude: ReadonlyArray<string>;
    project: ReadonlyArray<string>;
    references: boolean;
    fix: boolean | number;
    extensions: ReadonlyArray<string> | undefined;
}

interface NormalizedOptions extends Pick<LintOptions, Exclude<keyof LintOptions, 'files'>> {
    files: ReadonlyArray<NormalizedGlob>;
}

interface NormalizedGlob {
    hasMagic: boolean;
    normalized: string[];
}

@injectable()
export class Runner {
    constructor(
        private fs: CachedFileSystem,
        private configManager: ConfigurationManager,
        private linter: Linter,
        private processorLoader: ProcessorLoader,
        private directories: DirectoryService,
        private logger: MessageHandler,
    ) {}

    public lintCollection(options: LintOptions): LintResult {
        const config = options.config !== undefined ? this.configManager.loadLocalOrResolved(options.config) : undefined;
        const cwd = this.directories.getCurrentDirectory();
        const files = options.files.map(
            (pattern) => ({hasMagic: glob.hasMagic(pattern), normalized: Array.from(normalizeGlob(pattern, cwd))}),
        );
        const exclude = flatMap(options.exclude, (pattern) => normalizeGlob(pattern, cwd));
        if (options.project.length === 0 && options.files.length !== 0)
            return this.lintFiles({...options, files, exclude}, config);

        return this.lintProject({...options, files, exclude}, config);
    }

    private *lintProject(options: NormalizedOptions, config: Configuration | undefined): LintResult {
        const processorHost = new ProjectHost(
            this.directories.getCurrentDirectory(),
            config,
            this.fs,
            this.configManager,
            this.processorLoader,
        );
        for (let {files, program} of
            this.getFilesAndProgram(options.project, options.files, options.exclude, processorHost, options.references)
        ) {
            for (const file of files) {
                if (!hasSupportedExtension(file))
                    continue;
                if (options.config === undefined)
                    config = this.configManager.find(file);
                const mapped = processorHost.getProcessedFileInfo(file);
                const originalName = mapped === undefined ? file : mapped.originalName;
                const effectiveConfig = config && this.configManager.reduce(config, originalName);
                if (effectiveConfig === undefined)
                    continue;
                let sourceFile = program.getSourceFile(file)!;
                const originalContent = mapped === undefined ? sourceFile.text : mapped.originalContent;
                let summary: FileSummary;
                const fix = shouldFix(sourceFile, options, originalName);
                if (fix) {
                    summary = this.linter.lintAndFix(
                        sourceFile,
                        originalContent,
                        effectiveConfig,
                        (content, range) => {
                            ({sourceFile, program} = processorHost.updateSourceFile(sourceFile, program, content, range));
                            return {program, file: sourceFile};
                        },
                        fix === true ? undefined : fix,
                        program,
                        mapped === undefined ? undefined : mapped.processor,
                    );
                } else {
                    summary = {
                        failures: this.linter.getFailures(
                            sourceFile,
                            effectiveConfig,
                            program,
                            mapped === undefined ? undefined : mapped.processor,
                        ),
                        fixes: 0,
                        content: originalContent,
                    };
                }
                yield [originalName, summary];
            }
        }
    }

    private *lintFiles(options: NormalizedOptions, config: Configuration | undefined): LintResult {
        let processor: AbstractProcessor | undefined;
        for (const file of getFiles(options.files, options.exclude, this.directories.getCurrentDirectory())) {
            if (options.config === undefined)
                config = this.configManager.find(file);
            const effectiveConfig = config && this.configManager.reduce(config, file);
            if (effectiveConfig === undefined)
                continue;
            let originalContent: string | undefined;
            let name: string;
            let content: string;
            if (effectiveConfig.processor) {
                const ctor = this.processorLoader.loadProcessor(effectiveConfig.processor);
                if (hasSupportedExtension(file, options.extensions)) {
                    name = file;
                } else {
                    name = file + ctor.getSuffixForFile({
                        fileName: file,
                        getSettings: () => effectiveConfig.settings,
                        readFile: () => originalContent = this.fs.readFile(file),
                    });
                    if (!hasSupportedExtension(name, options.extensions))
                        continue;
                }
                if (originalContent === undefined) // might be initialized by the processor requesting the file content
                    originalContent = this.fs.readFile(file);
                processor = new ctor({
                    source: originalContent,
                    sourceFileName: file,
                    targetFileName: name,
                    settings: effectiveConfig.settings,
                });
                content = processor.preprocess();
            } else if (hasSupportedExtension(file, options.extensions)) {
                processor = undefined;
                name = file;
                content = originalContent = this.fs.readFile(file);
            } else {
                continue;
            }

            let sourceFile = ts.createSourceFile(name, content, ts.ScriptTarget.ESNext, true);
            const fix = shouldFix(sourceFile, options, file);
            let summary: FileSummary;
            if (fix) {
                summary = this.linter.lintAndFix(
                    sourceFile,
                    originalContent,
                    effectiveConfig,
                    (newContent, range) => {
                        sourceFile = ts.updateSourceFile(sourceFile, newContent, range);
                        return {file: sourceFile};
                    },
                    fix === true ? undefined : fix,
                    undefined,
                    processor,
                );
            } else {
                summary = {
                    failures: this.linter.getFailures(
                        sourceFile,
                        effectiveConfig,
                        undefined,
                        processor,
                    ),
                    fixes: 0,
                    content: originalContent,
                };
            }
            yield [file, summary];
        }
    }

    private* getFilesAndProgram(
        projects: ReadonlyArray<string>,
        patterns: ReadonlyArray<NormalizedGlob>,
        exclude: ReadonlyArray<string>,
        host: ProjectHost,
        references: boolean,
    ): Iterable<{files: Iterable<string>, program: ts.Program}> {
        const cwd = unixifyPath(this.directories.getCurrentDirectory());
        if (projects.length !== 0) {
            projects = projects.map((configFile) => this.checkConfigDirectory(unixifyPath(path.resolve(cwd, configFile))));
        } else if (references) {
            projects = [this.checkConfigDirectory(cwd)];
        } else {
            const project = ts.findConfigFile(cwd, (f) => this.fs.isFile(f));
            if (project === undefined)
                throw new ConfigurationError(`Cannot find tsconfig.json for directory '${cwd}'.`);
            projects = [project];
        }

        const allMatchedFiles: string [] = [];
        const include: IMinimatch[] = [];
        const nonMagicGlobs = [];
        for (const pattern of patterns) {
            if (!pattern.hasMagic)
                nonMagicGlobs.push(pattern.normalized[0]);
            include.push(...pattern.normalized.map((p) => new Minimatch(p)));
        }
        const ex = exclude.map((p) => new Minimatch(p, {dot: true}));
        const projectsSeen: string[] = [];
        let filesOfPreviousProject: string[] | undefined;
        for (const program of this.createPrograms(projects, host, projectsSeen, references, isFileIncluded)) {
            const ownFiles = [];
            const options = program.getCompilerOptions();
            const files: string[] = [];
            const libDirectory = unixifyPath(path.dirname(ts.getDefaultLibFilePath(options))) + '/';
            const typeRoots = ts.getEffectiveTypeRoots(options, host) || [];
            const rootFileNames = program.getRootFileNames();
            const outputsOfReferencedProjects = getOutputsOfProjectReferences(program, host);

            for (const sourceFile of program.getSourceFiles()) {
                const {fileName} = sourceFile;
                if (
                    options.composite && !rootFileNames.includes(fileName) || // composite projects need to specify all files as rootFiles
                    program.isSourceFileFromExternalLibrary(sourceFile) ||
                    fileName.endsWith('.d.ts') && (
                        fileName.startsWith(libDirectory) || // lib.xxx.d.ts
                        // tslib implicitly gets added while linting a project where a dependency in node_modules contains typescript files
                        fileName.endsWith('/node_modules/tslib/tslib.d.ts') ||
                        outputsOfReferencedProjects.includes(fileName) ||
                        typeRoots.some((typeRoot) => !path.relative(typeRoot, fileName).startsWith('..' + path.sep))
                    )
                )
                    continue;
                ownFiles.push(fileName);
                const originalName = host.getFileSystemFile(fileName)!;
                if (!isFileIncluded(originalName))
                    continue;
                files.push(fileName);
                allMatchedFiles.push(originalName);
            }
            // uncache all files of the previous project if they are no longer needed
            if (filesOfPreviousProject !== undefined)
                for (const oldFile of filesOfPreviousProject)
                    if (!ownFiles.includes(oldFile))
                        host.uncacheFile(oldFile);
            filesOfPreviousProject = ownFiles;

            if (files.length !== 0)
                yield {files, program};
        }
        ensurePatternsMatch(nonMagicGlobs, ex, allMatchedFiles, projectsSeen);

        function isFileIncluded(fileName: string) {
            return (include.length === 0 || include.some((p) => p.match(fileName))) && !ex.some((p) => p.match(fileName));
        }
    }

    private checkConfigDirectory(fileOrDirName: string): string {
        switch (this.fs.getKind(fileOrDirName)) {
            case FileKind.NonExistent:
                throw new ConfigurationError(`The specified path does not exist: '${fileOrDirName}'`);
            case FileKind.Directory: {
                const file = unixifyPath(path.join(fileOrDirName, 'tsconfig.json'));
                if (!this.fs.isFile(file))
                    throw new ConfigurationError(`Cannot find a tsconfig.json file at the specified directory: '${fileOrDirName}'`);
                return file;
            }
            default:
                return fileOrDirName;
        }
    }

    private* createPrograms(
        projects: ReadonlyArray<string>,
        host: ProjectHost,
        seen: string[],
        references: boolean,
        isFileIncluded: (fileName: string) => boolean,
    ): Iterable<ts.Program> {
        for (const configFile of projects) {
            if (!addUnique(seen, configFile))
                continue;

            const config = ts.readConfigFile(configFile, (file) => host.readFile(file));
            if (config.error !== undefined) {
                this.logger.warn(ts.formatDiagnostics([config.error], host));
                config.config = {};
            }
            const parsed = ts.parseJsonConfigFileContent(
                config.config,
                createParseConfigHost(host),
                path.dirname(configFile),
                {noEmit: true},
                configFile,
            );
            if (parsed.errors.length !== 0) {
                let {errors} = parsed;
                // for compatibility with typescript@<3.1.0
                if (references && parsed.projectReferences !== undefined && parsed.projectReferences.length !== 0)
                    errors = errors.filter((e) => e.code !== 18002); // 'files' is allowed to be empty if there are project references
                if (errors.length !== 0)
                    this.logger.warn(ts.formatDiagnostics(parsed.errors, host));
            }
            if (parsed.fileNames.length !== 0) {
                if (parsed.options.composite && !parsed.fileNames.some((file) => isFileIncluded(host.getFileSystemFile(file)!))) {
                    log("Project '%s' contains no file to lint", configFile);
                } else {
                    log("Using project '%s'", configFile);
                    yield host.createProgram(parsed.fileNames, parsed.options, undefined, parsed.projectReferences);
                }
            }
            if (references && parsed.projectReferences !== undefined)
                yield* this.createPrograms(
                    parsed.projectReferences.map((ref) => this.checkConfigDirectory(ref.path)),
                    host,
                    seen,
                    true,
                    isFileIncluded,
                );
        }
    }
}

function getOutputsOfProjectReferences(program: ts.Program, host: ProjectHost) {
    const references = program.getResolvedProjectReferences === undefined
        // for compatibility with TypeScript@<3.1.1
        ? program.getProjectReferences && <ReadonlyArray<ts.ResolvedProjectReference | undefined> | undefined>program.getProjectReferences()
        : program.getResolvedProjectReferences();
    if (references === undefined)
        return [];
    const seen: string[] = [];
    const result = [];
    const moreReferences = [];
    for (const ref of references) {
        if (ref === undefined || !addUnique(seen, ref.sourceFile.fileName))
            continue;
        result.push(...getOutputFileNamesOfProjectReference(path.dirname(ref.sourceFile.fileName), ref.commandLine));
        if ('references' in ref) {
            result.push(...getOutputFileNamesOfResolvedProjectReferencesRecursive(ref.references, seen));
        } else if (ref.commandLine.projectReferences !== undefined) {
            // for compatibility with typescript@<3.2.0
            moreReferences.push(...ref.commandLine.projectReferences);
        }
    }
    for (const ref of moreReferences)
        result.push(...getOutputFileNamesOfProjectReferenceRecursive(ref, seen, host));
    return result;
}

// TODO unifiy with code in getOutputsOfProjectReferences once we can get rid of getOutputFileNamesOfProjectReferenceRecursive
function getOutputFileNamesOfResolvedProjectReferencesRecursive(references: ts.ResolvedProjectReference['references'], seen: string[]) {
    if (references === undefined)
        return [];
    const result: string[] = [];
    for (const ref of references) {
        if (ref === undefined || !addUnique(seen, ref.sourceFile.fileName))
            continue;
        result.push(...getOutputFileNamesOfProjectReference(path.dirname(ref.sourceFile.fileName), ref.commandLine));
        result.push(...getOutputFileNamesOfResolvedProjectReferencesRecursive(ref.references, seen));
    }
    return result;
}

/** recurse into every transitive project reference to exclude all of their outputs from linting */
function getOutputFileNamesOfProjectReferenceRecursive(reference: ts.ProjectReference, seen: string[], host: ProjectHost) {
    // wotan-disable-next-line no-unstable-api-use
    const referencePath = ts.resolveProjectReferencePath(host, reference); // for compatibility with TypeScript@<3.1.1
    if (!addUnique(seen, referencePath))
        return [];
    const sourceFile = host.getSourceFile(referencePath, ts.ScriptTarget.JSON);
    if (sourceFile === undefined)
        return [];
    const projectDirectory = path.dirname(referencePath);
    const commandLine = ts.parseJsonSourceFileConfigFileContent(
        <ts.TsConfigSourceFile>sourceFile,
        createParseConfigHost(host),
        projectDirectory,
        undefined,
        referencePath,
    );
    const result = getOutputFileNamesOfProjectReference(projectDirectory, commandLine);
    if (commandLine.projectReferences !== undefined)
        for (const ref of commandLine.projectReferences)
            result.push(...getOutputFileNamesOfProjectReferenceRecursive(ref, seen, host));
    return result;
}

function getOutputFileNamesOfProjectReference(projectDirectory: string, commandLine: ts.ParsedCommandLine) {
    const options = commandLine.options;
    if (options.outFile)
        return [getOutFileDeclarationName(options.outFile)];
    return mapDefined(commandLine.fileNames, (fileName) => getDeclarationOutputName(fileName, options, projectDirectory));
}

// TODO remove once https://github.com/Microsoft/TypeScript/issues/26410 is resolved
function getDeclarationOutputName(fileName: string, options: ts.CompilerOptions, projectDirectory: string) {
    const extension = path.extname(fileName);
    switch (extension) {
        case '.tsx':
            break;
        case '.ts':
            if (path.extname(fileName.slice(0, -extension.length)) !== '.d')
                break;
            // falls through: .d.ts files produce no output
        default:
            return;
    }
    fileName = fileName.slice(0, -extension.length) + '.d.ts';
    return unixifyPath(
        path.resolve(
            options.declarationDir || options.outDir || projectDirectory,
            path.relative(options.rootDir || projectDirectory, fileName),
        ),
    );
}

function getOutFileDeclarationName(outFile: string) {
    // outFile ignores declarationDir
    return outFile.slice(0, -path.extname(outFile).length) + '.d.ts';
}

function getFiles(patterns: ReadonlyArray<NormalizedGlob>, exclude: ReadonlyArray<string>, cwd: string): Iterable<string> {
    const result: string[] = [];
    const globOptions: glob.IOptions = {
        cwd,
        nobrace: true, // braces are already expanded
        cache: {},
        ignore: exclude,
        nodir: true,
        realpathCache: {},
        statCache: {},
        symlinks: {},
    };
    for (const pattern of patterns) {
        let matched = pattern.hasMagic;
        for (const normalized of pattern.normalized) {
            const match = glob.sync(normalized, globOptions);
            if (match.length !== 0) {
                matched = true;
                result.push(...match);
            }
        }
        if (!matched && !isExcluded(pattern.normalized[0], exclude.map((p) => new Minimatch(p, {dot: true}))))
            throw new ConfigurationError(`'${pattern.normalized[0]}' does not exist.`);
    }
    return new Set(result.map(unixifyPath)); // deduplicate files
}

function ensurePatternsMatch(include: string[], exclude: IMinimatch[], files: string[], projects: ReadonlyArray<string>) {
    for (const pattern of include)
        if (!files.includes(pattern) && !isExcluded(pattern, exclude))
            throw new ConfigurationError(`'${pattern}' is not included in any of the projects: '${projects.join("', '")}'.`);
}

function isExcluded(file: string, exclude: IMinimatch[]): boolean {
    for (const e of exclude)
        if (e.match(file))
            return true;
    return false;
}

function hasParseErrors(sourceFile: ts.SourceFile) {
    return sourceFile.parseDiagnostics.length !== 0;
}

function shouldFix(sourceFile: ts.SourceFile, options: Pick<LintOptions, 'fix'>, originalName: string) {
    if (options.fix && hasParseErrors(sourceFile)) {
        log("Not fixing '%s' because of parse errors.", originalName);
        return false;
    }
    return options.fix;
}

declare module 'typescript' {
    function matchFiles(
        path: string,
        extensions: ReadonlyArray<string>,
        excludes: ReadonlyArray<string> | undefined,
        includes: ReadonlyArray<string>,
        useCaseSensitiveFileNames: boolean,
        currentDirectory: string,
        depth: number | undefined,
        getFileSystemEntries: (path: string) => ts.FileSystemEntries,
    ): string[];

    interface FileSystemEntries {
        readonly files: ReadonlyArray<string>;
        readonly directories: ReadonlyArray<string>;
    }

    interface SourceFile {
        parseDiagnostics: ts.DiagnosticWithLocation[];
    }
}

function createParseConfigHost(host: ProjectHost): ts.ParseConfigHost {
    return {
        useCaseSensitiveFileNames: host.useCaseSensitiveFileNames(),
        readDirectory(rootDir, extensions, excludes, includes, depth) {
            return host.readDirectory(rootDir, extensions, excludes, includes, depth);
        },
        fileExists(f) {
            return host.fileExists(f);
        },
        readFile(f) {
            return host.readFile(f);
        },
    };
}
