import { injectable } from 'inversify';
import { FileSystem, CacheFactory, Cache } from '@fimbul/ymir';
import bind from 'bind-decorator';
import { resolveCachedResult } from '../utils';
import * as path from 'path';

export const enum FileKind {
    NonExistent,
    File,
    Directory,
    Other,
}

@injectable()
export class CachedFileSystem {
    private fileKindCache: Cache<string, FileKind>;
    private realpathCache: Cache<string, string>;
    constructor(private fs: FileSystem, cache: CacheFactory) {
        this.fileKindCache = cache.create();
        this.realpathCache = cache.create();
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
        return this.fs.readDirectory(this.fs.normalizePath(dir));
    }

    public readFile(file: string): string {
        return this.fs.readFile(this.fs.normalizePath(file));
    }

    public realpath = this.fs.realpath === undefined ? undefined : (file: string) => {
        return resolveCachedResult(this.realpathCache, this.fs.normalizePath(file), (f) => this.fs.realpath!(f));
    };

    public writeFile(file: string, content: string) {
        file = this.fs.normalizePath(file);
        this.fs.writeFile(file, content);
        this.fileKindCache.set(file, FileKind.File);
    }

    public remove(file: string) {
        file = this.fs.normalizePath(file);
        this.fs.deleteFile(file);
        this.fileKindCache.set(file, FileKind.NonExistent);
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
                const parent = this.fs.normalizePath(path.dirname(dir));
                if (parent === dir)
                    throw e;
                this.doCreateDirectory(parent);
                this.fs.createDirectory(dir);
            }
        }
        this.fileKindCache.set(dir, FileKind.Directory);
    }
}
