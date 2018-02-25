import 'reflect-metadata';
import test from 'ava';
import { Container, injectable } from 'inversify';
import { MessageHandler, FileSystem, Format, DirectoryService, CacheFactory, GlobalOptions } from '../../src/types';
import { runCommand, CommandName, ShowCommand, SaveCommand } from '../../src/commands';
import { NodeFileSystem } from '../../src/services/default/file-system';
import * as path from 'path';
import { unixifyPath, format } from '../../src/utils';
import * as escapeRegex from 'escape-string-regexp';
import { DefaultCacheFactory } from '../../src/services/default/cache-factory';
import { createCoreModule } from '../../src/di/core.module';
import { createDefaultModule } from '../../src/di/default.module';

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

test('SaveCommand', async (t) => {
    t.deepEqual(
        await verify({
            command: CommandName.Save,
            project: undefined,
            config: undefined,
            fix: false,
            exclude: [],
            files: [],
            extensions: undefined,
            formatter: undefined,
            modules: [],
        }),
        {
            content: false,
            log: "Removed '.fimbullinter.yaml'.",
        },
        'removes file if empty',
    );
    t.deepEqual(
        await verify(
            {
                command: CommandName.Save,
                project: undefined,
                config: undefined,
                fix: 0,
                exclude: [],
                files: [],
                extensions: undefined,
                formatter: undefined,
                modules: [],
            },
            {
                project: 'foo',
            },
            true,
        ),
        {
            content: false,
            log: undefined,
        },
        "doesn't crash if file does not exist",
    );
    t.deepEqual(
        await verify(
            {
                command: CommandName.Save,
                project: undefined,
                config: '.wotanrc.yaml',
                fix: true,
                exclude: [],
                files: ['**/*.d.ts'],
                extensions: undefined,
                formatter: undefined,
                modules: [],
            },
            {
                project: 'foo.json',
                modules: ['foo', 'bar'],
            },
        ),
        {
            content: format({config: '.wotanrc.yaml', fix: true, files: ['**/*.d.ts']}, Format.Yaml),
            log: "Updated '.fimbullinter.yaml'.",
        },
        'overrides existing options',
    );
    t.deepEqual(
        await verify(
            {
                command: CommandName.Save,
                project: undefined,
                config: undefined,
                fix: 0,
                exclude: [],
                files: [],
                extensions: undefined,
                formatter: undefined,
                modules: [],
            },
            {
                other: 'foo',
                project: 'bar',
            },
        ),
        {
            content: format({other: 'foo'}, Format.Yaml),
            log: "Updated '.fimbullinter.yaml'.",
        },
        'preserves other config values',
    );

    async function verify(command: SaveCommand, defaults?: GlobalOptions, throwOnDelete?: boolean) {
        const container = new Container();
        let content: string | false | undefined;
        const fileSystem: FileSystem = {
            normalizePath(p) { return p; },
            readFile() { throw new Error(); },
            readDirectory() { throw new Error(); },
            stat() { throw new Error(); },
            createDirectory() { throw new Error(); },
            writeFile(f, c) {
                t.is(f, path.resolve('.fimbullinter.yaml'));
                content = c;
            },
            deleteFile(f) {
                t.is(f, path.resolve('.fimbullinter.yaml'));
                content = false;
                if (throwOnDelete)
                    throw new Error('ENOENT');
            },
        };
        container.bind(FileSystem).toConstantValue(fileSystem);
        let log: string | undefined;
        const logger: MessageHandler = {
            log(m) { log = m; },
            warn() { throw new Error(); },
            error() { throw new Error(); },
        };
        container.bind(MessageHandler).toConstantValue(logger);
        container.load(createCoreModule({}), createDefaultModule());

        await runCommand(command, container, defaults);
        return {
            log,
            content,
        };
    }
});
