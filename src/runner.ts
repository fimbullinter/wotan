import { LintOptions, lintAndFix, getFailures } from './linter';
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
import { unixifyPath, calculateChangeRange } from './utils';
import { Minimatch, filter as createMinimatchFilter } from 'minimatch';
import * as resolveGlob from 'to-absolute-glob';
import { ConfigurationError } from './error';
import { loadProcessor } from './processor-loader';

export function lintCollection(options: LintOptions, cwd: string): LintResult {
    let {files, program} = getFilesAndProgram(options, cwd);
    const result: LintResult = new Map();
    let dir: string | undefined;
    let config = options.config !== undefined ? resolveConfig(options.config, cwd) : undefined;
    if (program === undefined)
        return lintFiles(files, options, cwd, config);

    const fixedFiles = new Map<string, string>();
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
        let sourceFile = program === undefined
            ? ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.ESNext, true)
            : program.getSourceFile(file)!;
        let summary: FileSummary;
        if (options.fix) {
            let fileContent = sourceFile.text;
            const fixed = lintAndFix(
                sourceFile,
                fileContent,
                effectiveConfig,
                (content, range) => {
                    fileContent = content;
                    fixedFiles.set(file, content);
                    if (program === undefined) {
                        sourceFile = ts.updateSourceFile(sourceFile, content, range);
                        return {file: sourceFile};
                    }
                    program = updateProgram(program, fixedFiles, sourceFile, content, range);
                    sourceFile = program.getSourceFile(file);
                    return {program, file: sourceFile};
                },
                options.fix === true ? undefined : options.fix,
                undefined,
                program,
            );
            summary = {
                failures: fixed.failures,
                fixes: fixed.fixes,
                text: fileContent,
            };
        } else {
            summary = {
                failures: getFailures(sourceFile, effectiveConfig, undefined, program),
                fixes: 0,
                text: sourceFile.text,
            };
        }
        result.set(file, summary);
    }
    return result;
}

function lintFiles(files: string[], options: LintOptions, cwd: string, config: Configuration | undefined) {
    const result: LintResult = new Map();
    let dir: string | undefined;
    let processor: AbstractProcessor | undefined;
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
        let originalContent = fs.readFileSync(file, 'utf8');
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
            const fixed = lintAndFix(
                sourceFile,
                originalContent,
                effectiveConfig,
                (newContent, range) => {
                    originalContent = newContent;
                    if (processor) {
                        const {transformed, changeRange} = processor.updateSource(originalContent, range);
                        range = changeRange !== undefined ? changeRange : calculateChangeRange(content, transformed);
                        content = transformed;
                    } else {
                        content = originalContent;
                    }
                    sourceFile = ts.updateSourceFile(sourceFile, content, range);
                    return {file: sourceFile};
                },
                options.fix === true ? undefined : options.fix,
                (failures) => processor === undefined ? failures : processor.postprocess(failures),
            );
            summary = {
                failures: fixed.failures,
                fixes: fixed.fixes,
                text: originalContent,
            };
        } else {
            summary = {
                failures: getFailures(
                    sourceFile,
                    effectiveConfig,
                    processor === undefined ? undefined : (failures) => processor!.postprocess(failures),
                ),
                fixes: 0,
                text: originalContent,
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

function updateProgram(
    oldProgram: ts.Program,
    fixed: Map<string, string>,
    currentFile: ts.SourceFile,
    newContent: string,
    changeRange: ts.TextChangeRange,
): ts.Program;
function updateProgram(
    oldProgram: ts.Program | undefined,
    fixed: Map<string, string>,
    currentFile: ts.SourceFile,
    newContent: string,
    changeRange: ts.TextChangeRange,
): ts.Program {
    const cwd = oldProgram!.getCurrentDirectory();
    const hostBackend = ts.createCompilerHost(oldProgram!.getCompilerOptions(), true);
    const host: ts.CompilerHost = {
        getSourceFile(fileName, languageVersion, _onError, shouldCreateNewSourceFile) {
            if (!shouldCreateNewSourceFile) {
                if (fileName === currentFile.fileName)
                    return ts.updateSourceFile(currentFile, newContent, changeRange);
                const sourceFile = oldProgram && oldProgram.getSourceFile(fileName);
                if (sourceFile !== undefined)
                    return sourceFile;
            }
            let content = fixed.get(fileName);
            if (content === undefined) {
                const file = oldProgram && oldProgram.getSourceFile(fileName);
                if (file !== undefined)
                    content = file.text;
            }
            return content !== undefined
                ? ts.createSourceFile(fileName, content, languageVersion, true)
                : hostBackend.getSourceFile(fileName, languageVersion);
        },
        getDefaultLibFileName: hostBackend.getDefaultLibFileName,
        getDefaultLibLocation: hostBackend.getDefaultLibLocation,
        writeFile() {},
        getCurrentDirectory: () => cwd,
        getDirectories: hostBackend.getDirectories,
        getCanonicalFileName: hostBackend.getCanonicalFileName,
        useCaseSensitiveFileNames: hostBackend.useCaseSensitiveFileNames,
        getNewLine: hostBackend.getNewLine,
        fileExists: hostBackend.fileExists,
        readFile: hostBackend.readFile,
        realpath: hostBackend.realpath,
        resolveModuleNames: hostBackend.resolveModuleNames,
        resolveTypeReferenceDirectives: hostBackend.resolveTypeReferenceDirectives,
    };

    const program = ts.createProgram(oldProgram!.getRootFileNames(), oldProgram!.getCompilerOptions(), host, oldProgram);
    oldProgram = undefined; // remove reference to avoid capturing in closure
    return program;
}

function getFilesAndProgram(options: LintOptions, cwd: string): {files: string[], program?: ts.Program} {
    let tsconfig: string | undefined;
    if (options.project !== undefined) {
        tsconfig = checkConfigDirectory(path.resolve(cwd, options.project));
    } else if (options.files.length === 0) {
        tsconfig = findupTsconfig(cwd);
    }
    let files: string[];
    if (tsconfig === undefined) {
        files = [];
        const globOptions = {
            cwd,
            absolute: true,
            cache: {},
            ignore: options.exclude,
            nodir: true,
            realpathCache: {},
            statCache: {},
            symlinks: {},
        };
        for (const pattern of options.files)
            files.push(...glob.sync(pattern, globOptions));
        files = Array.from(new Set(files.map(unixifyPath))); // deduplicate files
        checkFilesExist(options.files, options.exclude, files, 'does not exist', cwd);
        return { files };
    }
    const program = createProgram(tsconfig, cwd);
    // TODO reverse mapping for file names
    if (options.files.length === 0) {
        const libDirectory = path.dirname(ts.getDefaultLibFilePath(program.getCompilerOptions()));
        const exclude = options.exclude.map((p) => new Minimatch(resolveGlob(p, {cwd}), {dot: true}));
        const typeRoots = ts.getEffectiveTypeRoots(program.getCompilerOptions(), {
            getCurrentDirectory() { return cwd; },
            directoryExists(dir) {
                try {
                    return fs.statSync(dir).isDirectory();
                } catch {
                    return false;
                }
            },
        });
        files = [];
        outer: for (const sourceFile of program.getSourceFiles()) {
            const {fileName} = sourceFile;
            if (path.relative(libDirectory, fileName) === path.basename(fileName))
                continue; // lib.xxx.d.ts
            if (program.isSourceFileFromExternalLibrary(sourceFile))
                continue;
            if (exclude.some((e) => e.match(fileName)))
                continue;
            if (typeRoots !== undefined) {
                for (const typeRoot of typeRoots) {
                    const relative = path.relative(typeRoot, fileName);
                    if (!relative.startsWith('..' + path.sep))
                        continue outer;
                }
            }
            files.push(fileName);
        }
    } else {
        files = program.getSourceFiles().map((f) => f.fileName);
        const patterns = options.files.map((p) => new Minimatch(resolveGlob(p, {cwd})));
        const exclude = options.exclude.map((p) => new Minimatch(resolveGlob(p, {cwd})));
        files = files.filter((f) => patterns.some((p) => p.match(f)) && !exclude.some((e) => e.match(f)));
        checkFilesExist(options.files, options.exclude, files, 'is not included in the project', cwd);
    }
    return {files, program};
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

    constructor(public config?: Configuration) {}

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
                            c = findConfiguration(fileName);
                        const processor = c && getProcessorForFile(c, fileName);
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
            const config = this.config || findConfiguration(realFile)!;
            const processor = new (loadProcessor(getProcessorForFile(config, realFile)!))(content, realFile, file, new Map());
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

function createProgram(configFile: string, cwd: string, c?: Configuration): ts.Program {
    const config = ts.readConfigFile(configFile, ts.sys.readFile);
    if (config.error !== undefined)
        throw new ConfigurationError(ts.formatDiagnostics([config.error], {
            getCanonicalFileName: (f) => f,
            getCurrentDirectory: () => cwd,
            getNewLine: () => '\n',
        }));
    const host = new ProcessorHost(c);
    const parsed = ts.parseJsonConfigFileContent(
        config.config,
        createParseConfigHost(cwd, host),
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
                getCurrentDirectory: () => cwd,
                getNewLine: () => '\n',
            }));
    }
    return ts.createProgram(parsed.fileNames, parsed.options, createCompilerHost(cwd, host));
}

function createCompilerHost(cwd: string, host: ProcessorHost): ts.CompilerHost {
    return {
        getCanonicalFileName: ts.sys.useCaseSensitiveFileNames ? (f) => f : (f) => f.toLowerCase(),
        getSourceFile(fileName, languageVersion, _onError, _shouldCreateNewSourceFile) {
            const content = host.readFile(fileName);
            return content === undefined ? undefined : ts.createSourceFile(fileName, content, languageVersion, true);
        },
        getDefaultLibFileName: ts.getDefaultLibFilePath,
        writeFile() {},
        getCurrentDirectory: () => cwd,
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

function createParseConfigHost(cwd: string, host: ProcessorHost): ts.ParseConfigHost {
    return {
        useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
        readDirectory(rootDir, extensions, excludes, includes, depth) {
            return ts.matchFiles(rootDir, extensions, excludes, includes, ts.sys.useCaseSensitiveFileNames, cwd, depth, (dir) => {
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

/** Ensure that all non-pattern arguments, that are not excluded, matched  */
function checkFilesExist(patterns: string[], ignore: string[], files: string[], errorSuffix: string, cwd: string) {
    patterns = patterns.filter((p) => !glob.hasMagic(p)).map((p) => path.resolve(cwd, p));
    if (patterns.length === 0)
        return;
    const exclude = ignore.map((p) => new Minimatch(resolveGlob(p, {cwd}), {dot: true}));
    for (const filename of patterns.filter((p) => !exclude.some((e) => e.match(p))))
        if (!files.some(createMinimatchFilter(filename)))
            throw new ConfigurationError(`'${filename}' ${errorSuffix}.`);
}
