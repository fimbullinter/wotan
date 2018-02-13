import 'reflect-metadata';
import test from 'ava';
import { Container, injectable } from 'inversify';
import { CORE_DI_MODULE } from '../../src/di/core.module';
import { DEFAULT_DI_MODULE } from '../../src/di/default.module';
import { Runner } from '../../src/runner';
import { unixifyPath } from '../../src/utils';
import * as path from 'path';
import { NodeFileSystem } from '../../src/services/default/file-system';
import { FileSystem, MessageHandler, DirectoryService } from '../../src/types';

const directories: DirectoryService = {
    getCurrentDirectory() { return path.resolve('packages/wotan'); }
};
test('throws error on non-existing file', (t) => {
    const container = new Container();
    container.bind(DirectoryService).toConstantValue(directories);
    container.load(CORE_DI_MODULE, DEFAULT_DI_MODULE);
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
        "'non-existent.ts' does not exist.",
    );
});

test('throws error on file not included in project', (t) => {
    const container = new Container();
    container.bind(DirectoryService).toConstantValue(directories);
    container.load(CORE_DI_MODULE, DEFAULT_DI_MODULE);
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
            project: 'test/integration/project/setup',
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
    container.load(CORE_DI_MODULE, DEFAULT_DI_MODULE);
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

test('reports errors while parsing tsconfig.json', (t) => {
    const container = new Container();
    const files: {[name: string]: string | undefined} = {
        'invalid-config.json': '{',
        'invalid-base.json': '{"extends": "./invalid-config.json"}',
        'invalid-files.json': '{"files": []}',
        'no-match.json': '{"include": ["non-existent"], "compilerOptions": {"noLib": true}}',
    };
    @injectable()
    class MockFileSystem extends NodeFileSystem {
        constructor(logger: MessageHandler) {
            super(logger);
        }
        public stat(file: string) {
            return {
                isFile() { return files[path.basename(file)] !== undefined; },
                isDirectory() { return false; },
            };
        }
        public readFile(file: string) {
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
    container.load(CORE_DI_MODULE, DEFAULT_DI_MODULE);
    const runner = container.get(Runner);

    t.throws(
        () => Array.from(runner.lintCollection({
            config: undefined,
            files: [],
            exclude: [],
            project: 'invalid-config.json',
            fix: false,
            extensions: undefined,
        })),
        /invalid-config.json/,
    );

    t.throws(
        () => Array.from(runner.lintCollection({
            config: undefined,
            files: [],
            exclude: [],
            project: 'invalid-base.json',
            fix: false,
            extensions: undefined,
        })),
        /invalid-config.json/,
    );

    t.throws(
        () => Array.from(runner.lintCollection({
            config: undefined,
            files: [],
            exclude: [],
            project: 'invalid-files.json',
            fix: false,
            extensions: undefined,
        })),
        `error TS18002: The 'files' list in config file '${path.resolve('invalid-files.json')}' is empty.\n`,
    );

    t.notThrows(() => Array.from(runner.lintCollection({
        config: undefined,
        files: [],
        exclude: [],
        project: 'no-match.json',
        fix: false,
        extensions: undefined,
    })));
});
