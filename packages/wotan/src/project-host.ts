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
        let entries: string[];
        try {
            entries = this.fs.readDirectory(dir);
        } catch {
            return result;
        }
        for (const entry of entries) {
            const fileName = `${dir}/${entry}`;
            switch (this.fs.getKind(fileName)) {
                case FileKind.File: {
                    if (!hasSupportedExtension(fileName, additionalExtensions)) {
                        const c = this.config || this.tryFindConfig(fileName);
                        const processor = c && this.configManager.getProcessor(c, fileName);
                        if (processor) {
                            const ctor = this.processorLoader.loadProcessor(processor);
                            const newName = fileName +
                                ctor.getSuffixForFile({
                                    fileName,
                                    getSettings: () => this.configManager.getSettings(c!, fileName),
                                    readFile: () => this.fs.readFile(fileName),
                                });
                            if (hasSupportedExtension(newName, additionalExtensions)) {
                                files.push(newName);
                                this.reverseMap.set(newName, fileName);
                                break;
                            }
                        }
                    }
                    files.push(fileName);
                    this.files.push(fileName);
                    break;
                }
                case FileKind.Directory:
                    directories.push(fileName);
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
    public getCanonicalFileName = ts.sys.useCaseSensitiveFileNames ? (f: string) => f : (f: string) => f.toLowerCase();
    public getNewLine() {
        return '\n';
    }
    public realpath = this.fs.realpath === undefined ? undefined : (fileName: string) => this.fs.realpath!(fileName);
    public getCurrentDirectory() {
        return this.cwd;
    }
    public getDirectories(dir: string) {
        const cached = this.directoryEntries.get(dir);
        if (cached !== undefined)
            return cached.directories.map((d) => path.posix.basename(d));
        return this.fs.readDirectory(dir).filter((f) => this.fs.isDirectory(path.join(dir, f)));
    }
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
        return projectReferences === undefined
            ? ts.createProgram(rootNames, options, this, oldProgram) // for compatibility with TypeScript@<3.0.0
            : ts.createProgram({
                rootNames,
                options,
                oldProgram,
                projectReferences,
                host: this,
            });
    }

    public updateSourceFile(
        sourceFile: ts.SourceFile,
        program: ts.Program,
        newContent: string,
        _changeRange: ts.TextChangeRange,
    ): {sourceFile: ts.SourceFile, program: ts.Program} {
        // TODO use updateSourceFile once https://github.com/Microsoft/TypeScript/issues/26166 is resolved
        sourceFile = ts.createSourceFile(sourceFile.fileName, newContent, sourceFile.languageVersion, true);
        this.sourceFileCache.set(sourceFile.fileName, sourceFile);
        const references = program.getProjectReferences && // for compatibility with TypeScript@<3.0.0
            program.getProjectReferences();

        program = this.createProgram(
            program.getRootFileNames(),
            program.getCompilerOptions(),
            program,
            references && mapDefined(references, (ref) => ref && {path: ref.sourceFile.fileName}),
        );
        return {sourceFile, program};
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
}
