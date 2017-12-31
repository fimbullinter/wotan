import * as ts from 'typescript';
import { resolveCachedResult } from './utils';
import * as path from 'path';
import { loadProcessor } from './processor-loader';
import { FileKind, CachedFileSystem } from './services/cached-file-system';
import { Configuration, AbstractProcessor } from './types';
import { bind } from 'bind-decorator';
import { ConfigurationManager } from './services/configuration-manager';

// @internal
export interface ProcessedFileInfo {
    originalName: string;
    originalContent: string;
    processor: AbstractProcessor;
}

// @internal
export class ProjectHost implements ts.CompilerHost {
    private reverseMap = new Map<string, string>();
    private map = new Map<string, string>();
    private directoryEntries = new Map<string, ts.FileSystemEntries>();
    private processedFiles = new Map<string, ProcessedFileInfo>();
    private sourceFileCache = new Map<string, ts.SourceFile | undefined>();

    constructor(
        public cwd: string,
        public config: Configuration | undefined,
        private fs: CachedFileSystem,
        private configManager: ConfigurationManager,
    ) {}

    public getProcessedFileInfo(fileName: string) {
        return this.processedFiles.get(fileName);
    }
    public getDirectoryEntries(dir: string): ts.FileSystemEntries {
        return resolveCachedResult(this.directoryEntries, dir, this.processDirectory);
    }
    @bind
    private processDirectory(dir: string): ts.FileSystemEntries {
        const files: string[] = [];
        const directories: string[] = [];
        const result = {files, directories};
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

    public getFileSystemFile(file: string): string | undefined {
        if (/\/node_modules\//.test(file))
            return this.fs.getKind(file) === FileKind.File ? file : undefined;
        if (this.map.has(file))
            return file;
        const reverse = this.reverseMap.get(file);
        if (reverse !== undefined)
            return reverse;
        const dirname = path.dirname(file);
        if (this.directoryEntries.has(dirname))
            return;
        this.processDirectory(dirname);
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
        return resolveCachedResult(this.sourceFileCache, fileName, () => {
            const content = this.readFile(fileName);
            return content === undefined ? undefined : ts.createSourceFile(fileName, content, languageVersion, true);
        });
    }
    public updateSourceFile(
        sourceFile: ts.SourceFile,
        program: ts.Program,
        newContent: string,
        changeRange: ts.TextChangeRange,
    ): {sourceFile: ts.SourceFile, program: ts.Program} {
        sourceFile = ts.updateSourceFile(sourceFile, newContent, changeRange);
        this.sourceFileCache.set(sourceFile.fileName, sourceFile);
        program = ts.createProgram(program.getRootFileNames(), program.getCompilerOptions(), this, program);
        return {sourceFile, program};
    }
}
