import test from 'ava';
import { parseArguments, parseGlobalOptions } from '../../src/argparse';
import { CommandName, Command } from '../../src/commands';
import { Format } from '../../src/types';

test('parseGlobalOptions', (t) => {
    t.deepEqual(
        parseGlobalOptions(undefined),
        {
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            project: undefined,
            formatter: undefined,
            fix: false,
            extensions: undefined,
        },
    );

    t.deepEqual(
        parseGlobalOptions({foo: 'bar'}),
        {
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            project: undefined,
            formatter: undefined,
            fix: false,
            extensions: [],
        },
        'ignores excess options',
    );

    t.deepEqual(
        parseGlobalOptions({modules: 'm', files: ['**/*.ts'], fix: 10, extensions: 'mjs', formatter: 'foo'}),
        {
            modules: ['m'],
            config: undefined,
            files: ['**/*.ts'],
            exclude: [],
            project: undefined,
            formatter: 'foo',
            fix: 10,
            extensions: ['.mjs'],
        },
    );

    t.deepEqual(
        parseGlobalOptions({modules: [], config: 'config.yaml', project: '.', fix: true, exclude: '**/*.d.ts'}),
        {
            modules: [],
            config: 'config.yaml',
            files: [],
            exclude: ['**/*.d.ts'],
            project: '.',
            formatter: undefined,
            fix: true,
            extensions: [],
        },
    );

    t.deepEqual(
        parseGlobalOptions({fix: 'foo', project: false, modules: [1]}),
        {
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            project: undefined,
            formatter: undefined,
            fix: false,
            extensions: [],
        },
        'invalid values are ignored',
    );
});

test('defaults to lint command', (t) => {
    t.deepEqual<Command>(
        parseArguments([]),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: undefined,
            fix: false,
            extensions: undefined,
        },
    );
    t.deepEqual<Command>(
        parseArguments(['foo']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: ['foo'],
            exclude: [],
            formatter: undefined,
            project: undefined,
            fix: false,
            extensions: undefined,
        },
    );
});

test('parses lint command', (t) => {
    t.deepEqual<Command>(
        parseArguments(['lint', '-m', 'foo,bar', '--module', 'baz']),
        {
            command: CommandName.Lint,
            modules: ['foo', 'bar', 'baz'],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: undefined,
            fix: false,
            extensions: undefined,
        },
        'parses modules',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--', '-foo', '--bar', '--fix', '--exclude', '--formatter', '--project']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: ['-foo', '--bar', '--fix', '--exclude', '--formatter', '--project'],
            exclude: [],
            formatter: undefined,
            project: undefined,
            fix: false,
            extensions: undefined,
        },
        'treats all arguments after -- as files',
    );

    t.deepEqual<Command>(
        parseArguments(["'lint'", "'--fix'"]),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: undefined,
            fix: true,
            extensions: undefined,
        },
        'trims single quotes',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--fix', '-p', '.']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: '.',
            fix: true,
            extensions: undefined,
        },
        '--fix argument is optional',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--fix', 'false', '-p', '.']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: '.',
            fix: false,
            extensions: undefined,
        },
        '--fix can be set to false',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--fix', 'true']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: undefined,
            fix: true,
            extensions: undefined,
        },
        '--fix can be set to true',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--fix', '10', '--project', '.']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: '.',
            fix: 10,
            extensions: undefined,
        },
        '--fix can be set to any number',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '-e', '**/*.d.ts', '-f', 'json', '--exclude', 'node_modules/**']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: ['**/*.d.ts', 'node_modules/**'],
            formatter: 'json',
            project: undefined,
            fix: false,
            extensions: undefined,
        },
        '--exclude is accumulated',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '-f', 'json', 'foo', '--formatter', 'stylish', 'bar']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: ['foo', 'bar'],
            exclude: [],
            formatter: 'stylish',
            project: undefined,
            fix: false,
            extensions: undefined,
        },
        'files can be interspersed, specifying an option multiple times overrides its value',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '-c', 'foo.json']),
        {
            command: CommandName.Lint,
            modules: [],
            config: 'foo.json',
            files: [],
            exclude: [],
            formatter: undefined,
            project: undefined,
            fix: false,
            extensions: undefined,
        },
        '-c specifies config',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--config', '../bar.yaml']),
        {
            command: CommandName.Lint,
            modules: [],
            config: '../bar.yaml',
            files: [],
            exclude: [],
            formatter: undefined,
            project: undefined,
            fix: false,
            extensions: undefined,
        },
        '--config specifies config',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--ext', 'mjs, .es6, esm', 'foo']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: ['foo'],
            exclude: [],
            formatter: undefined,
            project: undefined,
            fix: false,
            extensions: ['.mjs', '.es6', '.esm'],
        },
        '--ext can be comma separated, values are sanitized',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--ext', '.mjs', '--ext', 'es6', 'foo']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: ['foo'],
            exclude: [],
            formatter: undefined,
            project: undefined,
            fix: false,
            extensions: ['.mjs', '.es6'],
        },
        '--ext can occur multiple times',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--ext', '.esm', '--ext', '.mjs,es6', 'foo']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: ['foo'],
            exclude: [],
            formatter: undefined,
            project: undefined,
            fix: false,
            extensions: ['.esm', '.mjs', '.es6'],
        },
        '--ext merges arrays',
    );

    t.deepEqual<Command>(
        parseArguments(
            ['lint', '--ext', '', '-f', '', '-p', '', '-m', '', '-c', '', '-e', '', '--'],
            {
                formatter: 'foo',
                extensions: 'bar',
                project: 'baz',
                files: ['bas'],
                modules: ['foo', 'bar'],
                config: 'fooconfig',
                exclude: '**/*.d.ts',
                fix: true,
            },
        ),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: undefined,
            fix: true,
            extensions: undefined,
        },
        'overrides defaults',
    );

    t.deepEqual<Command>(
        parseArguments(
            ['lint', '--ext', '', ''],
            {
                formatter: 'foo',
                extensions: 'bar',
                project: 'baz',
                files: ['bas'],
                modules: ['foo', 'bar'],
                config: 'fooconfig',
                exclude: '**/*.d.ts',
                fix: 10,
            },
        ),
        {
            command: CommandName.Lint,
            modules: ['foo', 'bar'],
            config: 'fooconfig',
            files: [],
            exclude: ['**/*.d.ts'],
            formatter: 'foo',
            project: 'baz',
            fix: 10,
            extensions: undefined,
        },
        'uses defaults where not overridden',
    );

    t.throws(() => parseArguments(['lint', '--foobar']), "Unknown option '--foobar'.");

    t.throws(() => parseArguments(['lint', '-m']), "Option '-m' expects an argument.");
    t.throws(() => parseArguments(['lint', '--exclude']), "Option '--exclude' expects an argument.");
    t.throws(() => parseArguments(['lint', '-f']), "Option '-f' expects an argument.");
    t.throws(() => parseArguments(['lint', '--project']), "Option '--project' expects an argument.");
    t.throws(() => parseArguments(['lint', '--config']), "Option '--config' expects an argument.");
    t.throws(() => parseArguments(['lint', '--ext']), "Option '--ext' expects an argument.");
    t.throws(() => parseArguments(['lint', '--ext', 'mjs']), "Options '--ext' and '--project' cannot be used together.");
    t.throws(() => parseArguments(['lint', '--ext', 'mjs', '-p', '.']), "Options '--ext' and '--project' cannot be used together.");
});

test('parses save command', (t) => {
    t.deepEqual<Command>(
        parseArguments(
            ['save', '--ext', '', ''],
            {
                formatter: 'foo',
                extensions: 'bar',
                project: 'baz',
                files: ['bas'],
                modules: ['foo', 'bar'],
                config: 'fooconfig',
                exclude: '**/*.d.ts',
                fix: 10,
            },
        ),
        {
            command: CommandName.Save,
            modules: ['foo', 'bar'],
            config: 'fooconfig',
            files: [],
            exclude: ['**/*.d.ts'],
            formatter: 'foo',
            project: 'baz',
            fix: 10,
            extensions: undefined,
        },
    );
});

test('parses show command', (t) => {
    t.deepEqual<Command>(
        parseArguments(['show', 'foo', '', '-m', 'foo,bar', '--module', 'baz']),
        {
            command: CommandName.Show,
            modules: ['foo', 'bar', 'baz'],
            file: 'foo',
            format: undefined,
            config: undefined,
        },
        'parses modules',
    );

    t.deepEqual<Command>(
        parseArguments(['show', '-f', 'json', 'foo']),
        {
            command: CommandName.Show,
            modules: [],
            file: 'foo',
            format: Format.Json,
            config: undefined,
        },
    );

    t.deepEqual<Command>(
        parseArguments(['show', 'foo', '-c', 'wotan:recommended']),
        {
            command: CommandName.Show,
            modules: [],
            file: 'foo',
            format: undefined,
            config: 'wotan:recommended',
        },
        '--format is optional',
    );

    t.deepEqual<Command>(
        parseArguments(['show', '--config', '.wotanrc.yaml', '--format', 'yaml', '--', '-f']),
        {
            command: CommandName.Show,
            modules: [],
            file: '-f',
            format: Format.Yaml,
            config: '.wotanrc.yaml',
        },
        '-- ends options',
    );

    t.deepEqual<Command>(
        parseArguments(
            ['show', '--config', '', 'file.ts', '-m', ''],
            {formatter: 'json', files: 'foo.ts', config: 'my.config', modules: 'foo'},
        ),
        {
            command: CommandName.Show,
            modules: [],
            file: 'file.ts',
            format: undefined,
            config: undefined,
        },
        'overrides defaults',
    );

    t.deepEqual<Command>(
        parseArguments(
            ['show', 'file.ts'],
            {formatter: 'json', files: 'foo.ts', config: 'my.config', modules: 'foo'},
        ),
        {
            command: CommandName.Show,
            modules: ['foo'],
            file: 'file.ts',
            format: undefined,
            config: 'my.config',
        },
        'uses defaults',
    );

    t.throws(() => parseArguments(['show', '-f']), "Option '-f' expects an argument.");
    t.throws(() => parseArguments(['show', '-f', 'foobar']), "Argument for option '-f' must be one of 'json', 'json5' or 'yaml'.");

    t.throws(() => parseArguments(['show', '-c']), "Option '-c' expects an argument.");

    t.throws(() => parseArguments(['show'], {files: 'test.ts'}), 'filename expected');
    t.throws(() => parseArguments(['show', '-c', 'config.yaml']), 'filename expected');
    t.throws(() => parseArguments(['show', 'foo', 'bar']), 'more than one filename provided');

    t.throws(() => parseArguments(['show', '--foobar']), "Unknown option '--foobar'.");
});

test('parses test command', (t) => {
    t.deepEqual<Command>(
        parseArguments(['test', 'foo', '', '-m', 'foo,bar', '--module', 'baz', '--', '']),
        {
            command: CommandName.Test,
            modules: ['foo', 'bar', 'baz'],
            files: ['foo'],
            updateBaselines: false,
            bail: false,
            exact: false,
        },
        'parses modules',
    );

    t.deepEqual<Command>(
        parseArguments(['test', '-u', 'foo', '--exact', '--bail', 'true']),
        {
            command: CommandName.Test,
            modules: [],
            files: ['foo'],
            updateBaselines: true,
            bail: true,
            exact: true,
        },
    );

    t.deepEqual<Command>(
        parseArguments(['test', '-u', '--update', 'false', 'bar']),
        {
            command: CommandName.Test,
            modules: [],
            files: ['bar'],
            updateBaselines: false,
            bail: false,
            exact: false,
        },
    );

    t.deepEqual<Command>(
        parseArguments(['test', 'foo', 'bar', '--', '-u']),
        {
            command: CommandName.Test,
            modules: [],
            files: ['foo', 'bar', '-u'],
            updateBaselines: false,
            bail: false,
            exact: false,
        },
    );

    t.throws(() => parseArguments(['test', '-u', '--exact', '--bail']), 'filename expected.');
    t.throws(() => parseArguments(['test', '--option']), "Unknown option '--option'.");
});

test('parses validate command', (t) => {
    t.throws(() => parseArguments(['validate']), "'validate' is not implemented yet.");
});
