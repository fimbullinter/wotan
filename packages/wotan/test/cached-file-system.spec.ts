import test from 'ava';
import { CachedFileSystem, FileKind } from '../src/services/cached-file-system';
import { DefaultCacheFactory } from '../src/services/default/cache-factory';
import { NodeFileSystem } from '../src/services/default/file-system';
import { MessageHandler, Dirent } from '@fimbul/ymir';

const dummyLogger: MessageHandler = {
    log() {},
    warn() {},
    error() {},
};

function makeDirent(name: string, kind: 'FILE' | 'DIR' | 'SYMLINK') {
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

function makeStat(kind: 'FILE' | 'DIR' | 'OTHER') {
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
                    default:
                        throw new Error('not expected');
                }
            }
        }(dummyLogger),
        new DefaultCacheFactory(),
    );

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

    t.throws(() => fs.readDirectory('/non-existent'), 'ENOENT');

    // ensure values are cached
    throwError = true;
    // fs.readDirectory('/plain');
    // fs.readDirectory('/dirent');
    // fs.readDirectory('/mixed');

    t.true(fs.isDirectory('/plain/b'));
    t.false(fs.isDirectory('/plain/a'));
    t.true(fs.isFile('/plain/a'));
    t.true(fs.isDirectory('/dirent/dir'));
    t.false(fs.isDirectory('/dirent/file'));
    t.true(fs.isFile('/dirent/file'));
    t.false(fs.isDirectory('/mixed/a'));
    t.false(fs.isDirectory('/mixed/a'));
});
