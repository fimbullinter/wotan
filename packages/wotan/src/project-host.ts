import * as ts from 'typescript';
import { resolveCachedResult, hasSupportedExtension, mapDefined } from './utils';
import * as path from 'path';
import { ProcessorLoader } from './services/processor-loader';
import { FileKind, CachedFileSystem } from './services/cached-file-system';
import { Configuration, AbstractProcessor } from '@fimbul/ymir';
import { bind } from 'bind-decorator';
import { ConfigurationManager } from './services/configuration-manager';
import debug = require('debug');

const log = debug('wotan:projectHost');

const additionalExtensions = ['.json'];

// @internal
export interface ProcessedFileInfo {
    originalName: string;
    originalContent: string; // TODO this should move into processor because this property is never updated, but the processor is
    processor: AbstractProcessor;
}

// @internal
export class ProjectHost implements ts.CompilerHost {
    private reverseMap = new Map<string, string>();
    private files: string[] = [];
    private directoryEntries = new Map<string, ts.FileSystemEntries>();
    private processedFiles = new Map<string, ProcessedFileInfo>();
    private sourceFileCache = new Map<string, ts.SourceFile | undefined>();
    private fileContent = new Map<string, string>();
    private tsconfigCache = new Map<string, ts.ExtendedConfigCacheEntry>();
    private commandLineCache = new Map<string, ts.ParsedCommandLine>();

    private parseConfigHost: ts.ParseConfigHost = {
        useCaseSensitiveFileNames: this.useCaseSensitiveFileNames(),
        readDirectory:
            (rootDir, extensions, excludes, includes, depth) => this.readDirectory(rootDir, extensions, excludes, includes, depth),
        fileExists: (f) => this.fileExists(f),
        readFile: (f) => this.readFile(f),
    };

    public getCanonicalFileName = ts.sys.useCaseSensitiveFileNames ? (f: string) => f : (f: string) => f.toLowerCase();
    private moduleResolutionCache = ts.createModuleResolutionCache(this.cwd, this.getCanonicalFileName);
    private compilerOptions: ts.CompilerOptions = {};

    constructor(
        public cwd: string,
        public config: Configuration | undefined,
        private fs: CachedFileSystem,
        private configManager: ConfigurationManager,
        private processorLoader: ProcessorLoader,
    ) {}

    public getProcessedFileInfo(fileName: string) {
        return this.processedFiles.get(fileName);
    }
    public readDirectory(
        rootDir: string,
        extensions: ReadonlyArray<string>,
        excludes: ReadonlyArray<string> | undefined,
        includes: ReadonlyArray<string>,
        depth?: number,
    ) {
        return ts.matchFiles(
            rootDir,
            extensions,
            excludes,
            includes,
            this.useCaseSensitiveFileNames(),
            this.cwd,
            depth,
            (dir) => resolveCachedResult(this.directoryEntries, dir, this.processDirectory),
            (f) => this.safeRealpath(f),
            (path) => this.directoryExists(path),
        );
    }
    /**
     * Try to find and load the configuration for a file.
     * If it fails, just continue as if there was no config.
     * This may happen during project setup if there is an invalid config file anywhere in a scanned folder.
     */
    private tryFindConfig(file: string) {
        try {
            return this.configManager.find(file);
        } catch (e) {
            log("Error while loading configuration for '%s': %s", file, e.message);
            return;
        }
    }
    @bind
    private processDirectory(dir: string): ts.FileSystemEntries {
        const files: string[] = [];
        const directories: string[] = [];
        const result: ts.FileSystemEntries = {files, directories};
        let entries;
        try {
            entries = this.fs.readDirectory(dir);
        } catch {
            return result;
        }
        for (const entry of entries) {
            switch (entry.kind) {
                case FileKind.File: {
                    const fileName = `${dir}/${entry.name}`;
                    if (!hasSupportedExtension(fileName, additionalExtensions)) {
                        const c = this.config || this.tryFindConfig(fileName);
                        const processor = c && this.configManager.getProcessor(c, fileName);
                        if (processor) {
                            const ctor = this.processorLoader.loadProcessor(processor);
                            const suffix = ctor.getSuffixForFile({
                                fileName,
                                getSettings: () => this.configManager.getSettings(c!, fileName),
                                readFile: () => this.fs.readFile(fileName),
                            });
                            const newName = fileName + suffix;

                            if (hasSupportedExtension(newName, additionalExtensions)) {
                                files.push(entry.name + suffix);
                                this.reverseMap.set(newName, fileName);
                                break;
                            }
                        }
                    }
                    files.push(entry.name);
                    this.files.push(fileName);
                    break;
                }
                case FileKind.Directory:
                    directories.push(entry.name);
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
            default:
                return hasSupportedExtension(file, additionalExtensions) && this.getFileSystemFile(file) !== undefined;
        }
    }

    public directoryExists(dir: string) {
        return this.fs.isDirectory(dir);
    }

    public getFileSystemFile(file: string): string | undefined {
        if (this.files.includes(file))
            return file;
        const reverse = this.reverseMap.get(file);
        if (reverse !== undefined)
            return reverse;
        const dirname = path.posix.dirname(file);
        if (this.directoryEntries.has(dirname))
            return;
        if (this.fs.isFile(file))
            return file;
        this.directoryEntries.set(dirname, this.processDirectory(dirname));
        return this.getFileSystemFile(file);
    }

    public readFile(file: string) {
        return resolveCachedResult(this.fileContent, file, (f) => this.fs.readFile(f));
    }

    private readProcessedFile(file: string): string | undefined {
        const realFile = this.getFileSystemFile(file);
        if (realFile === undefined)
            return;
        let content = this.fs.readFile(realFile);
        const config = this.config || this.tryFindConfig(realFile);
        if (config === undefined)
            return content;
        const processorPath = this.configManager.getProcessor(config, realFile);
        if (processorPath === undefined)
            return content;
        const ctor = this.processorLoader.loadProcessor(processorPath);
        const processor = new ctor({
            source: content,
            sourceFileName: realFile,
            targetFileName: file,
            settings: this.configManager.getSettings(config, realFile),
        });
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
    public getNewLine() {
        return this.compilerOptions.newLine === ts.NewLineKind.CarriageReturnLineFeed ? '\r\n' : '\n';
    }
    public realpath = this.fs.realpath === undefined ? undefined : (fileName: string) => this.fs.realpath!(fileName);
    private safeRealpath(f: string) {
        if (this.realpath !== undefined) {
            try {
                return this.realpath(f);
            } catch {}
        }
        return f;
    }
    public getCurrentDirectory() {
        return this.cwd;
    }
    public getDirectories(dir: string) {
        const cached = this.directoryEntries.get(dir);
        if (cached !== undefined)
            return cached.directories.slice();
        return mapDefined(
            this.fs.readDirectory(dir),
            (entry) => entry.kind === FileKind.Directory ? entry.name : undefined,
        );
    }
    public getSourceFile(fileName: string, languageVersion: ts.ScriptTarget.JSON): ts.JsonSourceFile | undefined;
    public getSourceFile(fileName: string, languageVersion: ts.ScriptTarget): ts.SourceFile | undefined;
    public getSourceFile(fileName: string, languageVersion: ts.ScriptTarget) {
        return resolveCachedResult(
            this.sourceFileCache,
            fileName,
            () => {
                const content = this.readProcessedFile(fileName);
                return content !== undefined ? ts.createSourceFile(fileName, content, languageVersion, true) : undefined;
            },
        );
    }

    public createProgram(
        rootNames: ReadonlyArray<string>,
        options: ts.CompilerOptions,
        oldProgram: ts.Program | undefined,
        projectReferences: ReadonlyArray<ts.ProjectReference> | undefined,
    ) {
        options = {...options, suppressOutputPathCheck: true};
        this.compilerOptions = options;
        this.moduleResolutionCache = ts.createModuleResolutionCache(this.cwd, this.getCanonicalFileName, options);
        return ts.createProgram({rootNames, options, oldProgram, projectReferences, host: this});
    }

    public updateSourceFile(sourceFile: ts.SourceFile) {
        this.sourceFileCache.set(sourceFile.fileName, sourceFile);
    }

    public updateProgram(program: ts.Program) {
        return ts.createProgram({
            rootNames: program.getRootFileNames(),
            options: program.getCompilerOptions(),
            oldProgram: program,
            projectReferences: program.getProjectReferences(),
            host: this,
        });
    }

    public onReleaseOldSourceFile(sourceFile: ts.SourceFile) {
        // this is only called for paths that are no longer referenced
        // it's safe to remove the cache entry completely because it won't be called with updated SourceFiles
        this.uncacheFile(sourceFile.fileName);
    }

    public uncacheFile(fileName: string) {
        this.sourceFileCache.delete(fileName);
        this.processedFiles.delete(fileName);
    }

    public getParsedCommandLine(fileName: string) {
        return resolveCachedResult(this.commandLineCache, fileName, this.parseConfigFile);
    }

    @bind
    private parseConfigFile(fileName: string) {
        // Note to future self: it's highly unlikely that a tsconfig of a project reference is used as base config for another tsconfig.
        // Therefore it doesn't make such sense to read or write the tsconfigCache here.
        const sourceFile = this.getSourceFile(fileName, ts.ScriptTarget.JSON);
        if (sourceFile === undefined)
            return;
        return ts.parseJsonSourceFileConfigFileContent(
            sourceFile,
            this.parseConfigHost,
            path.dirname(fileName),
            undefined,
            fileName,
            undefined,
            undefined,
            this.tsconfigCache,
        );
    }

    public resolveModuleNames(
        names: string[],
         file: string,
         _: unknown | undefined,
         reference: ts.ResolvedProjectReference | undefined,
         options: ts.CompilerOptions,
    ) {
        const seen = new Map<string, ts.ResolvedModuleFull | undefined>();
        const resolve = (name: string) =>
            ts.resolveModuleName(name, file, options, this, this.moduleResolutionCache, reference).resolvedModule;
        return names.map((name) => resolveCachedResult(seen, name, resolve));
    }
}

// @internal
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
        realpath: (path: string) => string,
        directoryExists: (path: string) => boolean,
    ): string[];

    interface FileSystemEntries {
        readonly files: ReadonlyArray<string>;
        readonly directories: ReadonlyArray<string>;
    }
}
