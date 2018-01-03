import { FileSystemReader, FileSystemWriter } from '../../types';
import * as fs from 'fs';
import { injectable } from 'inversify';

@injectable()
export class NodeFileSystem implements FileSystemReader, FileSystemWriter {
    public readFile(file: string) {
        const buf = fs.readFileSync(file);
        const len = buf.length;
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
    public readDirectory(dir: string) {
        return fs.readdirSync(dir);
    }
    public stat(path: string) {
        return fs.statSync(path);
    }
    public realpath(path: string) {
        return fs.realpathSync(path);
    }
    public writeFile(file: string, content: string) {
        return fs.writeFileSync(file, content);
    }
    public remove(path: string) {
        return fs.unlinkSync(path);
    }
    public createDirectory(dir: string): void {
        return fs.mkdirSync(dir);
    }
}
