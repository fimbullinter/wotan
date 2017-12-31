import { Linter } from './linter';
import { LintResult, FileSummary, Configuration, AbstractProcessor, CurrentDirectory } from './types';
import * as path from 'path';
import * as ts from 'typescript';
import * as glob from 'glob';
import { unixifyPath } from './utils';
import { Minimatch, IMinimatch } from 'minimatch';
import * as resolveGlob from 'to-absolute-glob';
import { ConfigurationError } from './error';
import { loadProcessor } from './processor-loader';
import { injectable, inject } from 'inversify';
import { CachedFileSystem, FileKind } from './services/cached-file-system';
import { ConfigurationManager } from './services/configuration-manager';

export interface LintOptions {
    config: string | undefined;
    files: string[];
    exclude: string[];
    project: string | undefined;
    fix: boolean | number;
}

@injectable()
export class Runner {
    constructor(
        private fs: CachedFileSystem,
        private configManager: ConfigurationManager,
        private linter: Linter,
        @inject(CurrentDirectory) private cwd: string,
    ) {}

    public lintCollection(options: LintOptions): LintResult {
        const config = options.config !== undefined ? this.resolveConfig(options.config) : undefined;
        if (options.project === undefined && options.files.length !== 0)
            return this.lintFiles(options, config);

        return this.lintProject(options, config);
    }

    private lintProject(options: LintOptions, config: Configuration | undefined) {
        const processorHost = new ProjectHost(this.cwd, config, this.fs, this.configManager);
        let {files, program} = this.getFilesAndProgram(options.project, options.files, options.exclude, processorHost);
        const result: LintResult = new Map();
        let dir: string | undefined;

        for (const file of files) {
            if (options.config === undefined) {
                const dirname = path.dirname(file);
                if (dir !== dirname) {
                    config = this.configManager.findConfiguration(file);
                    dir = dirname;
                }
            }
            const effectiveConfig = config && this.configManager.reduceConfigurationForFile(config, file);
            if (effectiveConfig === undefined)
                continue;
            let sourceFile = program.getSourceFile(file);
            const mapped = processorHost.processedFiles.get(file);
            const originalName = mapped === undefined ? file : mapped.originalName;
            const originalContent = mapped === undefined ? sourceFile.text : mapped.originalContent;
            let summary: FileSummary;
            if (options.fix) {
                summary = this.linter.lintAndFix(
                    sourceFile,
                    originalContent,
                    effectiveConfig,
                    (content, range) => {
                        sourceFile = ts.updateSourceFile(sourceFile, content, range);
                        processorHost.sourceFiles.set(file, sourceFile);
                        program = ts.createProgram(
                            program.getRootFileNames(),
                            program.getCompilerOptions(),
                            processorHost,
                            program,
                        );
                        return {program, file: sourceFile};
                    },
                    options.fix === true ? undefined : options.fix,
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
            result.set(originalName, summary);
        }
        return result;
    }

    private lintFiles(options: LintOptions, config: Configuration | undefined) {
        const result: LintResult = new Map();
        let dir: string | undefined;
        let processor: AbstractProcessor | undefined;
        for (const file of getFiles(options.files, options.exclude, this.cwd)) {
            if (options.config === undefined) {
                const dirname = path.dirname(file);
                if (dir !== dirname) {
                    config = this.configManager.findConfiguration(file);
                    dir = dirname;
                }
            }
            const effectiveConfig = config && this.configManager.reduceConfigurationForFile(config, file);
            if (effectiveConfig === undefined)
                continue;
            const originalContent = this.fs.readFile(file)!;
            let name: string;
            let content: string;
            if (effectiveConfig.processor) {
                const ctor = loadProcessor(effectiveConfig.processor);
                name = ctor.transformName(file, effectiveConfig.settings);
                processor = new ctor(originalContent, file, name, effectiveConfig.settings);
                content = processor.preprocess();
            } else {
                processor = undefined;
                name = file;
                content = originalContent;
            }

            let sourceFile = ts.createSourceFile(name, content, ts.ScriptTarget.ESNext, true);
            let summary: FileSummary;
            if (options.fix) {
                summary = this.linter.lintAndFix(
                    sourceFile,
                    originalContent,
                    effectiveConfig,
                    (newContent, range) => {
                        sourceFile = ts.updateSourceFile(sourceFile, newContent, range);
                        return {file: sourceFile};
                    },
                    options.fix === true ? undefined : options.fix,
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
            result.set(file, summary);
        }
        return result;
    }

    private resolveConfig(pathOrName: string): Configuration {
        const absolute = path.resolve(this.cwd, pathOrName);
        const resolved = this.fs.isFile(absolute) ? absolute : this.configManager.resolveConfigFile(pathOrName, this.cwd);
        return this.configManager.loadConfigurationFromPath(resolved, false);
    }

    private getFilesAndProgram(
        project: string | undefined,
        patterns: string[],
        exclude: string[],
        host: ProjectHost,
    ): {files: string[], program: ts.Program} {
        const cwd = this.cwd;
        if (project !== undefined) {
            project = this.checkConfigDirectory(path.resolve(cwd, project));
        } else {
            project = ts.findConfigFile(cwd, (f) => this.fs.isFile(f));
            if (project === undefined)
                throw new ConfigurationError(`Cannot find tsconfig.json for directory '${cwd}'.`);
        }
        const program = createProgram(project, host);
        const files: string[] = [];
        const libDirectory = path.dirname(ts.getDefaultLibFilePath(program.getCompilerOptions()));
        const include = patterns.map((p) => new Minimatch(resolveGlob(p, {cwd})));
        const ex = exclude.map((p) => new Minimatch(resolveGlob(p, {cwd}), {dot: true}));
        const typeRoots = ts.getEffectiveTypeRoots(program.getCompilerOptions(), {
            getCurrentDirectory() { return cwd; },
            directoryExists(dir) {
                return host.directoryExists(dir);
            },
        });
        outer: for (const sourceFile of program.getSourceFiles()) {
            const {fileName} = sourceFile;
            if (path.relative(libDirectory, fileName) === path.basename(fileName))
                continue; // lib.xxx.d.ts
            if (program.isSourceFileFromExternalLibrary(sourceFile))
                continue;
            if (typeRoots !== undefined) {
                for (const typeRoot of typeRoots) {
                    const relative = path.relative(typeRoot, fileName);
                    if (!relative.startsWith('..' + path.sep))
                        continue outer;
                }
            }
            const mapped = host.processedFiles.get(fileName);
            const originalName = mapped === undefined ? fileName : mapped.originalName;
            if (include.length !== 0 && !include.some((e) => e.match(originalName)))
                continue;
            if (ex.some((e) => e.match(originalName)))
                continue;
            files.push(fileName);
        }
        ensurePatternsMatch(include, ex, files);
        return {files, program};
    }

    private checkConfigDirectory(fileOrDirName: string): string {
        switch (this.fs.getKind(fileOrDirName)) {
            case FileKind.NonExistent:
                throw new ConfigurationError(`The specified path does not exist: '${fileOrDirName}'`);
            case FileKind.Directory:
                fileOrDirName = path.join(fileOrDirName, 'tsconfig.json');
                if (!this.fs.isFile(fileOrDirName))
                throw new ConfigurationError(`Cannot find a tsconfig.json file at the specified directory: '${fileOrDirName}'`);
                // falls through
            default:
                return fileOrDirName;
        }
    }
}

function getFiles(patterns: string[], exclude: string[], cwd: string): string[] {
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
                throw new ConfigurationError(`'${pattern}' does not exist.`);
        }
    }
    return Array.from(new Set(result.map(unixifyPath))); // deduplicate files
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

declare module 'typescript' {
    export function matchFiles(
        path: string,
        extensions: ReadonlyArray<string>,
        excludes: ReadonlyArray<string>,
        includes: ReadonlyArray<string>,
        useCaseSensitiveFileNames: boolean,
        currentDirectory: string,
        depth: number | undefined,
        getFileSystemEntries: (path: string) => ts.FileSystemEntries,
    ): string[];

    export interface FileSystemEntries {
        readonly files: ReadonlyArray<string>;
        readonly directories: ReadonlyArray<string>;
    }
}

interface ProcessedFileInfo {
    originalName: string;
    originalContent: string;
    processor: AbstractProcessor;
}

class ProjectHost implements ts.CompilerHost {
    public reverseMap = new Map<string, string>();
    public map = new Map<string, string>();
    public mappedDirectories = new Map<string, ts.FileSystemEntries>();
    public processedFiles = new Map<string, ProcessedFileInfo>();
    public sourceFiles = new Map<string, ts.SourceFile | undefined>();

    constructor(
        public cwd: string,
        public config: Configuration | undefined,
        private fs: CachedFileSystem,
        private configManager: ConfigurationManager,
    ) {}

    public getDirectoryEntries(dir: string): ts.FileSystemEntries {
        let result = this.mappedDirectories.get(dir);
        if (result !== undefined)
            return result;
        const files: string[] = [];
        const directories: string[] = [];
        result = {files, directories};
        this.mappedDirectories.set(dir, result);
        const entries = this.fs.readDirectory(dir);
        if (entries.length !== 0) {
            let c: Configuration | undefined | 'initial' = /\/node_modules(\/|$)/.test(dir)
                ? undefined // don't use processors in node_modules
                : this.config || 'initial';
            for (const entry of entries) {
                const fileName = path.join(dir, entry);
                switch (this.fs.getKind(fileName)) {
                    case FileKind.File:
                        if (c === 'initial')
                            c = this.configManager.findConfiguration(fileName);
                        const processor = c && this.configManager.getProcessorForFile(c, fileName);
                        let newName: string;
                        if (processor) {
                            const ctor = loadProcessor(processor);
                            newName = ctor.transformName(fileName, this.configManager.getSettingsForFile(c!, fileName));
                        } else {
                            newName = fileName;
                        }
                        files.push(newName);
                        this.map.set(fileName, newName);
                        this.reverseMap.set(newName, fileName);
                        break;
                    case FileKind.Directory:
                        directories.push(fileName);
                }
            }
        }
        return result;
    }

    public fileExists(file: string): boolean {
        switch (this.fs.getKind(file)) {
            case FileKind.Directory:
            case FileKind.Other:
                return false;
            case FileKind.File:
                return true;
            default: {
                return this.getFileSystemFile(file) !== undefined;
            }
        }
    }

    public directoryExists(dir: string) {
        return this.fs.isDirectory(dir);
    }

    private getFileSystemFile(file: string): string | undefined {
        if (/\/node_modules\//.test(file))
            return this.fs.getKind(file) === FileKind.File ? file : undefined;
        if (this.map.has(file))
            return file;
        const reverse = this.reverseMap.get(file);
        if (reverse !== undefined)
            return reverse;
        const dirname = path.dirname(file);
        if (this.mappedDirectories.has(dirname))
            return;
        this.getDirectoryEntries(dirname);
        return this.getFileSystemFile(file);
    }

    public readFile(file: string): string | undefined {
        const realFile = this.getFileSystemFile(file);
        if (realFile === undefined)
            return;
        let content = this.fs.readFile(realFile);
        if (file === realFile || content === undefined)
            return content;

        const config = this.config || this.configManager.findConfiguration(realFile)!;
        const ctor = loadProcessor(this.configManager.getProcessorForFile(config, realFile)!);
        const processor = new ctor(content, realFile, file, this.configManager.getSettingsForFile(config, file));
        this.processedFiles.set(file, {
            processor,
            originalContent: content,
            originalName: realFile,
        });
        content = processor.preprocess();
        return content;
    }

    public writeFile() {}
    public useCaseSensitiveFileNames() {
        return ts.sys.useCaseSensitiveFileNames;
    }
    public getDefaultLibFileName = ts.getDefaultLibFilePath;
    public getCanonicalFileName = ts.sys.useCaseSensitiveFileNames ? (f: string) => f : (f: string) => f.toLowerCase();
    public getNewLine() {
        return '\n';
    }
    public realpath = this.fs.realpath === undefined ? undefined : (fileName: string) => this.fs.realpath!(fileName);
    public getCurrentDirectory() {
        return this.cwd;
    }
    public getDirectories(dir: string) {
        return this.fs.readDirectory(dir).filter((f) => this.fs.isDirectory(path.join(dir, f)));
    }
    public getSourceFile(fileName: string, languageVersion: ts.ScriptTarget) {
        if (this.sourceFiles.has(fileName))
            return this.sourceFiles.get(fileName);
        const content = this.readFile(fileName);
        const result = content === undefined ? undefined : ts.createSourceFile(fileName, content, languageVersion, true);
        this.sourceFiles.set(fileName, result);
        return result;
    }
}

function createProgram(configFile: string, host: ProjectHost): ts.Program {
    const config = ts.readConfigFile(configFile, ts.sys.readFile);
    if (config.error !== undefined)
        throw new ConfigurationError(ts.formatDiagnostics([config.error], {
            getCanonicalFileName: (f) => f,
            getCurrentDirectory: () => host.cwd,
            getNewLine: () => '\n',
        }));
    const parsed = ts.parseJsonConfigFileContent(
        config.config,
        createParseConfigHost(host),
        path.dirname(configFile),
        {noEmit: true},
        configFile,
    );
    if (parsed.errors !== undefined) {
        // ignore 'TS18003: No inputs were found in config file ...'
        const errors = parsed.errors.filter((d) => d.code !== 18003);
        if (errors.length !== 0)
            throw new ConfigurationError(ts.formatDiagnostics(errors, {
                getCanonicalFileName: (f) => f,
                getCurrentDirectory: () => host.cwd,
                getNewLine: () => '\n',
            }));
    }
    return ts.createProgram(parsed.fileNames, parsed.options, host);
}

function createParseConfigHost(host: ProjectHost): ts.ParseConfigHost {
    return {
        useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
        readDirectory(rootDir, extensions, excludes, includes, depth) {
            return ts.matchFiles(rootDir, extensions, excludes, includes, ts.sys.useCaseSensitiveFileNames, host.cwd, depth, (dir) => {
                return host.getDirectoryEntries(dir);
            });
        },
        fileExists(f) {
            return host.fileExists(f);
        },
        readFile(f) {
            return host.readFile(f);
        },
    };
}
