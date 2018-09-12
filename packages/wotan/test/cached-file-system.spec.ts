import test from 'ava';
import { CachedFileSystem, FileKind } from '../src/services/cached-file-system';
import { DefaultCacheFactory } from '../src/services/default/cache-factory';
import { NodeFileSystem } from '../src/services/default/file-system';
import { MessageHandler, Dirent, Stats } from '@fimbul/ymir';

const dummyLogger: MessageHandler = {
    log() {},
    warn() {},
    error() {},
};

function makeDirent(name: string, kind: 'FILE' | 'DIR' | 'SYMLINK'): Dirent {
    return {
        name,
        isFile() {
            return kind === 'FILE';
        },
        isDirectory() {
            return kind === 'DIR';
        },
        isSymbolicLink() {
            return kind === 'SYMLINK';
        },
    };
}

function makeStat(kind: 'FILE' | 'DIR' | 'OTHER'): Stats {
    return {
        isFile() {
            return kind === 'FILE';
        },
        isDirectory() {
            return kind === 'DIR';
        },
    };
}

test('readDirectory', (t) => {
    let throwError = false;
    const fs = new CachedFileSystem(
        new class extends NodeFileSystem {
            public readDirectory(dir: string): Array<string | Dirent> {
                if (throwError)
                    throw new Error('unexpected IO operation');
                switch (dir) {
                    case '/plain':
                        return ['a', 'b'];
                    case '/dirent':
                        return [
                            makeDirent('dir', 'DIR'),
                            makeDirent('file', 'FILE'),
                            makeDirent('link', 'SYMLINK'),
                        ];
                    case '/mixed':
                        return [
                            'a',
                            makeDirent('b', 'FILE'),
                        ];
                    case '/':
                        return [
                            'a',
                            makeDirent('b', 'SYMLINK'),
                        ];
                    default:
                        throw new Error('ENOENT');
                }
            }
            public stat(file: string) {
                if (throwError)
                    throw new Error('unexpected IO operation');
                switch (file) {
                    case '/plain/a':
                        return makeStat('FILE');
                    case '/plain/b':
                        return makeStat('DIR');
                    case '/dirent/link':
                        return makeStat('FILE');
                    case '/mixed/a':
                        return makeStat('OTHER');
                    case '/a':
                        return makeStat('FILE');
                    case '/b':
                        return makeStat('DIR');
                    default:
                        throw new Error('not expected');
                }
            }
            public deleteFile() {}
            public writeFile() {}
            public createDirectory() {}
        }(dummyLogger),
        new DefaultCacheFactory(),
    );

    function checkDirents() {
        t.deepEqual(
            fs.readDirectory('/plain'),
            [{name: 'a', kind: FileKind.File}, {name: 'b', kind: FileKind.Directory}],
            'converts plain strings',
        );

        t.deepEqual(
            fs.readDirectory('/dirent'),
            [{name: 'dir', kind: FileKind.Directory}, {name: 'file', kind: FileKind.File}, {name: 'link', kind: FileKind.File}],
            'handles Dirent and symlinks',
        );

        t.deepEqual(
            fs.readDirectory('/mixed'),
            [{name: 'a', kind: FileKind.Other}, {name: 'b', kind: FileKind.File}],
            'handles mixed string and Dirent array',
        );

        t.deepEqual(
            fs.readDirectory('/'),
            [{name: 'a', kind: FileKind.File}, {name: 'b', kind: FileKind.Directory}],
            'correctly handles root directory',
        );
    }

    checkDirents();

    t.throws(() => fs.readDirectory('/non-existent'), 'ENOENT');

    // ensure values are cached
    throwError = true;
    checkDirents();

    t.true(fs.isDirectory('/plain/b'));
    t.false(fs.isDirectory('/plain/a'));
    t.true(fs.isFile('/plain/a'));
    t.true(fs.isDirectory('/dirent/dir'));
    t.false(fs.isDirectory('/dirent/file'));
    t.true(fs.isFile('/dirent/file'));
    t.false(fs.isDirectory('/mixed/a'));
    t.false(fs.isDirectory('/mixed/a'));
    t.true(fs.isDirectory('/b'));

    // ensure cache is cleaned on delete
    fs.remove('/plain/a');
    t.throws(() => fs.readDirectory('/plain'));
    t.is(fs.getKind('/plain/a'), FileKind.NonExistent);

    // file kind doesn't change, cache doesn't need to be invalidated
    fs.writeFile('/mixed/b', '');
    fs.readDirectory('/mixed');
    t.is(fs.getKind('/mixed/b'), FileKind.File);

    // new file is added
    fs.writeFile('/dirent/new', '');
    t.throws(() => fs.readDirectory('/dirent'));
    t.is(fs.getKind('/dirent/new'), FileKind.File);

    // new directory is added
    fs.createDirectory('/dir');
    t.throws(() => fs.readDirectory('/'));
    t.true(fs.isDirectory('/dir'));
});
