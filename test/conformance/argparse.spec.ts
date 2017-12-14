import test from 'ava';
import { parseArguments } from '../../src/argparse';
import { CommandName } from '../../src/runner';

test('defaults to lint command', (t) => {
    t.deepEqual(
        parseArguments([]),
        {
            command: CommandName.Lint,
            files: [],
            exclude: [],
            format: undefined,
            project: undefined,
            fix: false,
        },
    );
    t.deepEqual(
        parseArguments(['foo']),
        {
            command: CommandName.Lint,
            files: ['foo'],
            exclude: [],
            format: undefined,
            project: undefined,
            fix: false,
        },
    );
});

test('parses lint command', (t) => {
    t.deepEqual(
        parseArguments(['lint', '--', '-foo', '--bar', '--fix', '--exclude', '--format', '--project']),
        {
            command: CommandName.Lint,
            files: ['-foo', '--bar', '--fix', '--exclude', '--format', '--project'],
            exclude: [],
            format: undefined,
            project: undefined,
            fix: false,
        },
        'treats all arguments after -- as files',
    );

    t.deepEqual(
        parseArguments(["'lint'", "'--fix'"]),
        {
            command: CommandName.Lint,
            files: [],
            exclude: [],
            format: undefined,
            project: undefined,
            fix: true,
        },
        'trims single quotes',
    );

    t.deepEqual(
        parseArguments(['lint', '--fix', '-p', '.']),
        {
            command: CommandName.Lint,
            files: [],
            exclude: [],
            format: undefined,
            project: '.',
            fix: true,
        },
        '--fix argument is optional',
    );

    t.deepEqual(
        parseArguments(['lint', '--fix', 'false', '-p', '.']),
        {
            command: CommandName.Lint,
            files: [],
            exclude: [],
            format: undefined,
            project: '.',
            fix: false,
        },
        '--fix can be set to false',
    );

    t.deepEqual(
        parseArguments(['lint', '--fix', '10', '--project', '.']),
        {
            command: CommandName.Lint,
            files: [],
            exclude: [],
            format: undefined,
            project: '.',
            fix: 10,
        },
        '--fix can be set to any number',
    );

    t.deepEqual(
        parseArguments(['lint', '-e', '**/*.d.ts', '-f', 'json', '--exclude', 'node_modules/**']),
        {
            command: CommandName.Lint,
            files: [],
            exclude: ['**/*.d.ts', 'node_modules/**'],
            format: 'json',
            project: undefined,
            fix: false,
        },
        '--exclude is accumulated',
    );

    t.deepEqual(
        parseArguments(['lint', '-f', 'json', 'foo', '--format', 'stylish', 'bar']),
        {
            command: CommandName.Lint,
            files: ['foo', 'bar'],
            exclude: [],
            format: 'stylish',
            project: undefined,
            fix: false,
        },
        'files can be interspersed, specifying an option multiple times overrides its value',
    );

    t.throws(() => parseArguments(['lint', '--foobar']), "Unknown option '--foobar'.");

    t.throws(() => parseArguments(['lint', '--exclude']), "Option '--exclude' expects an argument.");
    t.throws(() => parseArguments(['lint', '-f']), "Option '-f' expects an argument.");
    t.throws(() => parseArguments(['lint', '--project']), "Option '--project' expects an argument.");
});
