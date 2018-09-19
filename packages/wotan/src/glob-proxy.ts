import { CachedFileSystem, FileKind } from './services/cached-file-system';
import { createGlobInterceptor } from 'glob-interceptor';

export function createGlobProxy(fs: CachedFileSystem) {
    return createGlobInterceptor({
        realpath(path) {
            return fs.realpath === undefined ? path : fs.realpath(path);
        },
        isDirectory(path) {
            switch (fs.getKind(path)) {
                case FileKind.Directory:
                    return true;
                case FileKind.NonExistent:
                    return;
                default:
                    return false;
            }
        },
        isSymbolicLink(path) {
            return fs.isSymbolicLink(path);
        },
        readDirectory(dir: string) {
            return fs.readDirectory(dir).map((entry) => entry.name);
        },
    });
}
