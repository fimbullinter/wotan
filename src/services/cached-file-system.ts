import { injectable } from 'inversify';
import { FileSystem, CacheManager, CacheIdentifier, Cache } from '../types';
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
    constructor(private fs: FileSystem, cache: CacheManager) {
        this.fileKindCache = cache.create(fileKind);
        this.fileContentCache = cache.create(fileContent);
        this.directoryEntryCache = cache.create(directoryEntries);
        this.realpathCache = cache.create(realpathCache);
    }

    public isFile(file: string): boolean {
        return resolveCachedResult(this.fileKindCache, this.fs.normalizePath(file), this.doGetKind) === FileKind.File;
    }

    public isDirectory(dir: string): boolean {
        return resolveCachedResult(this.fileKindCache, this.fs.normalizePath(dir), this.doGetKind) === FileKind.Directory;
    }

    public getKind(file: string): FileKind {
        return resolveCachedResult(this.fileKindCache, this.fs.normalizePath(file), this.doGetKind);
    }

    @bind
    private doGetKind(file: string): FileKind {
        try {
            const stat = this.fs.stat(file);
            return stat.isFile() ? FileKind.File : stat.isDirectory() ? FileKind.Directory : FileKind.Other;
        } catch {
            return FileKind.NonExistent;
        }
    }

    public readDirectory(dir: string): string[] {
        return resolveCachedResult(this.directoryEntryCache, this.fs.normalizePath(dir), this.doReadDirectory);
    }

    @bind
    private doReadDirectory(dir: string) {
        try {
            return this.fs.readDirectory(dir);
        } catch {
            return [];
        }
    }

    public readFile(file: string): string | undefined {
        return resolveCachedResult(this.fileContentCache, this.fs.normalizePath(file), this.doReadFile);
    }

    @bind
    private doReadFile(file: string) {
        try {
            return this.fs.readFile(file);
        } catch {
            return;
        }
    }

    public realpath = this.fs.realpath === undefined ? undefined : (file: string) => {
        return resolveCachedResult(this.realpathCache, this.fs.normalizePath(file), () => this.fs.realpath!(file));
    };

    public writeFile(file: string, content: string) {
        file = this.fs.normalizePath(file);
        this.fs.writeFile(file, content);
        this.fileContentCache.set(file, content);
        this.fileKindCache.set(file, FileKind.File);
        const dirname = path.posix.dirname(file);
        const entries = this.directoryEntryCache.get(dirname);
        if (entries !== undefined) {
            const basename = path.basename(file);
            if (!entries.includes(basename))
                entries.push(basename);
        }
    }

    public remove(file: string) {
        file = this.fs.normalizePath(file);
        this.fs.deleteFile(file);
        this.fileContentCache.set(file, undefined);
        this.fileKindCache.set(file, FileKind.NonExistent);
        const dirname = path.posix.dirname(file);
        const entries = this.directoryEntryCache.get(dirname);
        if (entries !== undefined) {
            const basename = path.basename(file);
            const index = entries.indexOf(basename);
            if (index !== -1)
                entries.splice(index, 1);
        }
    }

    public createDirectory(dir: string) {
        dir = this.fs.normalizePath(dir);
        if (this.fileKindCache.get(dir) === FileKind.Directory)
            return;
        return this.doCreateDirectory(dir);
    }

    private doCreateDirectory(dir: string): void {
        try {
            this.fs.createDirectory(dir);
        } catch (e) {
            try {
                const stat = this.fs.stat(dir);
                if (!stat.isDirectory())
                    throw e;
            } catch {
                const parent = path.posix.dirname(dir);
                if (parent === dir)
                    throw e;
                this.doCreateDirectory(parent);
                this.fs.createDirectory(dir);
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
