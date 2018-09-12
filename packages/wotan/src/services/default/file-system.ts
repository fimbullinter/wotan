import { FileSystem, Stats, MessageHandler, Dirent, LStats } from '@fimbul/ymir';
import * as fs from 'fs';
import { injectable } from 'inversify';
import { unixifyPath } from '../../utils';
import * as ts from 'typescript';

@injectable()
export class NodeFileSystem implements FileSystem {
    public static normalizePath(path: string) {
        return unixifyPath(ts.sys.useCaseSensitiveFileNames ? path : path.toLowerCase());
    }
    constructor(private logger: MessageHandler) {}

    public normalizePath(path: string) {
        return NodeFileSystem.normalizePath(path);
    }
    public readFile(file: string) {
        const buf = fs.readFileSync(file);
        const len = buf.length;
        // detect MPEG TS files and treat them as empty
        outer: while (len > 188 && buf[0] === 0x47) {
            for (let i = 188; i < len; i += 188)
                if (buf[i] !== 0x47)
                    break outer;
            this.logger.warn(`Detected MPEG TS file: '${file}'.`);
            return '';
        }
        if (len >= 2) {
            if (buf[0] === 0xFE && buf[1] === 0xFF) // UTF16BE BOM
                return buf.swap16().toString('utf16le', 2);
            if (buf[0] === 0xFF && buf[1] === 0xFE) // UTF16LE BOM
                return buf.toString('utf16le', 2);
            if (len >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) // UTF8 with BOM
                return buf.toString('utf8');
        }
        return buf.toString('utf8'); // default to UTF8 without BOM
    }
    public readDirectory(dir: string): Array<string | Dirent> {
        return fs.readdirSync(dir, <any>{withFileTypes: true});
    }
    public stat(path: string): Stats {
        return fs.statSync(path);
    }
    public lstat(path: string): LStats {
        return fs.lstatSync(path);
    }
    public realpath(path: string) {
        return fs.realpathSync(path);
    }
    public writeFile(file: string, content: string) {
        return fs.writeFileSync(file, content);
    }
    public deleteFile(path: string) {
        return fs.unlinkSync(path);
    }
    public createDirectory(dir: string): void {
        return fs.mkdirSync(dir);
    }
}
