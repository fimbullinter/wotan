import { CachedFileSystem, FileKind } from './services/cached-file-system';

export interface GlobFileSystem {
    realpathSync(path: string): string;
    statSync(path: string): { isDirectory(): boolean; };
    lstatSync(path: string): { isSymbolicLink(): boolean; };
    readdirSync(dir: string): string[];
}

const symlinkStats = {
    isDirectory() { return false; },
    isSymbolicLink() { return true; },
};
const directoryStats = {
    isDirectory() { return true; },
    isSymbolicLink() { return false; },
};
const otherStats = {
    isDirectory() { return false; },
    isSymbolicLink() { return false; },
};

export function createGlobFileSystem(fs: CachedFileSystem): GlobFileSystem {
    return {
        realpathSync(path) {
            return fs.realpath === undefined ? path : fs.realpath(path);
        },
        statSync(path) {
            const kind = fs.getKind(path);
            switch (kind) {
                case FileKind.Directory:
                    return directoryStats;
                case FileKind.NonExistent:
                    throw new Error('ENOENT');
                default:
                    return otherStats;
            }
        },
        lstatSync(path) {
            return fs.isSymbolicLink(path) ? symlinkStats : otherStats;
        },
        readdirSync(dir: string) {
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
            try {
                if (!fs.statSync(path).isDirectory())
                    return 'FILE';
            } catch {
                return false;
            }
            try {
                return fs.readdirSync(path);
            } catch {
                return [];
            }
        },
        set() {
            // ignore cache write
            return true;
        },
    });
    const statCache = new Proxy<Record<string, any>>({}, {
        get(_, path: string) {
            try {
                return fs.statSync(path).isDirectory() ? directoryStats : otherStats;
            } catch {
                return false;
            }
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
            try {
                return fs.realpathSync(path);
            } catch {
                return path;
            }
        },
    });
    const symlinks = new Proxy<Record<string, boolean>>({}, {
        getOwnPropertyDescriptor() {
            return propertyDescriptor;
        },
        get(_, path: string) {
            try {
                return fs.lstatSync(path).isSymbolicLink();
            } catch {
                return false;
            }
        },
    });
    return {
        cache,
        realpathCache,
        statCache,
        symlinks,
    };
}
