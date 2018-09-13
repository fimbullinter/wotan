import { CachedFileSystem, FileKind } from './services/cached-file-system';

/** A minimal abstraction of FileSystem operations needed to provide a cache proxy for 'glob'. None of the methods are expected to throw. */
export interface GlobFileSystem {
    /** Returns `true` if the specified `path` is a directory, `undefined` if it doesn't exist and `false` otherwise. */
    isDirectory(path: string): boolean | undefined;
    /** Returns `true` if the specified `path` is a symlink, `false` in all other cases. */
    isSymbolicLink(path: string): boolean;
    /** Get the entries of a directory as string array. */
    readDirectory(dir: string): string[];
    /** Get the realpath of a given `path` by resolving all symlinks in the path. */
    realpath(path: string): string;
}

const directoryStats = {
    isDirectory() { return true; },
};
const otherStats = {
    isDirectory() { return false; },
};

export function createGlobFileSystem(fs: CachedFileSystem): GlobFileSystem {
    return {
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
    };
}

const propertyDescriptor = { writable: true, configurable: true };

export function createGlobProxy(fs: GlobFileSystem) {
    const cache = new Proxy<Record<string, false | 'FILE' | string[]>>({}, {
        getOwnPropertyDescriptor() {
            return propertyDescriptor;
        },
        get(_, path: string) {
            switch (fs.isDirectory(path)) {
                case true:
                    return fs.readDirectory(path);
                case false:
                    return 'FILE';
                default:
                    return false;
            }
        },
        set() {
            // ignore cache write
            return true;
        },
    });
    const statCache = new Proxy<Record<string, any>>({}, {
        get(_, path: string) {
            return fs.isDirectory(path) ? directoryStats : otherStats;

        },
        set() {
            // ignore cache write
            return true;
        },
    });
    const realpathCache = new Proxy<Record<string, string>>({}, {
        getOwnPropertyDescriptor() {
            return propertyDescriptor;
        },
        get(_, path: string) {
            return fs.realpath(path);
        },
    });
    const symlinks = new Proxy<Record<string, boolean>>({}, {
        getOwnPropertyDescriptor() {
            return propertyDescriptor;
        },
        get(_, path: string) {
            return fs.isSymbolicLink(path);
        },
    });
    return {
        cache,
        realpathCache,
        statCache,
        symlinks,
    };
}
