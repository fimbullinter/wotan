import 'reflect-metadata';
import test from 'ava';
import { Container, injectable } from 'inversify';
import { createCoreModule } from '../src/di/core.module';
import { createDefaultModule } from '../src/di/default.module';
import { Runner } from '../src/runner';
import * as path from 'path';
import { NodeFileSystem } from '../src/services/default/file-system';
import { FileSystem, MessageHandler, DirectoryService } from '@fimbul/ymir';
import { unixifyPath } from '../src/utils';

const directories: DirectoryService = {
    getCurrentDirectory() { return path.resolve('packages/wotan'); },
};
test('throws error on non-existing file', (t) => {
    const container = new Container();
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
            project: undefined,
            fix: false,
            extensions: undefined,
        })),
        `'${unixifyPath(path.resolve('packages/wotan/non-existent.ts'))}' does not exist.`,
    );
});

test('throws error on file not included in project', (t) => {
    const container = new Container();
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
            project: 'test/project/setup',
            fix: false,
            extensions: undefined,
        })),
        `'${unixifyPath(path.resolve('packages/wotan/non-existent.ts'))}' is not included in the project.`,
    );
});

test('throws if no tsconfig.json can be found', (t) => {
    const container = new Container();
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
            project: root,
            fix: false,
            extensions: undefined,
        })),
        `Cannot find a tsconfig.json file at the specified directory: '${root}'`,
    );

    const dir = path.join(__dirname, 'non-existent');
    t.throws(
        () => Array.from(runner.lintCollection({
            config: undefined,
            files: [],
            exclude: [],
            project: dir,
            fix: false,
            extensions: undefined,
        })),
        `The specified path does not exist: '${dir}'`,
    );

    t.throws(
        () => Array.from(runner.lintCollection({
            config: undefined,
            files: [],
            exclude: [],
            project: undefined,
            fix: false,
            extensions: undefined,
        })),
        `Cannot find tsconfig.json for directory '${process.cwd()}'.`,
    );
});

test('reports warnings while parsing tsconfig.json', (t) => {
    const container = new Container();
    const files: {[name: string]: string | undefined} = {
        'invalid-config.json': '{',
        'invalid-base.json': '{"extends": "./invalid-config.json"}',
        'invalid-files.json': '{"files": []}',
        'no-match.json': '{"include": ["non-existent"], "compilerOptions": {"noLib": true}}',
    };
    function isLibraryFile(name: string) {
        return /[\\/]typescript[\\/]lib[\\/]lib(\.es\d+(\.\w+)*)?\.d\.ts$/.test(name);
    }
    @injectable()
    class MockFileSystem extends NodeFileSystem {
        constructor(logger: MessageHandler) {
            super(logger);
        }
        public stat(file: string) {
            if (isLibraryFile(file))
                return super.stat(file);
            return {
                isFile() { return files[path.basename(file)] !== undefined; },
                isDirectory() { return false; },
            };
        }
        public readFile(file: string) {
            if (isLibraryFile(file))
                return super.readFile(file);
            const basename = path.basename(file);
            const content = files[basename];
            if (content !== undefined)
                return content;
            throw new Error('ENOENT');
        }
        public readDirectory(): string[] {
            throw new Error('ENOENT');
        }
    }
    container.bind(FileSystem).to(MockFileSystem);
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
        project: 'invalid-config.json',
        fix: false,
        extensions: undefined,
    }));
    t.regex(warning, /invalid-config.json/);
    warning = '';

    Array.from(runner.lintCollection({
        config: undefined,
        files: [],
        exclude: [],
        project: 'invalid-base.json',
        fix: false,
        extensions: undefined,
    }));
    t.regex(warning, /invalid-config.json/);
    warning = '';

    Array.from(runner.lintCollection({
        config: undefined,
        files: [],
        exclude: [],
        project: 'invalid-files.json',
        fix: false,
        extensions: undefined,
    }));
    t.is(warning, `error TS18002: The 'files' list in config file '${path.resolve('invalid-files.json')}' is empty.\n`);
    warning = '';

    Array.from(runner.lintCollection({
        config: undefined,
        files: [],
        exclude: [],
        project: 'no-match.json',
        fix: false,
        extensions: undefined,
    }));
    t.regex(warning, /^error TS18003:/);
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
            project: project ? 'test/fixtures/paths/tsconfig.json' : undefined,
            fix: false,
            extensions: undefined,
        }));
        t.is(result.length, 1);
        t.is(result[0][0], unixifyPath(path.resolve('packages/wotan/test/fixtures/paths/a.ts')));
    }
});
