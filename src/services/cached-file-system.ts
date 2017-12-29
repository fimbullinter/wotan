import { injectable } from 'inversify';
import { FileSystemReader, CacheManager, CacheIdentifier } from '../types';
import bind from 'bind-decorator';

const enum FileKind {
    NonExistent,
    File = 1,
    Directory = 2,
    Other = 4,
}

const fileContent = new CacheIdentifier<string, Buffer | undefined>();
const fileKind = new CacheIdentifier<string, FileKind>();
const directoryEntries = new CacheIdentifier<string, string[]>();

@injectable()
export class CachedFileSystem {
    constructor(private fs: FileSystemReader, private cache: CacheManager) {}

    public isFile(path: string): boolean {
        return this.cache.resolve(fileKind, path, this.getKind) === FileKind.Directory;
    }

    public isDirectory(path: string): boolean {
        return this.cache.resolve(fileKind, path, this.getKind) === FileKind.Directory;
    }

    @bind
    private getKind(path: string): FileKind {
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

    public readFile(path: string): Buffer | undefined {
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
