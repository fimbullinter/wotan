import test from 'ava';
import { parseArguments } from '../../src/argparse';
import { CommandName, Command } from '../../src/commands';
import { Format } from '../../src/types';

test('defaults to lint command', (t) => {
    t.deepEqual<Command>(
        parseArguments([]),
        {
            command: CommandName.Lint,
            config: undefined,
            files: [],
            exclude: [],
            format: undefined,
            project: undefined,
            fix: false,
        },
    );
    t.deepEqual<Command>(
        parseArguments(['foo']),
        {
            command: CommandName.Lint,
            config: undefined,
            files: ['foo'],
            exclude: [],
            format: undefined,
            project: undefined,
            fix: false,
        },
    );
});

test('parses lint command', (t) => {
    t.deepEqual<Command>(
        parseArguments(['lint', '--', '-foo', '--bar', '--fix', '--exclude', '--format', '--project']),
        {
            command: CommandName.Lint,
            config: undefined,
            files: ['-foo', '--bar', '--fix', '--exclude', '--format', '--project'],
            exclude: [],
            format: undefined,
            project: undefined,
            fix: false,
        },
        'treats all arguments after -- as files',
    );

    t.deepEqual<Command>(
        parseArguments(["'lint'", "'--fix'"]),
        {
            command: CommandName.Lint,
            config: undefined,
            files: [],
            exclude: [],
            format: undefined,
            project: undefined,
            fix: true,
        },
        'trims single quotes',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--fix', '-p', '.']),
        {
            command: CommandName.Lint,
            config: undefined,
            files: [],
            exclude: [],
            format: undefined,
            project: '.',
            fix: true,
        },
        '--fix argument is optional',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--fix', 'false', '-p', '.']),
        {
            command: CommandName.Lint,
            config: undefined,
            files: [],
            exclude: [],
            format: undefined,
            project: '.',
            fix: false,
        },
        '--fix can be set to false',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--fix', 'true']),
        {
            command: CommandName.Lint,
            config: undefined,
            files: [],
            exclude: [],
            format: undefined,
            project: undefined,
            fix: true,
        },
        '--fix can be set to true',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--fix', '10', '--project', '.']),
        {
            command: CommandName.Lint,
            config: undefined,
            files: [],
            exclude: [],
            format: undefined,
            project: '.',
            fix: 10,
        },
        '--fix can be set to any number',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '-e', '**/*.d.ts', '-f', 'json', '--exclude', 'node_modules/**']),
        {
            command: CommandName.Lint,
            config: undefined,
            files: [],
            exclude: ['**/*.d.ts', 'node_modules/**'],
            format: 'json',
            project: undefined,
            fix: false,
        },
        '--exclude is accumulated',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '-f', 'json', 'foo', '--format', 'stylish', 'bar']),
        {
            command: CommandName.Lint,
            config: undefined,
            files: ['foo', 'bar'],
            exclude: [],
            format: 'stylish',
            project: undefined,
            fix: false,
        },
        'files can be interspersed, specifying an option multiple times overrides its value',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '-c', 'foo.json']),
        {
            command: CommandName.Lint,
            config: 'foo.json',
            files: [],
            exclude: [],
            format: undefined,
            project: undefined,
            fix: false,
        },
        '-c specifies config',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--config', '../bar.yaml']),
        {
            command: CommandName.Lint,
            config: '../bar.yaml',
            files: [],
            exclude: [],
            format: undefined,
            project: undefined,
            fix: false,
        },
        '--config specifies config',
    );

    t.throws(() => parseArguments(['lint', '--foobar']), "Unknown option '--foobar'.");

    t.throws(() => parseArguments(['lint', '--exclude']), "Option '--exclude' expects an argument.");
    t.throws(() => parseArguments(['lint', '-f']), "Option '-f' expects an argument.");
    t.throws(() => parseArguments(['lint', '--project']), "Option '--project' expects an argument.");
    t.throws(() => parseArguments(['lint', '--config']), "Option '--config' expects an argument.");
});

test('parses show command', (t) => {
    t.deepEqual<Command>(
        parseArguments(['show', '-f', 'json', 'foo']),
        {
            command: CommandName.Show,
            file: 'foo',
            format: Format.Json,
        },
    );

    t.deepEqual<Command>(
        parseArguments(['show', 'foo']),
        {
            command: CommandName.Show,
            file: 'foo',
            format: undefined,
        },
        '--format is optional',
    );

    t.deepEqual<Command>(
        parseArguments(['show', '--format', 'yaml', '--', '-f']),
        {
            command: CommandName.Show,
            file: '-f',
            format: Format.Yaml,
        },
        '-- ends options',
    );

    t.throws(() => parseArguments(['show', '-f']), "Option '-f' expects an argument.");
    t.throws(() => parseArguments(['show', '-f', 'foobar']), "Argument for option '-f' must be one of 'json', 'json5' or 'yaml'.");

    t.throws(() => parseArguments(['show']), 'filename expected');
    t.throws(() => parseArguments(['show', 'foo', 'bar']), 'more than one filename provided');

    t.throws(() => parseArguments(['show', '--foobar']), "Unknown option '--foobar'.");
});

test('parses test command', (t) => {
    t.deepEqual<Command>(
        parseArguments(['test', '-u', 'foo', '--exact', '--bail']),
        {
            command: CommandName.Test,
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
            files: ['foo', 'bar', '-u'],
            updateBaselines: false,
            bail: false,
            exact: false,
        },
    );

    t.throws(() => parseArguments(['test', '-u', '--exact', '--bail']), 'filename expected.');
    t.throws(() => parseArguments(['test', '--option']), "Unknown option '--option'.");
});
