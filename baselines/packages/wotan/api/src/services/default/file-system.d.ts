import { FileSystem, Stats, MessageHandler, Dirent } from '@fimbul/ymir';
export declare class NodeFileSystem implements FileSystem {
    static normalizePath(path: string): string;
    constructor(logger: MessageHandler);
    normalizePath(path: string): string;
    readFile(file: string): string;
    readDirectory(dir: string): Array<string | Dirent>;
    stat(path: string): Stats;
    realpath(path: string): string;
    writeFile(file: string, content: string): void;
    deleteFile(path: string): void;
    createDirectory(dir: string): void;
}
