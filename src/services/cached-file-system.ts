import { injectable } from 'inversify';
import { FileSystemReader, CacheManager, CacheIdentifier, Cache } from '../types';
import bind from 'bind-decorator';
import { resolveCachedResult } from '../utils';

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
    constructor(private fs: FileSystemReader, cache: CacheManager) {
        this.fileKindCache = cache.create(fileKind);
        this.fileContentCache = cache.create(fileContent);
        this.directoryEntryCache = cache.create(directoryEntries);
        this.realpathCache = cache.create(realpathCache);
    }

    public isFile(path: string): boolean {
        return resolveCachedResult(this.fileKindCache, path, this.getKind) === FileKind.File;
    }

    public isDirectory(path: string): boolean {
        return resolveCachedResult(this.fileKindCache, path, this.getKind) === FileKind.Directory;
    }

    @bind
    public getKind(path: string): FileKind {
        try {
            const stat = this.fs.stat(path);
            return stat.isFile() ? FileKind.File : stat.isDirectory() ? FileKind.Directory : FileKind.Other;
        } catch {
            return FileKind.NonExistent;
        }
    }

    public readDirectory(path: string): string[] {
        return resolveCachedResult(this.directoryEntryCache, path, this.doReadDirectory);
    }

    @bind
    private doReadDirectory(path: string) {
        try {
            return this.fs.readDirectory(path);
        } catch (e) {
            if (e.kind === 'ENOENT')
                this.fileKindCache.set(path, FileKind.NonExistent);
            return [];
        }
    }

    public readFile(path: string): string | undefined {
        return resolveCachedResult(this.fileContentCache, path, this.doReadFile);
    }

    @bind
    private doReadFile(path: string) {
        try {
            return this.fs.readFile(path);
        } catch (e) {
            if (e.code === 'ENOENT')
                this.fileKindCache.set(path, FileKind.NonExistent);
            return;
        }
    }

    public realpath = this.fs.realpath === undefined ? undefined : (path: string) => {
        return resolveCachedResult(this.realpathCache, path, () => this.fs.realpath!(path));
    };
}
