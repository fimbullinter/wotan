import { injectable } from 'inversify';
import { FileSystem, CacheFactory, Cache, Stats } from '@fimbul/ymir';
import bind from 'bind-decorator';
import { resolveCachedResult } from '../utils';
import * as path from 'path';

export const enum FileKind {
    NonExistent,
    File,
    Directory,
    Other,
}

export interface DirectoryEntryWithKind {
    name: string;
    kind: FileKind;
}

@injectable()
export class CachedFileSystem {
    private fileKindCache: Cache<string, FileKind>;
    private realpathCache: Cache<string, string>;
    private direntCache: Cache<string, string[]>;
    constructor(private fs: FileSystem, cache: CacheFactory) {
        this.fileKindCache = cache.create();
        this.realpathCache = cache.create();
        this.direntCache = cache.create();
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
            return statsToKind(this.fs.stat(file));
        } catch {
            return FileKind.NonExistent;
        }
    }

    public readDirectory(dir: string) {
        dir = this.fs.normalizePath(dir);
        let cachedResult = this.direntCache.get(dir);
        if (cachedResult !== undefined)
            return cachedResult.map(
                (entry) => ({kind: this.fileKindCache.get(this.fs.normalizePath(path.join(dir, entry)))!, name: entry}),
            );
        cachedResult = [];
        const result: DirectoryEntryWithKind[] = [];
        for (const entry of this.fs.readDirectory(dir)) {
            if (typeof entry === 'string') {
                cachedResult.push(entry);
                result.push({kind: this.getKind(path.join(dir, entry)), name: entry});
            } else {
                cachedResult.push(entry.name);
                const filePath = path.join(dir, entry.name);
                let kind: FileKind;
                if (entry.isSymbolicLink()) {
                    kind = this.getKind(filePath);
                } else {
                    kind = statsToKind(entry);
                    this.fileKindCache.set(this.fs.normalizePath(filePath), kind);
                }
                result.push({kind, name: entry.name});
            }
        }
        this.direntCache.set(dir, cachedResult);
        return result;
    }

    public readFile(file: string): string {
        return this.fs.readFile(this.fs.normalizePath(file));
    }

    public realpath = this.fs.realpath === undefined ? undefined : (file: string) => {
        return resolveCachedResult(this.realpathCache, this.fs.normalizePath(file), () => this.fs.realpath!(file));
    };

    public writeFile(file: string, content: string) {
        file = this.fs.normalizePath(file);
        this.fs.writeFile(file, content);
        this.updateCache(file, FileKind.File);
    }

    public remove(file: string) {
        file = this.fs.normalizePath(file);
        this.fs.deleteFile(file);
        this.updateCache(file, FileKind.NonExistent);
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
        this.updateCache(dir, FileKind.Directory);
    }

    private updateCache(file: string, kind: FileKind) {
        // this currently doesn't handle directory removal as there is no API for that
        if (this.fileKindCache.get(file) !== kind)
            return; // this is not entirely correct as there might be no cached kind, but file is already in direntCache
        this.fileKindCache.set(file, kind);
        if (kind === FileKind.NonExistent)
            this.realpathCache.delete(file); // only invalidate realpath cache on file removal
        // invalidate direntCache unconditionally as the new file's name might differ in case from the one we have here
        this.direntCache.delete(this.fs.normalizePath(path.dirname(file)));
    }
}

function statsToKind(stats: Stats) {
    return stats.isFile() ? FileKind.File : stats.isDirectory() ? FileKind.Directory : FileKind.Other;
}
