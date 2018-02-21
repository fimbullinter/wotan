import 'reflect-metadata';
import test from 'ava';
import { Container, injectable } from 'inversify';
import { MessageHandler, FileSystem, Format, DirectoryService, CacheFactory } from '../../src/types';
import { runCommand, CommandName, ShowCommand } from '../../src/commands';
import { NodeFileSystem } from '../../src/services/default/file-system';
import * as path from 'path';
import { unixifyPath } from '../../src/utils';
import * as escapeRegex from 'escape-string-regexp';
import { DefaultCacheFactory } from '../../src/services/default/cache-factory';

test('ShowCommand', async (t) => {
    const container = new Container();
    const logger: MessageHandler = {
        log() {},
        warn() { throw new Error('not implemented'); },
        error() { throw new Error('not implemented'); },
    };
    container.bind(CacheFactory).to(DefaultCacheFactory).inSingletonScope();
    container.bind(MessageHandler).toConstantValue(logger);
    const cwd = path.join(path.parse(process.cwd()).root, '.chroot');
    container.bind(DirectoryService).toConstantValue({
        getCurrentDirectory() { return cwd; },
    });

    @injectable()
    class MockFileSystem extends NodeFileSystem {
        constructor(messageHandler: MessageHandler) {
            super(messageHandler);
        }

        public normalizePath(file: string) {
            return super.normalizePath(path.resolve(path.relative(cwd, file)));
        }
        public stat(file: string) {
            // everything above cwd does not exist
            if (path.relative(super.normalizePath(process.cwd()), file).startsWith('..' + path.sep))
                throw new Error();
            return super.stat(file);
        }
    }
    container.bind(FileSystem).to(MockFileSystem);

    t.throws(
        verify({
            command: CommandName.Show,
            modules: [],
            file: '../foo.ts',
            format: undefined,
            config: undefined,
        }),
        "Could not find configuration for '../foo.ts'.",
    );

    t.throws(
        verify({
            command: CommandName.Show,
            modules: [],
            file: '../foo.ts',
            format: undefined,
            config: 'non-existent.conf',
        }),
        `Cannot find module 'non-existent.conf' from '${cwd}'`,
    );

    await verify({
        command: CommandName.Show,
        modules: [],
        file: 'packages/wotan/test/fixtures/configuration/foo.ts',
        format: undefined,
        config: undefined,
    });

    await verify({
        command: CommandName.Show,
        modules: [],
        file: 'packages/wotan/test/fixtures/configuration/foo.js',
        format: undefined,
        config: undefined,
    });

    await verify({
        command: CommandName.Show,
        modules: [],
        file: 'packages/wotan/test/fixtures/configuration/foo.ts',
        format: Format.Json,
        config: undefined,
    });

    await verify({
        command: CommandName.Show,
        modules: [],
        file: 'packages/wotan/test/fixtures/configuration/foo.ts',
        format: Format.Json5,
        config: undefined,
    });

    await verify({
        command: CommandName.Show,
        modules: [],
        file: 'packages/wotan/test/fixtures/configuration/other-config.ts',
        format: undefined,
        config: 'packages/wotan/test/fixtures/configuration/base.yaml',
    });

    async function verify(command: ShowCommand) {
        let called = false;
        logger.log = (output) => {
            t.snapshot(normalizePaths(output), {id: `${t.title} ${command.file} ${command.format}`});
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
