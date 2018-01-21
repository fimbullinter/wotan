import 'reflect-metadata';
import test from 'ava';
import { Container, injectable } from 'inversify';
import { CORE_DI_MODULE } from '../../src/di/core.module';
import { DEFAULT_DI_MODULE } from '../../src/di/default.module';
import { Runner } from '../../src/runner';
import { unixifyPath } from '../../src/utils';
import * as path from 'path';
import { NodeFileSystem } from '../../src/services/default/file-system';
import { FileSystem } from '../../src/types';

test('throws error on non-existing file', (t) => {
    const container = new Container();
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
        })),
        "'non-existent.ts' does not exist.",
    );
});

test('throws error on file not included in project', (t) => {
    const container = new Container();
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
        })),
        `'${unixifyPath(path.resolve('non-existent.ts'))}' is not included in the project.`,
    );
});

test('throws if no tsconfig.json can be found', (t) => {
    const container = new Container();
    @injectable()
    class MockFileSystem extends NodeFileSystem {
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
        })),
        `Cannot find tsconfig.json for directory '${process.cwd()}'.`,
    );
});
