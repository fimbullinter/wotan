import 'reflect-metadata';
import test from 'ava';
import { reduceConfigurationForFile, getSettingsForFile, getProcessorForFile } from '../../src/configuration';
import {
    Configuration,
    EffectiveConfiguration,
    CacheManager,
    Resolver,
    DirectoryService,
    FileSystem,
    Stats,
    ReducedConfiguration,
} from '../../src/types';
import { Container, injectable } from 'inversify';
import { CachedFileSystem } from '../../src/services/cached-file-system';
import { DefaultCacheManager } from '../../src/services/default/cache-manager';
import { NodeResolver } from '../../src/services/default/resolver';
import { unixifyPath } from '../../src/utils';
import * as path from 'path';
import { ConfigurationManager } from '../../src/services/configuration-manager';

test('findConfigurationPath returns closest .wotanrc and falls back to homedir if available', (t) => {
    const container = new Container();
    container.bind(CachedFileSystem).toSelf();
    container.bind(CacheManager).to(DefaultCacheManager);
    container.bind(Resolver).to(NodeResolver);

    const cwd = path.join(path.parse(process.cwd()).root, 'some/project/directory');
    const directories: DirectoryService = {
        getCurrentDirectory: () => cwd,
        getHomeDirectory: () => '/.homedir',
    };
    container.bind(DirectoryService).toConstantValue(directories);

    @injectable()
    class MockFileSystem implements FileSystem {
        private files: string[];
        constructor() {
            const files = [
                'test/configuration/.wotanrc.yaml',
                'test/configuration/prefer-yaml/.wotanrc.yml',
                'test/configuration/prefer-yaml/.wotanrc.yaml',
                'test/configuration/prefer-yml/.wotanrc.json5',
                'test/configuration/prefer-yml/.wotanrc.yml',
                'test/configuration/prefer-json5/.wotanrc.json5',
                'test/configuration/prefer-json5/.wotanrc.json',
                'test/configuration/prefer-json/.wotanrc.json',
                'test/configuration/prefer-json/.wotanrc.js',
                'test/configuration/js/.wotanrc.js',
                '../.wotanrc.yaml',
            ];
            this.files = files.map((f) => unixifyPath(path.resolve('/some/project/directory', f)));
            this.files.push(path.posix.resolve('/.homedir', '.wotanrc.json'));
        }
        public normalizePath(file: string): string {
            return unixifyPath(file);
        }
        public readFile(): string {
            throw new Error('Method not implemented.');
        }
        public readDirectory(): string[] {
            throw new Error('Method not implemented.');
        }
        public stat(file: string): Stats {
            if (this.files.includes(file))
                return {
                    isDirectory() { return false; },
                    isFile() { return true; },
                };
            if (file === unixifyPath(path.resolve(cwd, 'configuration/.wotanrc.json')))
                return {
                    isDirectory() { return true; },
                    isFile() { return false; },
                };
            throw new Error();
        }
        public writeFile(): void {
            throw new Error('Method not implemented.');
        }
        public deleteFile(): void {
            throw new Error('Method not implemented.');
        }
        public createDirectory(): void {
            throw new Error('Method not implemented.');
        }
    }
    container.bind(FileSystem).to(MockFileSystem);
    const cm = container.resolve(ConfigurationManager);
    t.is(
        cm.findConfigurationPath('test/configuration/config-findup/foo.ts'),
        path.resolve(cwd, 'test/configuration/.wotanrc.yaml'),
    );
    t.is(
        cm.findConfigurationPath('test/configuration/foo.ts'),
        path.resolve(cwd, 'test/configuration/.wotanrc.yaml'),
    );
    t.is(
        cm.findConfigurationPath('test/configuration/prefer-yaml/foo.ts'),
        path.resolve(cwd, 'test/configuration/prefer-yaml/.wotanrc.yaml'),
    );
    t.is(
        cm.findConfigurationPath('test/configuration/prefer-yml/foo.ts'),
        path.resolve(cwd, 'test/configuration/prefer-yml/.wotanrc.yml'),
    );
    t.is(
        cm.findConfigurationPath('test/configuration/prefer-json5/subdir/foo.ts'),
        path.resolve(cwd, 'test/configuration/prefer-json5/.wotanrc.json5'),
    );
    t.is(
        cm.findConfigurationPath('test/configuration/prefer-json/foo.ts'),
        path.resolve(cwd, 'test/configuration/prefer-json/.wotanrc.json'),
    );
    t.is(
        cm.findConfigurationPath('test/configuration/js/foo.ts'),
        path.resolve(cwd, 'test/configuration/js/.wotanrc.js'),
    );
    t.is(
        cm.findConfigurationPath('test/foo.ts'),
        path.resolve(cwd, '../.wotanrc.yaml'),
    );
    t.is(
        cm.findConfigurationPath('/foo.ts'),
        path.normalize('/.homedir/.wotanrc.json'),
    );

    directories.getHomeDirectory = () => '/non-existent';
    t.is(
        cm.findConfigurationPath('/bar.ts'),
        undefined,
    );
    directories.getHomeDirectory = undefined;
    t.is(
        cm.findConfigurationPath('/baz.ts'),
        undefined,
    );
    t.is(
        cm.findConfigurationPath('test/bas.ts'),
        path.resolve(cwd, '../.wotanrc.yaml'),
    );
});

test('Circular aliases throw an exception', (t) => {
    const config: Configuration = {
        aliases: {
            'my/ok': { rule: 'no-debugger' },
            'my/foo': { rule: 'my/foo' },
            'my/bar': { rule: 'other/bar' },
            'other/bar': { rule: 'my/bar' },
        },
        extends: [],
        filename: '/config.yaml',
        overrides: [
            {
                files: ['a.ts'],
                rules: { 'my/ok': { severity: 'error' } },
            },
            {
                files: ['b.ts'],
                rules: { 'my/foo': { severity: 'error' } },
            },
            {
                files: ['c.ts'],
                rules: { 'my/bar': { severity: 'error' } },
            },
            {
                files: ['d.ts'],
                rules: { 'other/bar': { severity: 'error' } },
            },
        ],
    };
    t.deepEqual<ReducedConfiguration | undefined>(reduceConfigurationForFile(config, '/a.ts', '/'), {
        processor: undefined,
        settings: new Map(),
        rules: new Map<string, EffectiveConfiguration.RuleConfig>([['my/ok', {
            options: undefined,
            rule: 'no-debugger',
            rulesDirectories: undefined,
            severity: 'error',
        }]]),
    });
    t.throws(() => reduceConfigurationForFile(config, '/b.ts', '/'), 'Circular alias: my/foo => my/foo.');
    t.throws(() => reduceConfigurationForFile(config, '/c.ts', '/'), 'Circular alias: my/bar => other/bar => my/bar.');
    t.throws(() => reduceConfigurationForFile(config, '/d.ts', '/'), 'Circular alias: other/bar => my/bar => other/bar.');
});

test('Aliases refer to rules or aliases in the scope they are declared', (t) => {
    const config: Configuration = {
        aliases: {
            'my/foo': { rule: 'other/foo' },
            'my/circular': { rule: 'circular/circular' },
        },
        extends: [{
            aliases: {
                'other/foo': {
                    rule: 'my/foo',
                },
                'circular/circular': {
                    rule: 'circular/circular',
                },
            },
            extends: [],
            filename: '/base.yaml',
            rulesDirectories: new Map([['my', '/baseRules']]),
        }],
        filename: '/config.yaml',
        rules: {
            'my/foo': {
                severity: 'error',
            },
        },
        overrides: [{
            files: ['b.ts'],
            rules: {
                'my/circular': {
                    severity: 'error',
                },
            },
        }],
        rulesDirectories: new Map([['my', '/extendingRules']]),
    };
    t.deepEqual<ReducedConfiguration | undefined>(reduceConfigurationForFile(config, '/a.ts', '/'), {
        processor: undefined,
        settings: new Map(),
        rules: new Map<string, EffectiveConfiguration.RuleConfig>([['my/foo', {
            options: undefined,
            rule: 'my/foo',
            severity: 'error',
            rulesDirectories: ['/baseRules'],
        }]]),
    });

    t.throws(
        () => reduceConfigurationForFile(config, '/b.ts', '/'),
        'Circular alias: my/circular => circular/circular => circular/circular.',
    );
});

test("Aliases don't alter options unless explicitly specified", (t) => {
    const base: Configuration = {
        aliases: {
            'base/ban-with-statement': { rule: 'no-restricted-syntax', options: 'WithStatement' },
            'base/ban-delete-expression': { rule: 'no-restricted-syntax', options: 'DeleteExpression' },
        },
        extends: [],
        filename: '/base.yaml',
        rules: {
            'base/ban-with-statement': {
                severity: 'error',
            },
            'base/ban-delete-expression': {
                severity: 'error',
            },
        },
    };
    const extending1: Configuration = {
        aliases: {
            'my/ban-with-statement': { rule: 'base/ban-with-statement', options: 'SourceFile>WithStatement'},
            'my/ban-delete-expression': { rule: 'base/ban-with-statement', options: undefined },
            'my/foo': { rule: 'my/ban-with-statement' },
            'my/bar': { rule: 'my/foo' },
        },
        extends: [base],
        rules: {
            'my/ban-with-statement': {
                severity: 'error',
            },
            'my/ban-delete-expression': {
                severity: 'error',
            },
            'my/foo': {
                severity: 'error',
            },
            'my/bar': {
                severity: 'error',
                options: 'FooBar',
            },
        },
        filename: '/extending1.yaml',
    };

    t.deepEqual<ReducedConfiguration | undefined>(reduceConfigurationForFile(extending1, '/a', '/'), {
        processor: undefined,
        settings: new Map(),
        rules: new Map<string, EffectiveConfiguration.RuleConfig>([
            [
                'base/ban-with-statement',
                { rule: 'no-restricted-syntax', options: 'WithStatement', severity: 'error', rulesDirectories: undefined},
            ],
            [
                'base/ban-delete-expression',
                { rule: 'no-restricted-syntax', options: 'DeleteExpression', severity: 'error', rulesDirectories: undefined},
            ],
            [
                'my/ban-with-statement',
                { rule: 'no-restricted-syntax', options: 'SourceFile>WithStatement', severity: 'error', rulesDirectories: undefined},
            ],
            [
                'my/ban-delete-expression',
                { rule: 'no-restricted-syntax', options: undefined, severity: 'error', rulesDirectories: undefined},
            ],
            [
                'my/foo',
                { rule: 'no-restricted-syntax', options: 'SourceFile>WithStatement', severity: 'error', rulesDirectories: undefined},
            ],
            [
                'my/bar',
                { rule: 'no-restricted-syntax', options: 'FooBar', severity: 'error', rulesDirectories: undefined},
            ],
        ]),
    });
});

test('Aliases shadow rules until cleared', (t) => {
    const base: Configuration = {
        aliases: {
            'a/ban-with-statement': { rule: 'b/no-restricted-syntax', options: 'WithStatement' },
            'b/ban-delete-expression': { rule: 'b/no-restricted-syntax', options: 'DeleteExpression' },
        },
        rulesDirectories: new Map([['b', '/baseB']]),
        extends: [],
        filename: '/base.yaml',
        rules: {
            'a/ban-with-statement': {
                severity: 'error',
            },
            'b/ban-delete-expression': {
                severity: 'error',
            },
            'b/no-restricted-syntax': {
                severity: 'error',
                options: 'AnyKeyword',
            },
        },
    };
    t.deepEqual<ReducedConfiguration | undefined>(reduceConfigurationForFile(base, '/a.ts', '/'), {
        processor: undefined,
        settings: new Map(),
        rules: new Map<string, EffectiveConfiguration.RuleConfig>([
            [
                'a/ban-with-statement',
                { rule: 'b/no-restricted-syntax', options: 'WithStatement', severity: 'error', rulesDirectories: ['/baseB']},
            ],
            [
                'b/ban-delete-expression',
                { rule: 'b/no-restricted-syntax', options: 'DeleteExpression', severity: 'error', rulesDirectories: ['/baseB']},
            ],
            [
                'b/no-restricted-syntax',
                { rule: 'b/no-restricted-syntax', options: 'AnyKeyword', severity: 'error', rulesDirectories: ['/baseB']},
            ],
        ]),
    });

    const extending: Configuration = {
        extends: [base],
        aliases: {
            'a/ban-with-statement': null, // tslint:disable-line:no-null-keyword
            'b/ban-delete-expression': null, // tslint:disable-line:no-null-keyword
        },
        filename: '/extending.yaml',
        rulesDirectories: new Map([['b', '/extB'], ['a', '/extA']]),
        overrides: [{
            files: ['b.ts'],
            rules: {
                'a/ban-with-statement': {},
                'b/ban-delete-expression': {},
                'b/no-restricted-syntax': {},
            },
        }],
    };
    t.deepEqual<ReducedConfiguration | undefined>(reduceConfigurationForFile(extending, '/a.ts', '/'), {
        processor: undefined,
        settings: new Map(),
        rules: new Map<string, EffectiveConfiguration.RuleConfig>([
            [
                'a/ban-with-statement',
                { rule: 'b/no-restricted-syntax', options: 'WithStatement', severity: 'error', rulesDirectories: ['/baseB']},
            ],
            [
                'b/ban-delete-expression',
                { rule: 'b/no-restricted-syntax', options: 'DeleteExpression', severity: 'error', rulesDirectories: ['/baseB']},
            ],
            [
                'b/no-restricted-syntax',
                { rule: 'b/no-restricted-syntax', options: 'AnyKeyword', severity: 'error', rulesDirectories: ['/baseB']},
            ],
        ]),
    }, 'Only clearing alias does not invalidate the reference'); // tslint:disable-line:align
    t.deepEqual<ReducedConfiguration | undefined>(reduceConfigurationForFile(extending, '/b.ts', '/'), {
        processor: undefined,
        settings: new Map(),
        rules: new Map<string, EffectiveConfiguration.RuleConfig>([
            [
                'a/ban-with-statement',
                { rule: 'a/ban-with-statement', options: 'WithStatement', severity: 'error', rulesDirectories: ['/extA']},
            ],
            [
                'b/ban-delete-expression',
                { rule: 'b/ban-delete-expression', options: 'DeleteExpression', severity: 'error', rulesDirectories: ['/extB', '/baseB']},
            ],
            [
                'b/no-restricted-syntax',
                { rule: 'b/no-restricted-syntax', options: 'AnyKeyword', severity: 'error', rulesDirectories: ['/extB', '/baseB']},
            ],
        ]),
    }, 'Rules need to be referenced again for cleared alias to have an effect'); // tslint:disable-line:align

    const extending2: Configuration = {
        extends: [base],
        aliases: {
            'c/ban-delete-expression': { rule: 'b/ban-delete-expression' },
        },
        filename: '/extending2.yaml',
        rulesDirectories: new Map([['b', '/extB'], ['c', '/extC']]),
        rules: {
            'c/ban-delete-expression': {},
        },
    };
    t.deepEqual<ReducedConfiguration | undefined>(reduceConfigurationForFile(extending2, '/a.ts', '/'), {
        processor: undefined,
        settings: new Map(),
        rules: new Map<string, EffectiveConfiguration.RuleConfig>([
            [
                'a/ban-with-statement',
                { rule: 'b/no-restricted-syntax', options: 'WithStatement', severity: 'error', rulesDirectories: ['/baseB']},
            ],
            [
                'b/ban-delete-expression',
                { rule: 'b/no-restricted-syntax', options: 'DeleteExpression', severity: 'error', rulesDirectories: ['/baseB']},
            ],
            [
                'b/no-restricted-syntax',
                { rule: 'b/no-restricted-syntax', options: 'AnyKeyword', severity: 'error', rulesDirectories: ['/baseB']},
            ],
            [
                'c/ban-delete-expression',
                { rule: 'b/no-restricted-syntax', options: 'DeleteExpression', severity: 'error', rulesDirectories: ['/baseB']},
            ],
        ]),
    }, 'c/ should not pick up additional rulesDirectories'); // tslint:disable-line:align
});

test('overrides, excludes, globs', (t) => {
    const config: Configuration = {
        filename: '/project/.wotanrc.yaml',
        extends: [],
        processor: '/default',
        rules: {
            foo: { severity: 'error' },
            bar: { severity: 'warning' },
            baz: {
                severity: 'error',
                options: 1,
            },
            bas: {
                severity: 'warning',
                options: false,
            },
        },
        settings: {
            one: true,
            two: 'hello?',
        },
        overrides: [
            {
                files: ['*.js'],
                rules: {
                    bas: {severity: 'error'},
                },
                processor: '/node_modules/js-processor',
            },
            {
                files: ['*.spec.*', '!./*.spec.*'],
                rules: {
                    foo: {
                        severity: 'off',
                    },
                    bas: {
                        options: 'check-stuff',
                    },
                    other: {
                        severity: 'warning',
                    },
                },
                settings: {
                    three: 'three',
                    one: false,
                },
                processor: '',
            },
            {
                files: ['./*.ts'],
                processor: false,
            },
        ],
    };

    check(
        config,
        '/project/a.spec.js',
        {
            rules: new Map<string, EffectiveConfiguration.RuleConfig>([
                ['foo', {severity: 'error', options: undefined, rulesDirectories: undefined, rule: 'foo'}],
                ['bar', {severity: 'warning', options: undefined, rulesDirectories: undefined, rule: 'bar'}],
                ['baz', {severity: 'error', options: 1, rulesDirectories: undefined, rule: 'baz'}],
                ['bas', {severity: 'error', options: false, rulesDirectories: undefined, rule: 'bas'}],
            ]),
            settings: new Map<string, any>([
                ['one', true],
                ['two', 'hello?'],
            ]),
            processor: '/node_modules/js-processor',
        },
    );

    check(
        config,
        '/a.ts',
        {
            rules: new Map<string, EffectiveConfiguration.RuleConfig>([
                ['foo', {severity: 'error', options: undefined, rulesDirectories: undefined, rule: 'foo'}],
                ['bar', {severity: 'warning', options: undefined, rulesDirectories: undefined, rule: 'bar'}],
                ['baz', {severity: 'error', options: 1, rulesDirectories: undefined, rule: 'baz'}],
                ['bas', {severity: 'warning', options: false, rulesDirectories: undefined, rule: 'bas'}],
            ]),
            settings: new Map<string, any>([
                ['one', true],
                ['two', 'hello?'],
            ]),
            processor: '/default',
        },
    );

    check(
        config,
        '/project/a.ts',
        {
            rules: new Map<string, EffectiveConfiguration.RuleConfig>([
                ['foo', {severity: 'error', options: undefined, rulesDirectories: undefined, rule: 'foo'}],
                ['bar', {severity: 'warning', options: undefined, rulesDirectories: undefined, rule: 'bar'}],
                ['baz', {severity: 'error', options: 1, rulesDirectories: undefined, rule: 'baz'}],
                ['bas', {severity: 'warning', options: false, rulesDirectories: undefined, rule: 'bas'}],
            ]),
            settings: new Map<string, any>([
                ['one', true],
                ['two', 'hello?'],
            ]),
            processor: undefined,
        },
    );

    check(
        config,
        '/project/a.spec.ts',
        {
            rules: new Map<string, EffectiveConfiguration.RuleConfig>([
                ['foo', {severity: 'error', options: undefined, rulesDirectories: undefined, rule: 'foo'}],
                ['bar', {severity: 'warning', options: undefined, rulesDirectories: undefined, rule: 'bar'}],
                ['baz', {severity: 'error', options: 1, rulesDirectories: undefined, rule: 'baz'}],
                ['bas', {severity: 'warning', options: false, rulesDirectories: undefined, rule: 'bas'}],
            ]),
            settings: new Map<string, any>([
                ['one', true],
                ['two', 'hello?'],
            ]),
            processor: undefined,
        },
    );

    check(
        config,
        '/a.spec.js',
        {
            rules: new Map<string, EffectiveConfiguration.RuleConfig>([
                ['foo', {severity: 'off', options: undefined, rulesDirectories: undefined, rule: 'foo'}],
                ['bar', {severity: 'warning', options: undefined, rulesDirectories: undefined, rule: 'bar'}],
                ['baz', {severity: 'error', options: 1, rulesDirectories: undefined, rule: 'baz'}],
                ['bas', {severity: 'error', options: 'check-stuff', rulesDirectories: undefined, rule: 'bas'}],
                ['other', {severity: 'warning', options: undefined, rulesDirectories: undefined, rule: 'other'}],
            ]),
            settings: new Map<string, any>([
                ['one', false],
                ['two', 'hello?'],
                ['three', 'three'],
            ]),
            processor: undefined,
        },
    );

    check(
        config,
        '/project/subdir/a.spec.ts',
        {
            rules: new Map<string, EffectiveConfiguration.RuleConfig>([
                ['foo', {severity: 'off', options: undefined, rulesDirectories: undefined, rule: 'foo'}],
                ['bar', {severity: 'warning', options: undefined, rulesDirectories: undefined, rule: 'bar'}],
                ['baz', {severity: 'error', options: 1, rulesDirectories: undefined, rule: 'baz'}],
                ['bas', {severity: 'warning', options: 'check-stuff', rulesDirectories: undefined, rule: 'bas'}],
                ['other', {severity: 'warning', options: undefined, rulesDirectories: undefined, rule: 'other'}],
            ]),
            settings: new Map<string, any>([
                ['one', false],
                ['two', 'hello?'],
                ['three', 'three'],
            ]),
            processor: undefined,
        },
    );

    const extended: Configuration = {
        filename: '/project/test/.wotanrc.json',
        exclude: ['*.js', './foobar.ts'],
        extends: [config],
        rules: {
            special: {
                severity: 'warning',
            },
        },
        settings: {
            special: true,
        },
    };

    t.is(reduceConfigurationForFile(extended, '/foo.js', '/'), undefined);
    t.is(reduceConfigurationForFile(extended, '/project/foo.js', '/'), undefined);
    t.is(reduceConfigurationForFile(extended, '/project/test/foo.js', '/'), undefined);
    t.is(reduceConfigurationForFile(extended, '/project/test/subdir/foo.js', '/'), undefined);
    t.is(reduceConfigurationForFile(extended, '/project/test/foobar.ts', '/'), undefined);

    check(
        extended,
        '/project/test/subdir/foobar.ts',
        {
            rules: new Map<string, EffectiveConfiguration.RuleConfig>([
                ['foo', {severity: 'error', options: undefined, rulesDirectories: undefined, rule: 'foo'}],
                ['bar', {severity: 'warning', options: undefined, rulesDirectories: undefined, rule: 'bar'}],
                ['baz', {severity: 'error', options: 1, rulesDirectories: undefined, rule: 'baz'}],
                ['bas', {severity: 'warning', options: false, rulesDirectories: undefined, rule: 'bas'}],
                ['special', {severity: 'warning', options: undefined, rulesDirectories: undefined, rule: 'special'}],
            ]),
            settings: new Map<string, any>([
                ['one', true],
                ['two', 'hello?'],
                ['special', true],
            ]),
            processor: '/default',
        },
    );

    check(
        extended,
        '/project/foobar.ts',
        {
            rules: new Map<string, EffectiveConfiguration.RuleConfig>([
                ['foo', {severity: 'error', options: undefined, rulesDirectories: undefined, rule: 'foo'}],
                ['bar', {severity: 'warning', options: undefined, rulesDirectories: undefined, rule: 'bar'}],
                ['baz', {severity: 'error', options: 1, rulesDirectories: undefined, rule: 'baz'}],
                ['bas', {severity: 'warning', options: false, rulesDirectories: undefined, rule: 'bas'}],
                ['special', {severity: 'warning', options: undefined, rulesDirectories: undefined, rule: 'special'}],
            ]),
            settings: new Map<string, any>([
                ['one', true],
                ['two', 'hello?'],
                ['special', true],
            ]),
            processor: undefined,
        },
    );

    const extended2: Configuration = {
        extends: [extended],
        filename: '/project/test/subdir/.wotanrc.json5',
        processor: false,
    };

    t.is(reduceConfigurationForFile(extended2, '/foo.js', '/'), undefined);

    check(
        extended2,
        '/project/test/subdir/foobar.ts',
        {
            rules: new Map<string, EffectiveConfiguration.RuleConfig>([
                ['foo', {severity: 'error', options: undefined, rulesDirectories: undefined, rule: 'foo'}],
                ['bar', {severity: 'warning', options: undefined, rulesDirectories: undefined, rule: 'bar'}],
                ['baz', {severity: 'error', options: 1, rulesDirectories: undefined, rule: 'baz'}],
                ['bas', {severity: 'warning', options: false, rulesDirectories: undefined, rule: 'bas'}],
                ['special', {severity: 'warning', options: undefined, rulesDirectories: undefined, rule: 'special'}],
            ]),
            settings: new Map<string, any>([
                ['one', true],
                ['two', 'hello?'],
                ['special', true],
            ]),
            processor: undefined,
        },
    );

    t.is(getProcessorForFile(extended2, '/foo.js', '/'), undefined);
    t.is(getProcessorForFile(extended, '/foo.js', '/'), '/node_modules/js-processor');
    t.is(getProcessorForFile(extended, '/foo.spec.js', '/'), undefined);
    t.is(getProcessorForFile(extended, '/project/foo.js', '/'), '/node_modules/js-processor');
    t.is(getProcessorForFile(extended, '/project/foo.spec.js', '/'), '/node_modules/js-processor');

    t.deepEqual(getSettingsForFile(extended2, '/project/test/subdir/foo.js', '/'), new Map<string, any>([
        ['one', true],
        ['two', 'hello?'],
        ['special', true],
    ]));

    const empty: Configuration = {
        filename: '/.wotanrc.yaml',
        extends: [
            {
                filename: '/base1.yaml',
                extends: [],
                processor: 'test',
            },
            {
                filename: '/base2.yaml',
                extends: [],
            },
        ],
    };

    t.is(getProcessorForFile(empty, '/foo.ts', '/'), 'test');

    function check(c: Configuration, file: string, expected: ReducedConfiguration) {
        t.deepEqual(reduceConfigurationForFile(c, file, '/'), expected);
        t.deepEqual(getSettingsForFile(c, file, '/'), expected.settings);
        t.deepEqual(getProcessorForFile(c, file, '/'), expected.processor);
    }
});

test('extending multiple configs', (t) => {
    const config: Configuration = {
        filename: '/derived.yaml',
        rules: {
            'one/baz': {severity: 'error'},
            'two/baz': {severity: 'error'},
            'three/baz': {severity: 'error'},
        },
        extends: [
            {
                filename: '/base-zero.yaml',
                extends: [],
            },
            {
                filename: '/base-one.yaml',
                extends: [],
                aliases: {
                    'one/alias': {rule: 'one/foo'},
                },
                rulesDirectories: new Map([['one', '/one'], ['two', '/two']]),
                rules: {
                    'one/bar': {severity: 'error'},
                    'one/alias': {severity: 'error'},
                },
            },
            {
                filename: '/base-two.yaml',
                extends: [],
                aliases: {
                    'three/alias': {rule: 'three/foo'},
                    'one/alias': {rule: 'foobar'},
                },
                rulesDirectories: new Map([['one', '/other-one'], ['three', '/three']]),
                rules: {
                    'one/bas': {severity: 'error'},
                    'three/bar': {severity: 'error'},
                    'three/alias': {severity: 'error'},
                },
            },
            {
                filename: '/base-unused.yaml',
                extends: [],
                aliases: {
                    'unused/alias': {rule: 'unused/foo'},
                    'one/alias': {rule: 'foobaz'},
                },
                rulesDirectories: new Map([['unused', '/unused'], ['three', '/other-three']]),
            },
        ],
    };

    t.deepEqual<ReducedConfiguration | undefined>(
        reduceConfigurationForFile(config, '/file', '/'),
        {
            settings: new Map(),
            processor: undefined,
            rules: new Map<string, EffectiveConfiguration.RuleConfig>([
                ['one/bar', {severity: 'error', rule: 'one/bar', options: undefined, rulesDirectories: ['/one']}],
                ['one/alias', {severity: 'error', rule: 'one/foo', options: undefined, rulesDirectories: ['/one']}],
                ['one/bas', {severity: 'error', rule: 'one/bas', options: undefined, rulesDirectories: ['/other-one']}],
                ['three/bar', {severity: 'error', rule: 'three/bar', options: undefined, rulesDirectories: ['/three']}],
                ['three/alias', {severity: 'error', rule: 'three/foo', options: undefined, rulesDirectories: ['/three']}],
                ['one/baz', {severity: 'error', rule: 'one/baz', options: undefined, rulesDirectories: ['/other-one', '/one']}],
                ['two/baz', {severity: 'error', rule: 'two/baz', options: undefined, rulesDirectories: ['/two']}],
                ['three/baz', {severity: 'error', rule: 'three/baz', options: undefined, rulesDirectories: ['/other-three', '/three']}],
            ]),
        },
    );
});
