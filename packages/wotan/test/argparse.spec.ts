import test from 'ava';
import { parseArguments, parseGlobalOptions } from '../src/argparse';
import { CommandName, Command } from '../src/commands';
import { Format } from '@fimbul/ymir';

test('parseGlobalOptions', (t) => {
    t.deepEqual(
        parseGlobalOptions(undefined),
        {
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            project: [],
            references: false,
            formatter: undefined,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: false,
        },
    );

    t.deepEqual(
        parseGlobalOptions({foo: 'bar'}),
        {
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            project: [],
            references: false,
            formatter: undefined,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: false,
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
            project: [],
            references: false,
            formatter: 'foo',
            fix: 10,
            extensions: ['.mjs'],
            reportUselessDirectives: false,
        },
    );

    t.deepEqual(
        parseGlobalOptions({modules: [], config: 'config.yaml', project: '.', references: true, fix: true, exclude: '**/*.d.ts'}),
        {
            modules: [],
            config: 'config.yaml',
            files: [],
            exclude: ['**/*.d.ts'],
            project: ['.'],
            references: true,
            formatter: undefined,
            fix: true,
            extensions: undefined,
            reportUselessDirectives: false,
        },
    );

    t.deepEqual(
        parseGlobalOptions({fix: 'foo', project: false, references: 'false', modules: [1], config: false}),
        {
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            project: [],
            references: false,
            formatter: undefined,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: false,
        },
        'invalid values are ignored',
    );

    t.is(parseGlobalOptions({reportUselessDirectives: 'error'}).reportUselessDirectives, 'error');
    t.is(parseGlobalOptions({reportUselessDirectives: 'foo?'}).reportUselessDirectives, 'error');
    t.is(parseGlobalOptions({reportUselessDirectives: 'warning'}).reportUselessDirectives, 'warning');
    t.is(parseGlobalOptions({reportUselessDirectives: 'warn'}).reportUselessDirectives, 'warning');
    t.is(parseGlobalOptions({reportUselessDirectives: 'hint'}).reportUselessDirectives, 'suggestion');
    t.is(parseGlobalOptions({reportUselessDirectives: 'suggestion'}).reportUselessDirectives, 'suggestion');
    t.is(parseGlobalOptions({reportUselessDirectives: 'off'}).reportUselessDirectives, false);
    t.is(parseGlobalOptions({reportUselessDirectives: true}).reportUselessDirectives, true);
    t.is(parseGlobalOptions({reportUselessDirectives: false}).reportUselessDirectives, false);
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
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: false,
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
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: false,
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
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: false,
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
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: false,
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
            project: [],
            references: false,
            fix: true,
            extensions: undefined,
            reportUselessDirectives: false,
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
            project: ['.'],
            references: false,
            fix: true,
            extensions: undefined,
            reportUselessDirectives: false,
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
            project: ['.'],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: false,
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
            project: [],
            references: false,
            fix: true,
            extensions: undefined,
            reportUselessDirectives: false,
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
            project: ['.'],
            references: false,
            fix: 10,
            extensions: undefined,
            reportUselessDirectives: false,
        },
        '--fix can be set to any number',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '-p', 'src', '--project', 'test']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: ['src', 'test'],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: false,
        },
        '--project is accumulated',
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
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: false,
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
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: false,
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
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: false,
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
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: false,
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
            project: [],
            references: false,
            fix: false,
            extensions: ['.mjs', '.es6', '.esm'],
            reportUselessDirectives: false,
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
            project: [],
            references: false,
            fix: false,
            extensions: ['.mjs', '.es6'],
            reportUselessDirectives: false,
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
            project: [],
            references: false,
            fix: false,
            extensions: ['.esm', '.mjs', '.es6'],
            reportUselessDirectives: false,
        },
        '--ext merges arrays',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '-r']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: [],
            references: true,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: false,
        },
        '-r switches project references',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '-r', '--references', 'false']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: false,
        },
        '--references switches project references',
    );

    t.deepEqual<Command>(
        parseArguments(
            ['lint', '--ext', '', '-f', '', '-p', '', '-m', '', '-c', '', '-e', '', '-r', 'false', '--'],
            {
                formatter: 'foo',
                extensions: 'bar',
                project: 'baz',
                references: true,
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
            project: [],
            references: false,
            fix: true,
            extensions: undefined,
            reportUselessDirectives: false,
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
                references: true,
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
            project: ['baz'],
            references: true,
            fix: 10,
            extensions: undefined,
            reportUselessDirectives: false,
        },
        'uses defaults where not overridden',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--report-useless-directives']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: true,
        },
        'value for --report-useless-directives is optional, default is true',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--report-useless-directives', 'foo']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: ['foo'],
            exclude: [],
            formatter: undefined,
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: true,
        },
        'only parses severity or boolean as value for --report-useless-directives',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--report-useless-directives', 'false'], {reportUselessDirectives: true}),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: false,
        },
        'only parses severity or boolean as value for --report-useless-directives',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--report-useless-directives', 'true']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: true,
        },
        'only parses severity or boolean as value for --report-useless-directives',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--report-useless-directives', 'error']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: 'error',
        },
        'only parses severity or boolean as value for --report-useless-directives',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--report-useless-directives', 'warning']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: 'warning',
        },
        'only parses severity or boolean as value for --report-useless-directives',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--report-useless-directives', 'warn']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: 'warning',
        },
        'only parses severity or boolean as value for --report-useless-directives',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--report-useless-directives', 'suggestion']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: 'suggestion',
        },
        'only parses severity or boolean as value for --report-useless-directives',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--report-useless-directives', 'hint']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: 'suggestion',
        },
        'only parses severity or boolean as value for --report-useless-directives',
    );

    t.deepEqual<Command>(
        parseArguments(['lint', '--report-useless-directives', 'off']),
        {
            command: CommandName.Lint,
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            formatter: undefined,
            project: [],
            references: false,
            fix: false,
            extensions: undefined,
            reportUselessDirectives: false,
        },
        'only parses severity or boolean as value for --report-useless-directives',
    );

    t.throws(() => parseArguments(['lint', '--foobar']), { message: "Unknown option '--foobar'." });

    t.throws(() => parseArguments(['lint', '-m']), { message: "Option '-m' expects an argument." });
    t.throws(() => parseArguments(['lint', '--exclude']), { message: "Option '--exclude' expects an argument." });
    t.throws(() => parseArguments(['lint', '-f']), { message: "Option '-f' expects an argument." });
    t.throws(() => parseArguments(['lint', '--project']), { message: "Option '--project' expects an argument." });
    t.throws(() => parseArguments(['lint', '--config']), { message: "Option '--config' expects an argument." });
    t.throws(() => parseArguments(['lint', '--ext']), { message: "Option '--ext' expects an argument." });
    t.throws(() => parseArguments(['lint', '--ext', 'mjs']), { message: "Options '--ext' and '--project' cannot be used together." });
    t.throws(() => parseArguments(['lint', '--ext', 'mjs', '-p', '.']), { message: "Options '--ext' and '--project' cannot be used together." });
});

test('parses save command', (t) => {
    t.deepEqual<Command>(
        parseArguments(
            ['save', '--ext', '', ''],
            {
                formatter: 'foo',
                extensions: 'bar',
                project: 'baz',
                references: true,
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
            project: ['baz'],
            references: true,
            fix: 10,
            extensions: undefined,
            reportUselessDirectives: false,
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

    t.throws(() => parseArguments(['show', '-f']), { message: "Option '-f' expects an argument." });
    t.throws(
        () => parseArguments(['show', '-f', 'foobar']),
        null,
        "Argument for option '-f' must be one of 'json', 'json5' or 'yaml'.",
    );

    t.throws(() => parseArguments(['show', '-c']), { message: "Option '-c' expects an argument." });

    t.throws(() => parseArguments(['show'], {files: 'test.ts'}), { message: 'filename expected' });
    t.throws(() => parseArguments(['show', '-c', 'config.yaml']), { message: 'filename expected' });
    t.throws(() => parseArguments(['show', 'foo', 'bar']), { message: 'more than one filename provided' });

    t.throws(() => parseArguments(['show', '--foobar']), { message: "Unknown option '--foobar'." });
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

    t.throws(() => parseArguments(['test', '-u', '--exact', '--bail']), { message: 'filename expected.' });
    t.throws(() => parseArguments(['test', '--option']), { message: "Unknown option '--option'." });
});

test('parses validate command', (t) => {
    t.throws(() => parseArguments(['validate']), { message: "'validate' is not implemented yet." });
});
