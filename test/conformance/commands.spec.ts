import 'reflect-metadata';
import test from 'ava';
import { Container, injectable } from 'inversify';
import { MessageHandler, FileSystem, Format, DirectoryService } from '../../src/types';
import { runCommand, CommandName, ShowCommand } from '../../src/commands';
import { NodeFileSystem } from '../../src/services/default/file-system';
import * as path from 'path';
import { unixifyPath } from '../../src/utils';
import * as escapeRegex from 'escape-string-regexp';

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
