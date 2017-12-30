import { Linter } from './linter';
import { LintResult, FileSummary, Configuration, AbstractProcessor } from './types';
import * as path from 'path';
import {
    findConfiguration,
    reduceConfigurationForFile,
    parseConfigFile,
    readConfigFile,
    resolveConfigFile,
    getProcessorForFile,
} from './configuration';
import * as fs from 'fs';
import * as ts from 'typescript';
import * as glob from 'glob';
import { unixifyPath } from './utils';
import { Minimatch, IMinimatch } from 'minimatch';
import * as resolveGlob from 'to-absolute-glob';
import { ConfigurationError } from './error';
import { loadProcessor } from './processor-loader';
import { Container, BindingScopeEnum } from 'inversify';
import { DEFAULT_DI_MODULE } from './di/default.module';
import { CORE_DI_MODULE } from './di/core.module';

export interface LintOptions {
    config: string | undefined;
    files: string[];
    exclude: string[];
    project: string | undefined;
    fix: boolean | number;
}

export function lintCollection(options: LintOptions, cwd: string): LintResult {
    const container = new Container({defaultScope: BindingScopeEnum.Singleton});
    container.load(DEFAULT_DI_MODULE, CORE_DI_MODULE);
    const linter = container.get(Linter);

    const config = options.config !== undefined ? resolveConfig(options.config, cwd) : undefined;
    if (options.project === undefined && options.files.length !== 0)
        return lintFiles(linter, options, cwd, config);

    return lintProject(linter, options, cwd, config);
}

function lintProject(linter: Linter, options: LintOptions, cwd: string, config?: Configuration) {
    const processorHost = new ProcessorHost(cwd, config);
    let {files, program} = getFilesAndProgram(options.project, options.files, options.exclude, processorHost);
    const result: LintResult = new Map();
    let dir: string | undefined;

    for (const file of files) {
        if (options.config === undefined) {
            const dirname = path.dirname(file);
            if (dir !== dirname) {
                config = findConfiguration(file, cwd);
                dir = dirname;
            }
        }
        const effectiveConfig = config && reduceConfigurationForFile(config, file, cwd);
        if (effectiveConfig === undefined)
            continue;
        let sourceFile = program.getSourceFile(file);
        const mapped = processorHost.processedFiles.get(file);
        const originalName = mapped === undefined ? file : mapped.originalName;
        const originalContent = mapped === undefined ? sourceFile.text : mapped.originalContent;
        let summary: FileSummary;
        if (options.fix) {
            summary = linter.lintAndFix(
                sourceFile,
                originalContent,
                effectiveConfig,
                (content, range) => {
                    sourceFile = ts.updateSourceFile(sourceFile, content, range);
                    processorHost.sourceFiles.set(file, sourceFile);
                    program = ts.createProgram(
                        program.getRootFileNames(),
                        program.getCompilerOptions(),
                        createCompilerHost(processorHost),
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
                failures: linter.getFailures(
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

function lintFiles(linter: Linter, options: LintOptions, cwd: string, config: Configuration | undefined) {
    const result: LintResult = new Map();
    let dir: string | undefined;
    let processor: AbstractProcessor | undefined;
    for (const file of getFiles(options.files, options.exclude, cwd)) {
        if (options.config === undefined) {
            const dirname = path.dirname(file);
            if (dir !== dirname) {
                config = findConfiguration(file, cwd);
                dir = dirname;
            }
        }
        const effectiveConfig = config && reduceConfigurationForFile(config, file, cwd);
        if (effectiveConfig === undefined)
            continue;
        const originalContent = fs.readFileSync(file, 'utf8');
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
            summary = linter.lintAndFix(
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
                failures: linter.getFailures(
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

function resolveConfig(pathOrName: string, cwd: string): Configuration {
    const absolute = path.resolve(cwd, pathOrName);
    const resolved = fs.existsSync(absolute) ? absolute : resolveConfigFile(pathOrName, cwd);
    return parseConfigFile(readConfigFile(resolved), resolved, false);
}

function getFilesAndProgram(
    project: string | undefined,
    patterns: string[],
    exclude: string[],
    host: ProcessorHost,
): {files: string[], program: ts.Program} {
    const {cwd} = host;
    if (project !== undefined) {
        project = checkConfigDirectory(path.resolve(cwd, project));
    } else {
        project = findupTsconfig(host.cwd);
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

function findupTsconfig(directory: string): string {
    while (true) {
        const fullPath = path.join(directory, 'tsconfig.json');
        if (fs.existsSync(fullPath))
            return fullPath;
        const prev = directory;
        directory = path.dirname(directory);
        if (directory === prev)
            throw new ConfigurationError(`Cannot find tsconfig.json for current directory.`);
    }
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

const enum FileKind {
    NonExistent,
    Unknown,
    File,
    Mapped,
    Directory,
}

interface ProcessedFileInfo {
    originalName: string;
    originalContent: string;
    processor: AbstractProcessor;
}

class ProcessorHost {
    public reverseMap = new Map<string, string>();
    public map = new Map<string, string>();
    public mappedDirectories = new Map<string, ts.FileSystemEntries>();
    public seen = new Map<string, FileKind>();
    public processedFiles = new Map<string, ProcessedFileInfo>();
    public fileContent = new Map<string, string | null>();
    public sourceFiles = new Map<string, ts.SourceFile | undefined>();

    constructor(public cwd: string, public config?: Configuration) {}

    public processDirectory(dir: string): ts.FileSystemEntries {
        let result = this.mappedDirectories.get(dir);
        if (result !== undefined)
            return result;
        const files: string[] = [];
        const directories: string[] = [];
        result = {files, directories};
        this.mappedDirectories.set(dir, result);
        const knownKind = this.seen.get(dir);
        if (knownKind !== undefined && knownKind !== FileKind.Directory)
            return result;
        let entries;
        try {
            entries = fs.readdirSync(dir);
        } catch (e) {
            if (e.code === 'ENOENT')
                this.seen.set(dir, FileKind.NonExistent);
            return result;
        }
        this.seen.set(dir, FileKind.Directory);
        if (entries.length !== 0) {
            let c: Configuration | undefined | 'initial' = /\/node_modules(\/|$)/.test(dir)
                ? undefined // don't use processors in node_modules
                : this.config || 'initial';
            for (const entry of entries) {
                const fileName = `${dir}/${entry}`;
                switch (this.getFileKind(fileName)) {
                    case FileKind.File:
                        if (c === 'initial')
                            c = findConfiguration(fileName, this.cwd);
                        const processor = c && getProcessorForFile(c, fileName, this.cwd);
                        let newName: string;
                        if (processor) {
                            const ctor = loadProcessor(processor);
                            newName = ctor.transformName(fileName, new Map());
                            this.seen.set(newName, FileKind.Mapped);
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
        switch (this.getFileKind(file)) {
            case FileKind.Directory:
            case FileKind.Unknown:
                return false;
            case FileKind.File:
            case FileKind.Mapped:
                return true;
            default: {
                return this.getFileSystemFile(file) !== undefined;
            }
        }
    }

    public directoryExists(dir: string) {
        return this.getFileKind(dir) === FileKind.Directory;
    }

    public getFileKind(fileName: string) {
        let result = this.seen.get(fileName);
        if (result === undefined) {
            try {
                const stat = fs.statSync(fileName);
                result = stat.isFile() ? FileKind.File : stat.isDirectory() ? FileKind.Directory : FileKind.Unknown;
            } catch {
                result = FileKind.NonExistent;
            }
            this.seen.set(fileName, result);
        }
        return result;
    }

    private getFileSystemFile(file: string): string | undefined {
        if (/\/node_modules\//.test(file))
            return this.getFileKind(file) === FileKind.File ? file : undefined;
        if (this.map.has(file))
            return file;
        const reverse = this.reverseMap.get(file);
        if (reverse !== undefined)
            return reverse;
        const dirname = path.dirname(file);
        if (this.mappedDirectories.has(dirname))
            return;
        this.processDirectory(dirname);
        return this.getFileSystemFile(file);
    }

    public readFile(file: string): string | undefined {
        let content = this.fileContent.get(file);
        if (content !== undefined)
            return content === null ? undefined : content;
        const realFile = this.getFileSystemFile(file);
        if (realFile === undefined) {
            this.fileContent.set(file, null); // tslint:disable-line:no-null-keyword
            return;
        }
        try {
            content = this.fileContent.get(realFile);
            if (content === undefined) {
                content = fs.readFileSync(realFile, 'utf8');
                this.fileContent.set(realFile, content);
            } else if (content === null) {
                content = undefined;
            }
            if (file === realFile)
                return content;
            if (content === undefined) {
                this.fileContent.set(file, null); // tslint:disable-line:no-null-keyword
                return;
            }
            const config = this.config || findConfiguration(realFile, this.cwd)!;
            const processor = new (loadProcessor(getProcessorForFile(config, realFile, this.cwd)!))(content, realFile, file, new Map());
            this.processedFiles.set(file, {
                processor,
                originalContent: content,
                originalName: realFile,
            });
            content = processor.preprocess();
            this.fileContent.set(file, content);
            return content;
        } catch {
            this.fileContent.set(file, '');
            if (file !== realFile)
                this.fileContent.set(realFile, '');
            return '';
        }
    }
}

function createProgram(configFile: string, host: ProcessorHost): ts.Program {
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
    return ts.createProgram(parsed.fileNames, parsed.options, createCompilerHost(host));
}

function createCompilerHost(host: ProcessorHost): ts.CompilerHost {
    return {
        getCanonicalFileName: ts.sys.useCaseSensitiveFileNames ? (f) => f : (f) => f.toLowerCase(),
        getSourceFile(fileName, languageVersion, _onError) {
            if (host.sourceFiles.has(fileName))
                return host.sourceFiles.get(fileName);
            const content = host.readFile(fileName);
            const result = content === undefined ? undefined : ts.createSourceFile(fileName, content, languageVersion, true);
            host.sourceFiles.set(fileName, result);
            return result;
        },
        getDefaultLibFileName: ts.getDefaultLibFilePath,
        writeFile() {},
        getCurrentDirectory: () => host.cwd,
        getDirectories(dir) {
            const processed = host.mappedDirectories.get(dir);
            if (processed !== undefined)
                return processed.directories.map(path.dirname);
            const directories = [];
            for (const entry of fs.readdirSync(dir))
                if (host.directoryExists(`${dir}/${entry}`))
                    directories.push(entry);
            return directories;
        },
        directoryExists(dir) {
            return host.directoryExists(dir);
        },
        useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
        getNewLine: () => '\n',
        fileExists(f) {
            return host.fileExists(f);
        },
        readFile(f) {
            return host.readFile(f);
        },
        realpath(f) {
            return fs.realpathSync(f);
        },
    };
}

function createParseConfigHost(host: ProcessorHost): ts.ParseConfigHost {
    return {
        useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
        readDirectory(rootDir, extensions, excludes, includes, depth) {
            return ts.matchFiles(rootDir, extensions, excludes, includes, ts.sys.useCaseSensitiveFileNames, host.cwd, depth, (dir) => {
                return host.processDirectory(dir);
            });
        },
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile,
    };
}

function checkConfigDirectory(fileOrDirName: string): string {
    let stat: fs.Stats;
    try {
        stat = fs.statSync(fileOrDirName);
    } catch {
        throw new ConfigurationError(`The specified path does not exist: '${fileOrDirName}'`);
    }
    if (stat.isDirectory()) {
        fileOrDirName = path.join(fileOrDirName, 'tsconfig.json');
        if (!fs.existsSync(fileOrDirName))
            throw new ConfigurationError(`Cannot find a tsconfig.json file at the specified directory: '${fileOrDirName}'`);
    }
    return fileOrDirName;
}
