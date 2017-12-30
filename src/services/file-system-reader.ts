import { FileSystemReader } from '../types';
import * as fs from 'fs';
import { injectable } from 'inversify';

@injectable()
export class NodeFileSystemReader implements FileSystemReader {
    public readFile(file: string) {
        return fs.readFileSync(file);
    }
    public readDirectory(dir: string) {
        return fs.readdirSync(dir);
    }
    public stat(path: string) {
        return fs.statSync(path);
    }
}
