import { injectable } from 'inversify';
import { FileSystemReader, CacheManager, CacheIdentifier, Cache, FileSystemWriter } from '../types';
import bind from 'bind-decorator';
import { resolveCachedResult } from '../utils';
import * as path from 'path';

export const enum FileKind {
    NonExistent,
    File,
    Directory,
    Other,
}

const fileContent = new CacheIdentifier<string, string | undefined>('fileContent');
const fileKind = new CacheIdentifier<string, FileKind>('fileKind');
const directoryEntries = new CacheIdentifier<string, string[]>('directoryEntries');
const realpathCache = new CacheIdentifier<string, string>('realpath');

@injectable()
export class CachedFileSystem {
    private fileKindCache: Cache<string, FileKind>;
    private fileContentCache: Cache<string, string | undefined>;
    private directoryEntryCache: Cache<string, string[]>;
    private realpathCache: Cache<string, string>;
    constructor(private reader: FileSystemReader, private writer: FileSystemWriter, cache: CacheManager) {
        this.fileKindCache = cache.create(fileKind);
        this.fileContentCache = cache.create(fileContent);
        this.directoryEntryCache = cache.create(directoryEntries);
        this.realpathCache = cache.create(realpathCache);
    }

    public isFile(file: string): boolean {
        return resolveCachedResult(this.fileKindCache, file, this.getKind) === FileKind.File;
    }

    public isDirectory(dir: string): boolean {
        return resolveCachedResult(this.fileKindCache, dir, this.getKind) === FileKind.Directory;
    }

    @bind
    public getKind(file: string): FileKind {
        try {
            const stat = this.reader.stat(file);
            return stat.isFile() ? FileKind.File : stat.isDirectory() ? FileKind.Directory : FileKind.Other;
        } catch {
            return FileKind.NonExistent;
        }
    }

    public readDirectory(dir: string): string[] {
        return resolveCachedResult(this.directoryEntryCache, dir, this.doReadDirectory);
    }

    @bind
    private doReadDirectory(dir: string) {
        try {
            return this.reader.readDirectory(dir);
        } catch {
            return [];
        }
    }

    public readFile(file: string): string | undefined {
        return resolveCachedResult(this.fileContentCache, file, this.doReadFile);
    }

    @bind
    private doReadFile(file: string) {
        try {
            return this.reader.readFile(file);
        } catch {
            return;
        }
    }

    public realpath = this.reader.realpath === undefined ? undefined : (file: string) => {
        return resolveCachedResult(this.realpathCache, file, () => this.reader.realpath!(file));
    };

    public writeFile(file: string, content: string) {
        this.writer.writeFile(file, content);
        this.fileContentCache.set(file, content);
        this.fileKindCache.set(file, FileKind.File);
        const dirname = path.dirname(file);
        const entries = this.directoryEntryCache.get(dirname);
        if (entries !== undefined) {
            const basename = path.basename(file);
            if (!entries.includes(basename))
                entries.push(basename);
        }
    }

    public remove(file: string) {
        this.writer.remove(file);
        this.fileContentCache.set(file, undefined);
        this.fileKindCache.set(file, FileKind.NonExistent);
        const dirname = path.dirname(file);
        const entries = this.directoryEntryCache.get(dirname);
        if (entries !== undefined) {
            const basename = path.basename(file);
            const index = entries.indexOf(basename);
            if (index !== -1)
                entries.splice(index, 1);
        }
    }

    public createDirectory(dir: string) {
        switch (this.fileKindCache.get(dir)) {
            case FileKind.Directory:
                return;
            case undefined:
            case FileKind.NonExistent:
                return this.doCreateDirectory(dir);
            default:
                throw new Error(`File already exists: '${dir}'.`);
        }
    }

    private doCreateDirectory(dir: string): void {
        try {
            this.writer.createDirectory(dir);
        } catch (e) {
            try {
                const stat = this.reader.stat(dir);
                if (!stat.isDirectory())
                    throw e;
            } catch {
                const parent = path.dirname(dir);
                if (parent === dir)
                    throw e;
                this.doCreateDirectory(parent);
                this.writer.createDirectory(dir);
            }
        }
        this.fileKindCache.set(dir, FileKind.Directory);
        const dirname = path.dirname(dir);
        const entries = this.directoryEntryCache.get(dirname);
        if (entries !== undefined) {
            const basename = path.basename(dir);
            if (!entries.includes(basename))
                entries.push(basename);
        }
    }
}
