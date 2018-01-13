import 'reflect-metadata';
import test from 'ava';
import { Container, injectable } from 'inversify';
import { MessageHandler, FileSystem, Format, DirectoryService, CacheManager, Stats } from '../../src/types';
import { runCommand, CommandName, ShowCommand } from '../../src/commands';
import { NodeFileSystem } from '../../src/services/default/file-system';
import * as path from 'path';
import { unixifyPath } from '../../src/utils';
import * as escapeRegex from 'escape-string-regexp';
import { CachedFileSystem } from '../../src/services/cached-file-system';
import { DefaultCacheManager } from '../../src/services/default/cache-manager';

test('ShowCommand', async (t) => {
    const container = new Container();
    const logger: MessageHandler = {
        log() {},
        warn() { throw new Error('not implemented'); },
        error() { throw new Error('not implemented'); },
    };
    container.bind(MessageHandler).toConstantValue(logger);
    const cwd = path.join(path.parse(process.cwd()).root, '.chroot');
    container.bind(DirectoryService).toConstantValue({
        getCurrentDirectory() { return cwd; },
    });

    @injectable()
    class MockFileSystem extends NodeFileSystem {
        public normalizePath(file: string) {
            return super.normalizePath(path.resolve(path.relative(cwd, file)));
        }
        public stat(file: string) {
            // everything above cwd does not exist
            if (path.relative(process.cwd(), file).startsWith('..' + path.sep))
                throw new Error();
            return super.stat(file);
        }
    }
    container.bind(FileSystem).to(MockFileSystem);

    t.throws(
        verify({
            command: CommandName.Show,
            file: '../foo.ts',
            format: undefined,
        }),
        "Could not find configuration for '../foo.ts'.",
    );

    await verify({
        command: CommandName.Show,
        file: 'test/fixtures/configuration/foo.ts',
        format: undefined,
    });

    await verify({
        command: CommandName.Show,
        file: 'test/fixtures/configuration/foo.js',
        format: undefined,
    });

    await verify({
        command: CommandName.Show,
        file: 'test/fixtures/configuration/foo.ts',
        format: Format.Json,
    });

    await verify({
        command: CommandName.Show,
        file: 'test/fixtures/configuration/foo.ts',
        format: Format.Json5,
    });

    async function verify(command: ShowCommand) {
        let called = false;
        logger.log = (output) => {
            t.snapshot(normalizePaths(output), <any>{id: `${t.title} ${command.file} ${command.format}`});
            called = true;
        };
        t.true(await runCommand(command, container));
        t.true(called);
    }
    function normalizePaths(str: string): string {
        // replace `cwd` with / and all backslashes with forward slash
        const re = new RegExp(`'?${escapeRegex(cwd)}(.*?)'?$`, 'gm');
        return str.replace(/\\\\/g, '\\').replace(re, (_, p) => unixifyPath(p));
    }
});

test('InitCommand', async (t) => {
    const container = new Container();
    const warnings: string[] = [];
    const cwd = path.join(path.parse(process.cwd()).root, 'cwd');
    const logger: MessageHandler = {
        log() { throw new Error('not implemented'); },
        warn(message) { warnings.push(message); },
        error() { throw new Error('not implemented'); },
    };
    container.bind(DirectoryService).toConstantValue({
        getCurrentDirectory: () => cwd,
    });
    container.bind(MessageHandler).toConstantValue(logger);
    container.bind(CachedFileSystem).toSelf();
    container.bind(CacheManager).to(DefaultCacheManager);
    const filesWritten: Array<[string, string]> = [];
    @injectable()
    class MockFileSystem implements FileSystem {
        public normalizePath(p: string): string {
            return p;
        }
        public readFile(): string {
            throw new Error('Method not implemented.');
        }
        public readDirectory(): string[] {
            throw new Error('Method not implemented.');
        }
        public stat(file: string): Stats {
            if (path.basename(path.dirname(file)) === 'existing')
                return {
                    isFile: () => true,
                    isDirectory: () => false,
                };
            throw new Error();
        }
        public writeFile(file: string, content: string): void {
            filesWritten.push([file, content]);
        }
        public deleteFile(): void {
            throw new Error('Method not implemented.');
        }
        public createDirectory(): void {
            throw new Error('Method not implemented.');
        }
    }
    container.bind(FileSystem).to(MockFileSystem);

    t.true(await runCommand(
        {
            command: CommandName.Init,
            format: undefined,
            directories: [],
        },
        container,
    ));

    t.is(warnings.length, 0);
    t.deepEqual(filesWritten, [[path.resolve(cwd, '.wotanrc.yaml'), "extends: 'wotan:recommended'\n"]]);

    filesWritten.length = 0;
    t.false(await runCommand(
        {
            command: CommandName.Init,
            format: Format.Json,
            directories: ['existing', 'other'],
        },
        container,
    ));
    t.deepEqual(warnings, [`'${path.resolve(cwd, 'existing/.wotanrc.json')}' already exists.`]);
    t.deepEqual(filesWritten, [[path.resolve(cwd, 'other/.wotanrc.json'), '{\n  "extends": "wotan:recommended"\n}']]);
});
