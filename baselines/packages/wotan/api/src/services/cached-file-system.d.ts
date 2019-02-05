import { FileSystem, CacheFactory } from '@fimbul/ymir';
export declare enum FileKind {
    NonExistent = 0,
    File = 1,
    Directory = 2,
    Other = 3
}
export interface DirectoryEntryWithKind {
    name: string;
    kind: FileKind;
}
export declare class CachedFileSystem {
    private fs;
    private fileKindCache;
    private realpathCache;
    private direntCache;
    constructor(fs: FileSystem, cache: CacheFactory);
    isFile(file: string): boolean;
    isDirectory(dir: string): boolean;
    getKind(file: string): FileKind;
    private doGetKind;
    readDirectory(dir: string): {
        kind: FileKind;
        name: string;
    }[];
    readFile(file: string): string;
    realpath: ((file: string) => string) | undefined;
    writeFile(file: string, content: string): void;
    remove(file: string): void;
    createDirectory(dir: string): void;
    private doCreateDirectory;
    private updateCache;
}
