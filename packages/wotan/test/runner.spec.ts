import 'reflect-metadata';
import test from 'ava';
import { Container, injectable, BindingScopeEnum } from 'inversify';
import { createCoreModule } from '../src/di/core.module';
import { createDefaultModule } from '../src/di/default.module';
import { Runner } from '../src/runner';
import * as path from 'path';
import { NodeFileSystem } from '../src/services/default/file-system';
import { FileSystem, MessageHandler, DirectoryService, FileSummary } from '@fimbul/ymir';
import { unixifyPath } from '../src/utils';
import * as fs from 'fs';

const directories: DirectoryService = {
    getCurrentDirectory() { return path.resolve('packages/wotan'); },
};
test('throws error on non-existing file', (t) => {
    const container = new Container({defaultScope: BindingScopeEnum.Singleton});
    container.bind(DirectoryService).toConstantValue(directories);
    container.load(createCoreModule({}), createDefaultModule());
    const runner = container.get(Runner);
    t.throws(
        () => Array.from(runner.lintCollection({
            config: undefined,
            files: [
                'test/fixtures/invalid.js', // exists
                'non-existent.js', // does not exist, but is excluded
                'non-existent/*.ts', // does not match, but has magic
                'non-existent.ts', // does not exist
            ],
            exclude: ['*.js'],
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
        })),
        `'${unixifyPath(path.resolve('packages/wotan/non-existent.ts'))}' does not exist.`,
    );
});

test('throws error on file not included in project', (t) => {
    const container = new Container({defaultScope: BindingScopeEnum.Singleton});
    container.bind(DirectoryService).toConstantValue(directories);
    container.load(createCoreModule({}), createDefaultModule());
    const runner = container.get(Runner);
    t.throws(
        () => Array.from(runner.lintCollection({
            config: undefined,
            files: [
                'non-existent.js', // does not exist, but is excluded
                'non-existent/*.ts', // does not match, but has magic
                'non-existent.ts', // does not exist
            ],
            exclude: ['*.js'],
            project: ['test/project/setup'],
            references: false,
            fix: false,
            extensions: undefined,
        })),
        `'${unixifyPath(path.resolve('packages/wotan/non-existent.ts'))}' is not included in any of the projects: '${
            unixifyPath(path.resolve('packages/wotan/test/project/setup/tsconfig.json'))
        }'.`,
    );
});

test('throws if no tsconfig.json can be found', (t) => {
    const container = new Container({defaultScope: BindingScopeEnum.Singleton});
    @injectable()
    class MockFileSystem extends NodeFileSystem {
        constructor(logger: MessageHandler) {
            super(logger);
        }
        public stat(file: string) {
            const stat = super.stat(file);
            return {
                isFile() { return false; },
                isDirectory() { return stat.isDirectory(); },
            };
        }
    }
    container.bind(FileSystem).to(MockFileSystem);
    container.load(createCoreModule({}), createDefaultModule());
    const runner = container.get(Runner);
    const {root} = path.parse(process.cwd());
    t.throws(
        () => Array.from(runner.lintCollection({
            config: undefined,
            files: [],
            exclude: [],
            project: [root],
            references: false,
            fix: false,
            extensions: undefined,
        })),
        `Cannot find a tsconfig.json file at the specified directory: '${unixifyPath(root)}'`,
    );

    const dir = path.join(__dirname, 'non-existent');
    t.throws(
        () => Array.from(runner.lintCollection({
            config: undefined,
            files: [],
            exclude: [],
            project: [dir],
            references: false,
            fix: false,
            extensions: undefined,
        })),
        `The specified path does not exist: '${unixifyPath(dir)}'`,
    );

    t.throws(
        () => Array.from(runner.lintCollection({
            config: undefined,
            files: [],
            exclude: [],
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
        })),
        `Cannot find tsconfig.json for directory '${unixifyPath(process.cwd())}'.`,
    );
});

test('reports warnings while parsing tsconfig.json', (t) => {
    const container = new Container({defaultScope: BindingScopeEnum.Singleton});
    container.bind(MockFiles).toConstantValue({
        entries: {
            'invalid-config.json': {content: '{'},
            'invalid-base.json': {content: '{"extends": "./invalid-config.json"}'},
            'invalid-files.json': {content: '{"files": []}'},
            'no-match.json': {content: '{"include": ["non-existent"], "compilerOptions": {"noLib": true}}'},
        },
    });
    container.bind(FileSystem).to(MemoryFileSystem);
    let warning = '';
    container.bind(MessageHandler).toConstantValue({
        log() {},
        warn(message) { warning = message; },
        error() { throw new Error('should not be called'); },
    });
    container.load(createCoreModule({}), createDefaultModule());
    const runner = container.get(Runner);

    Array.from(runner.lintCollection({
        config: undefined,
        files: [],
        exclude: [],
        project: ['invalid-config.json'],
        references: false,
        fix: false,
        extensions: undefined,
    }));
    t.regex(warning, /invalid-config.json/);
    warning = '';

    Array.from(runner.lintCollection({
        config: undefined,
        files: [],
        exclude: [],
        project: ['invalid-base.json'],
        references: false,
        fix: false,
        extensions: undefined,
    }));
    t.regex(warning, /invalid-config.json/);
    warning = '';

    Array.from(runner.lintCollection({
        config: undefined,
        files: [],
        exclude: [],
        project: ['invalid-files.json'],
        references: false,
        fix: false,
        extensions: undefined,
    }));
    t.is(warning, `error TS18002: The 'files' list in config file '${unixifyPath(path.resolve('invalid-files.json'))}' is empty.\n`);
    warning = '';

    Array.from(runner.lintCollection({
        config: undefined,
        files: [],
        exclude: [],
        project: ['no-match.json'],
        references: false,
        fix: false,
        extensions: undefined,
    }));
    t.regex(warning, /^error TS18003:/);
});

// TODO https://github.com/fimbullinter/wotan/issues/387 https://github.com/Microsoft/TypeScript/issues/26684
test.skip('excludes symlinked typeRoots', (t) => {
    const container = new Container({defaultScope: BindingScopeEnum.Singleton});
    container.bind(DirectoryService).toConstantValue(directories);
    container.bind(MockFiles).toConstantValue({
        entries: {
            'tsconfig.json': {content: '{"files": ["a.ts"]}'},
            'a.ts': {content: 'foo;'},
            node_modules: {
                entries: {
                    '@types': {
                        entries: {
                            foo: {symlink: 'foo'},
                        },
                    },
                },
            },
            foo: {
                entries: {
                    'index.d.ts': {content: 'export {};'},
                },
            },
            '.wotanrc.yaml': {content: 'rules: {trailing-newline: error}'},
        },
    });
    container.bind(FileSystem).to(MemoryFileSystem);
    container.load(createCoreModule({}), createDefaultModule());
    const runner = container.get(Runner);
    const result = Array.from(runner.lintCollection({
        config: undefined,
        files: [],
        exclude: [],
        project: ['tsconfig.json'],
        references: false,
        fix: false,
        extensions: undefined,
    }));
    t.is(result.length, 1);
    t.is(result[0][0], unixifyPath(path.resolve('packages/wotan/a.ts')));
});

test('works with absolute and relative paths', (t) => {
    const container = new Container();
    container.bind(DirectoryService).toConstantValue(directories);
    container.load(createCoreModule({}), createDefaultModule());
    const runner = container.get(Runner);
    testRunner(true);
    testRunner(false);

    function testRunner(project: boolean) {
        const result = Array.from(runner.lintCollection({
            config: undefined,
            files: [
                path.resolve('packages/wotan/test/fixtures/paths/a.ts'),
                path.resolve('packages/wotan/test/fixtures/paths/b.ts'),
                'test/fixtures/paths/c.ts',
                './test/fixtures/paths/d.ts',
            ],
            exclude: [
                './test/fixtures/paths/b.ts',
                path.resolve('packages/wotan/test/fixtures/paths/c.ts'),
                'test/fixtures/paths/d.ts',
            ],
            project: project ? ['test/fixtures/paths/tsconfig.json'] : [],
            references: false,
            fix: false,
            extensions: undefined,
        }));
        t.is(result.length, 1);
        t.is(result[0][0], unixifyPath(path.resolve('packages/wotan/test/fixtures/paths/a.ts')));
    }
});

test('supports linting multiple (overlapping) projects in one run', (t) => {
    const container = new Container();
    container.bind(DirectoryService).toConstantValue(directories);
    container.load(createCoreModule({}), createDefaultModule());
    const runner = container.get(Runner);

    const result = Array.from(
        runner.lintCollection({
            config: undefined,
            files: [],
            exclude: [],
            project: ['test/fixtures/multi-project/src', 'test/fixtures/multi-project/test'],
            references: false,
            fix: true,
            extensions: undefined,
        }),
        (entry): [string, FileSummary] => [unixifyPath(path.relative('packages/wotan/test/fixtures/multi-project', entry[0])), entry[1]],
    );
    t.snapshot(result, {id: 'multi-project'});
});

test('uses FileSystem for globbing', (t) => {
    const container = new Container({defaultScope: BindingScopeEnum.Singleton});
    container.bind(MockFiles).toConstantValue({
        entries: {
            'a.ts': {content: 'a;'},
            foo: {
                entries: {
                    'b.ts': {content: 'b;\n'},
                },
            },
            link: {
                symlink: '.symlinked', // ensures symlinks are handled correctly
            },
            '.symlinked': {
                entries: {
                    nested: {
                        entries: {
                            'c.ts': {content: 'c;'},
                        },
                    },
                },
            },
            regular: {
                entries: {
                    nested: {
                        entries: {
                            'd.ts': {symlink: '.symlinked/nested/c.ts'},
                        },
                    },
                },
            },
            '.wotanrc.yaml': {content: 'rules: {}'},
        },
    });
    container.bind(FileSystem).to(MemoryFileSystem);
    container.load(createCoreModule({}), createDefaultModule());
    const runner = container.get(Runner);
    const result = Array.from(
        runner.lintCollection({
            config: undefined,
            files: ['**/*.ts'],
            exclude: [],
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
        }),
        (entry): [string, FileSummary] => [unixifyPath(path.relative('', entry[0])), entry[1]],
    );
    t.snapshot(result, {id: 'glob-fs'});
});

function isLibraryFile(name: string) {
    return /[\\/]typescript[\\/]lib[\\/]lib(\.es\d+(\.\w+)*)?\.d\.ts$/.test(name);
}

abstract class MockFiles {
    public content?: string;
    public symlink?: string;
    public entries?: Record<string, MockFiles | undefined>;
}
@injectable()
class MemoryFileSystem implements FileSystem {
    constructor(private files: MockFiles, private dirs: DirectoryService) {}

    public normalizePath(file: string) {
        return NodeFileSystem.normalizePath(file);
    }
    public stat(file: string) {
        if (isLibraryFile(file))
            return fs.statSync(file);
        const f = this.resolvePath(file);
        if (f === undefined)
            throw new Error('ENOENT');
        return {
            isFile() { return f.resolved.content !== undefined; },
            isDirectory() { return f.resolved.content === undefined; },
        };
    }
    public lstat(file: string) {
        const f = this.resolvePath(file);
        if (f === undefined)
            throw new Error();
        return {
            isFile() { return !f.symlink && f.resolved.content !== undefined; },
            isDirectory() { return !f.symlink && f.resolved.content === undefined; },
            isSymbolicLink() { return f.symlink; },
        };
    }
    public readFile(file: string) {
        if (isLibraryFile(file))
            return fs.readFileSync(file, 'utf8');
        const f = this.resolvePath(file);
        if (f === undefined)
            throw new Error('ENOENT');
        if (f.resolved.content === undefined)
            throw new Error('EISDIR');
        return f.resolved.content;
    }
    public readDirectory(dir: string): string[] {
        const f = this.resolvePath(dir);
        if (f === undefined)
            throw new Error('ENOENT');
        if (f.resolved.content !== undefined)
            throw new Error('ENOTDIR');
        return Object.keys(f.resolved.entries || {});
    }
    public realpath(file: string): string {
        const f = this.resolvePath(file);
        if (f === undefined)
            throw new Error('ENOENT');
        return path.resolve(this.dirs.getCurrentDirectory(), f.realpath);
    }
    public deleteFile() {
        throw new Error('not implemented');
    }
    public createDirectory() {
        throw new Error('not implemented');
    }
    public writeFile() {
        throw new Error('not implemented');
    }

    private resolvePath(p: string) {
        const parts = path.relative(this.normalizePath(this.dirs.getCurrentDirectory()), this.normalizePath(p)).split(/\//g);
        let current: MockFiles | undefined = this.files;
        let part = parts.shift();
        let realPath = [];
        let symlinkedDepth = -1;
        while (part !== undefined) {
            --symlinkedDepth;
            if (part) {
                realPath.push(part);
                current = current.entries && current.entries[part];
                if (current === undefined)
                    return;
                if (current.symlink !== undefined) {
                    const newParts = current.symlink.split(/\//g);
                    parts.unshift(...newParts);
                    symlinkedDepth = Math.max(symlinkedDepth, 0) + newParts.length;
                    realPath = [];
                    current = this.files;
                }
            }
            part = parts.shift();
        }
        return {resolved: current, realpath: realPath.join('/'), symlink: symlinkedDepth >= 0};
    }
}
