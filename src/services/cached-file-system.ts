import { injectable } from 'inversify';
import { FileSystemReader, CacheManager, CacheIdentifier } from '../types';
import bind from 'bind-decorator';

export const enum FileKind {
    NonExistent,
    File,
    Directory,
    Other,
}

const fileContent = new CacheIdentifier<string, string | undefined>('fileContent');
const fileKind = new CacheIdentifier<string, FileKind>('fileKind');
const directoryEntries = new CacheIdentifier<string, string[]>('directoryEntries');

@injectable()
export class CachedFileSystem {
    constructor(private fs: FileSystemReader, private cache: CacheManager) {}

    public isFile(path: string): boolean {
        return this.cache.resolve(fileKind, path, this.getKind) === FileKind.File;
    }

    public isDirectory(path: string): boolean {
        return this.cache.resolve(fileKind, path, this.getKind) === FileKind.Directory;
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
        return this.cache.resolve(directoryEntries, path, this.doReadDirectory);
    }

    @bind
    private doReadDirectory(path: string) {
        try {
            return this.fs.readDirectory(path);
        } catch (e) {
            if (e.kind === 'ENOENT')
                this.cache.set(fileKind, path, FileKind.NonExistent);
            return [];
        }
    }

    public readFile(path: string): string | undefined {
        return this.cache.resolve(fileContent, path, this.doReadFile);
    }

    @bind
    private doReadFile(path: string) {
        try {
            return this.fs.readFile(path);
        } catch (e) {
            if (e.code === 'ENOENT')
                this.cache.set(fileKind, path, FileKind.NonExistent);
            return;
        }
    }
}
