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
import { unixifyPath, hasSupportedExtension } from './utils';
import { Minimatch, IMinimatch } from 'minimatch';
import { ProcessorLoader } from './services/processor-loader';
import { injectable } from 'inversify';
import { CachedFileSystem, FileKind } from './services/cached-file-system';
import { ConfigurationManager } from './services/configuration-manager';
import { ProjectHost } from './project-host';
import debug = require('debug');
import resolveGlob = require('to-absolute-glob');
import { isCompilerOptionEnabled } from 'tsutils';

const log = debug('wotan:runner');

export interface LintOptions {
    config: string | undefined;
    files: string[];
    exclude: string[];
    project: string | undefined;
    fix: boolean | number;
    extensions: string[] | undefined;
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
        const resolveOptions = {cwd: this.directories.getCurrentDirectory()};
        const files = options.files.map(resolve);
        const exclude = options.exclude.map(resolve);
        if (options.project === undefined && options.files.length !== 0)
            return this.lintFiles({...options, files, exclude}, config);

        return this.lintProject({...options, files, exclude}, config);

        function resolve(pattern: string) {
            return resolveGlob(pattern, resolveOptions);
        }
    }

    private *lintProject(options: LintOptions, config: Configuration | undefined): LintResult {
        const processorHost = new ProjectHost(
            this.directories.getCurrentDirectory(),
            config,
            this.fs,
            this.configManager,
            this.processorLoader,
        );
        for (let {files, program} of this.getFilesAndProgram(options.project, options.files, options.exclude, processorHost)) {
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

    private *lintFiles(options: LintOptions, config: Configuration | undefined): LintResult {
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
        project: string | undefined,
        patterns: string[],
        exclude: string[],
        host: ProjectHost,
    ): Iterable<{files: Iterable<string>, program: ts.Program}> {
        const originalNames: string [] = [];
        const include = patterns.map((p) => new Minimatch(p));
        const ex = exclude.map((p) => new Minimatch(p, {dot: true}));
        // TODO maybe use a different host for each Program or purge all non-declaration files?
        for (const program of this.createPrograms(project, host, new Set(), isFileIncluded)) {
            const options = program.getCompilerOptions();
            const files: string[] = [];
            const libDirectory = unixifyPath(path.dirname(ts.getDefaultLibFilePath(options))) + '/';
            const typeRoots = ts.getEffectiveTypeRoots(options, host) || [];
            const rootFileNames = program.getRootFileNames();
            const outputsOfReferencedProjects = getOutputsOfProjectReferences(program);

            for (const sourceFile of program.getSourceFiles()) {
                const {fileName} = sourceFile;
                if (
                    options.composite && !rootFileNames.includes(fileName) || // composite projects need to specify all files as rootFiles
                    outputsOfReferencedProjects.includes(fileName) || // exclude outputs of referenced projects
                    fileName.startsWith(libDirectory) || // lib.xxx.d.ts
                    // tslib implicitly gets added while linting a project where a dependency in node_modules contains typescript files
                    fileName.endsWith('/node_modules/tslib/tslib.d.ts') ||
                    program.isSourceFileFromExternalLibrary(sourceFile) ||
                    !typeRoots.every((typeRoot) => path.relative(typeRoot, fileName).startsWith('..' + path.sep))
                )
                    continue;
                const originalName = host.getFileSystemFile(fileName)!;
                if (!isFileIncluded(originalName))
                    continue;
                files.push(fileName);
                originalNames.push(originalName);
            }
            yield {files, program};
        }
        ensurePatternsMatch(include, ex, originalNames);

        function isFileIncluded(fileName: string) {
            return (include.length === 0 || include.some((p) => p.match(fileName))) && !ex.some((p) => p.match(fileName));
        }
    }

    private checkConfigDirectory(fileOrDirName: string): string {
        switch (this.fs.getKind(fileOrDirName)) {
            case FileKind.NonExistent:
                throw new ConfigurationError(`The specified path does not exist: '${fileOrDirName}'`);
            case FileKind.Directory: {
                const file = path.join(fileOrDirName, 'tsconfig.json');
                if (!this.fs.isFile(file))
                    throw new ConfigurationError(`Cannot find a tsconfig.json file at the specified directory: '${fileOrDirName}'`);
                return file;
            }
            default:
                return fileOrDirName;
        }
    }

    private* createPrograms(
        configFile: string | undefined,
        host: ProjectHost,
        seen: Set<string>,
        isFileIncluded: (fileName: string) => boolean,
    ): Iterable<ts.Program> {
        const cwd = this.directories.getCurrentDirectory();
        if (configFile !== undefined) {
            configFile = this.checkConfigDirectory(path.resolve(cwd, configFile));
        } else {
            configFile = ts.findConfigFile(cwd, (f) => this.fs.isFile(f));
            if (configFile === undefined)
                throw new ConfigurationError(`Cannot find tsconfig.json for directory '${cwd}'.`);
        }
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
            if (parsed.projectReferences !== undefined && parsed.projectReferences.length !== 0)
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
        if (parsed.projectReferences !== undefined) {
            for (const reference of parsed.projectReferences) {
                if (seen.has(reference.path))
                    continue;
                seen.add(reference.path);
                yield* this.createPrograms(reference.path, host, seen, isFileIncluded);
            }
        }
    }
}

function getOutputsOfProjectReferences(program: ts.Program) {
    const references = program.getProjectReferences && program.getProjectReferences();
    if (references === undefined)
        return [];
    return flatMap(references, (ref) => ref === undefined ? [] : getOutputFileNamesOfProjectReference(ref));
}

function getOutputFileNamesOfProjectReference(reference: ts.ResolvedProjectReference) {
    const options = reference.commandLine.options;
    if (options.outFile)
        return getOutFileNames(options.outFile, options);
    const projectDirectory = path.dirname(reference.sourceFile.fileName);
    return flatMap(reference.commandLine.fileNames, (fileName) => getOutputFileNames(fileName, options, projectDirectory));
}

function flatMap<T, U>(source: Iterable<T>, cb: (e: T) => U[]): U[] {
    const result = [];
    for (const item of source)
        result.push(...cb(item));
    return result;
}

function getOutputExtension(fileName: string, options: ts.CompilerOptions) {
    switch (path.extname(fileName)) {
        case '.ts':
            if (path.extname(fileName.slice(0, -3)) === '.d')
                return; // .d.ts files produce no output
            break;
        case '.json':
            return '.json';
        case '.jsx':
        case '.tsx':
            if (options.jsx === ts.JsxEmit.Preserve)
                return '.jsx';
    }
    return '.js';
}

function getOutputFileNames(fileName: string, options: ts.CompilerOptions, projectDirectory: string) {
    const extension = getOutputExtension(fileName, options);
    if (extension === undefined)
        return [];
    fileName = fileName.slice(0, -extension.length);
    fileName = path.resolve(options.outDir || projectDirectory, path.relative(options.rootDir || projectDirectory, fileName));
    const result = [fileName + extension];
    // TODO isn't "declaration" always enabled in referenced projects?
    // TODO are JS files allowed and do they produce declaration files?
    // TODO declartionDir? tsc doesn't treat this special
    if (extension !== '.json' && isCompilerOptionEnabled(options, 'declaration'))
        result.push(fileName + '.d.ts');
    return result;
}

function getOutFileNames(outFile: string, options: ts.CompilerOptions) {
    const result = [outFile];
    // TODO declarationDir?
    if (isCompilerOptionEnabled(options, 'declaration'))
        result.push(outFile.slice(0, -path.extname(outFile).length) + '.d.ts');
    return result;
}

function getFiles(patterns: string[], exclude: string[], cwd: string): Iterable<string> {
    const result: string[] = [];
    const globOptions = {
        cwd,
        absolute: true,
        cache: {},
        ignore: exclude,
        nodir: true,
        realpathCache: {},
        statCache: {},
        symlinks: {},
    };
    for (const pattern of patterns) {
        const match = glob.sync(pattern, globOptions);
        if (match.length !== 0) {
            result.push(...match);
        } else if (!glob.hasMagic(pattern)) {
            const normalized = new Minimatch(pattern).set[0].join('/');
            if (!isExcluded(normalized, exclude.map((p) => new Minimatch(p, {dot: true}))))
                throw new ConfigurationError(`'${normalized}' does not exist.`);
        }
    }
    return new Set(result.map(unixifyPath)); // deduplicate files
}

function ensurePatternsMatch(include: IMinimatch[], exclude: IMinimatch[], files: string[]) {
    for (const pattern of include) {
        if (!glob.hasMagic(pattern.pattern)) {
            const normalized = pattern.set[0].join('/');
            if (!files.includes(normalized) && !isExcluded(normalized, exclude))
                throw new ConfigurationError(`'${normalized}' is not included in the project.`);
        }
    }
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

function shouldFix(sourceFile: ts.SourceFile, options: LintOptions, originalName: string) {
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
