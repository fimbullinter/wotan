import 'reflect-metadata';
import test from 'ava';
import {
    CacheManager,
    Resolver,
    FileSystem,
    Stats,
    ConfigurationProvider,
    ReducedConfiguration,
    Configuration,
    MessageHandler,
    LoadConfigurationContext,
} from '../../src/types';
import { Container, injectable } from 'inversify';
import { CachedFileSystem } from '../../src/services/cached-file-system';
import { DefaultCacheManager } from '../../src/services/default/cache-manager';
import { NodeResolver } from '../../src/services/default/resolver';
import { unixifyPath } from '../../src/utils';
import * as path from 'path';
import { ConfigurationManager } from '../../src/services/configuration-manager';
import { NodeDirectoryService } from '../../src/services/default/directory-service';
import { DefaultConfigurationProvider } from '../../src/services/default/configuration-provider';
import { ConfigurationError } from '../../src/error';
import { NodeFileSystem } from '../../src/services/default/file-system';
import { ConsoleMessageHandler } from '../../src/services/default/message-handler';

// tslint:disable:no-null-keyword

test('ConfigurationManager', (t) => {
    const configProvider: ConfigurationProvider = {
        find() {
            throw undefined;
        },
        resolve() {
            throw null;
        },
        load() {
            throw undefined;
        },
    };

    const cm = new ConfigurationManager(new NodeDirectoryService(), configProvider, new DefaultCacheManager());
    t.throws(
        () => cm.find('foo.ts'),
        (e) => e instanceof ConfigurationError && e.message === `Error finding configuration for '${path.resolve('foo.ts')}': undefined`,
    );
    configProvider.find = () => {
        throw new Error();
    };
    t.throws(
        () => cm.find('foo.ts'),
        (e) => e instanceof ConfigurationError && e.message === `Error finding configuration for '${path.resolve('foo.ts')}': `,
    );
    t.throws(
        () => cm.resolve('config.yaml', 'dir'),
        (e) => e instanceof ConfigurationError && e.message === 'null',
    );
    configProvider.resolve = () => {
        throw 'foo';
    };
    t.throws(
        () => cm.resolve('config.yaml', 'dir'),
        (e) => e instanceof ConfigurationError && e.message === 'undefined',
    );
    t.throws(
        () => cm.load('config.yaml'),
        (e) => e instanceof ConfigurationError && e.message === `Error loading ${path.resolve('config.yaml')}: undefined`,
    );
    configProvider.load = () => {
        throw new Error('foo');
    };
    t.throws(
        () => cm.load('config.yaml'),
        (e) => e instanceof ConfigurationError && e.message === `Error loading ${path.resolve('config.yaml')}: foo`,
    );

    configProvider.find = (f) => {
        t.is(f, path.resolve('foo.ts'));
        return f;
    };
    t.is(cm.findPath('foo.ts'), path.resolve('foo.ts'));
    configProvider.resolve = (f, basedir) => {
        t.is(f, 'config.yaml');
        t.is(basedir, path.resolve('dir'));
        return basedir + '/' + f;
    };
    t.is(cm.resolve('config.yaml', 'dir'), path.resolve('dir') + '/config.yaml');

    configProvider.resolve = (file, basedir) => path.resolve(basedir, file);
    configProvider.load = (file, context) => {
        if (path.extname(file) === '.yaml') {
            t.is(file, path.resolve('./subdir/config.yaml'));
            return context.load('./dir/base.json');
        }
        t.is(file, path.resolve('./subdir/dir/base.json'));
        return context.load('../config.yaml');
    };
    t.throws(
        () => cm.load('subdir/config.yaml'),
        (e) => e instanceof ConfigurationError &&
            e.message === `Error loading ${path.resolve('./subdir/config.yaml')} => ${path.resolve('./subdir/dir/base.json')} => ${
                path.resolve('./subdir/config.yaml')}: Circular configuration dependency.`,
    );

    const loaded: string[] = [];
    configProvider.load = (file, context) => {
        loaded.push(file);
        switch (path.basename(file)) {
            case 'start.yaml':
                context.load('./base1.yaml');
                context.load('./base2.yaml');
                return context.load('./base3.yaml');
            case 'base1.yaml':
                context.load('./base.yaml');
                return context.load('./base.yaml');
            case 'base2.yaml':
                return context.load('./base1.yaml');
            case 'base3.yaml':
                context.load('base2.yaml');
                return context.load('./base.yaml');
            case 'base.yaml':
                return {
                    rules: undefined,
                    extends: [],
                    overrides: undefined,
                    aliases: undefined,
                    processor: undefined,
                    settings: undefined,
                    rulesDirectories: undefined,
                    exclude: undefined,
                    filename: file,
                };
            default:
                throw new Error('unexpected file: ' + file);
        }
    };
    cm.load('start.yaml');
    t.deepEqual(loaded, [
        path.resolve('start.yaml'),
        path.resolve('base1.yaml'),
        path.resolve('base.yaml'),
        path.resolve('base2.yaml'),
        path.resolve('base3.yaml'),
    ]);

    const config: Configuration = {
        filename: '/subdir/config.ts',
        exclude: ['*.spec.js'],
        rules: undefined,
        settings: new Map<string, any>([
            ['a', true],
            ['b', 'hallo?'],
        ]),
        overrides: [
            {
                files: ['*.js'],
                rules: undefined,
                settings: new Map([['b', 'from override']]),
                processor: 'js',
            },
        ],
        aliases: undefined,
        processor: undefined,
        extends: [
            {
                filename: '/basedir/config.yaml',
                exclude: ['./*.ts'],
                rules: undefined,
                overrides: [
                    {
                        files: ['*.ts'],
                        settings: undefined,
                        rules: undefined,
                        processor: null,
                    },
                ],
                settings: new Map([['base', 1], ['a', 5]]),
                processor: 'processor',
                aliases: undefined,
                extends: [],
            },
        ],
    };

    check(config, '/foo.spec.js', undefined);
    t.is(cm.getProcessor(config, '/foo.spec.js'), 'js');
    t.deepEqual(cm.getSettings(config, '/foo.spec.js'), new Map<string, any>([
        ['base', 1],
        ['a', true],
        ['b', 'from override'],
    ]));
    check(config, '/basedir/test.ts', undefined);
    t.is(cm.getProcessor(config, '/basedir/test.ts'), undefined);
    t.deepEqual(cm.getSettings(config, '/basedir/test.ts'), new Map<string, any>([
        ['base', 1],
        ['a', true],
        ['b', 'hallo?'],
    ]));
    check(config, '/foo.js', {
        settings: new Map<string, any>([
            ['base', 1],
            ['a', true],
            ['b', 'from override'],
        ]),
        rules: new Map(),
        processor: 'js',
    });

    check(config, '/foo.ts', {
        settings: new Map<string, any>([
            ['base', 1],
            ['a', true],
            ['b', 'hallo?'],
        ]),
        rules: new Map(),
        processor: undefined,
    });
    check(config, '/foo.jsx', {
        settings: new Map<string, any>([
            ['base', 1],
            ['a', true],
            ['b', 'hallo?'],
        ]),
        rules: new Map(),
        processor: 'processor',
    });

    function check(c: Configuration, file: string, expected: ReducedConfiguration | undefined) {
        t.deepEqual(cm.reduce(c, file), expected);
        if (expected !== undefined) {
            t.is(cm.getProcessor(c, file), expected.processor);
            t.deepEqual(cm.getSettings(c, file), expected.settings);
        }
    }
});

test('DefaultConfigurationProvider.find', (t) => {
    const container = new Container();
    container.bind(CachedFileSystem).toSelf();
    container.bind(CacheManager).to(DefaultCacheManager);
    container.bind(Resolver).to(NodeResolver);

    const cwd = path.join(path.parse(process.cwd()).root, 'some/project/directory');

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
    const cp = container.resolve(DefaultConfigurationProvider);
    t.is(
        cp.find(path.resolve(cwd, 'test/configuration/config-findup/foo.ts')),
        path.resolve(cwd, 'test/configuration/.wotanrc.yaml'),
    );
    t.is(
        cp.find(path.resolve(cwd, 'test/configuration/foo.ts')),
        path.resolve(cwd, 'test/configuration/.wotanrc.yaml'),
    );
    t.is(
        cp.find(path.resolve(cwd, 'test/configuration/prefer-yaml/foo.ts')),
        path.resolve(cwd, 'test/configuration/prefer-yaml/.wotanrc.yaml'),
    );
    t.is(
        cp.find(path.resolve(cwd, 'test/configuration/prefer-yml/foo.ts')),
        path.resolve(cwd, 'test/configuration/prefer-yml/.wotanrc.yml'),
    );
    t.is(
        cp.find(path.resolve(cwd, 'test/configuration/prefer-json5/subdir/foo.ts')),
        path.resolve(cwd, 'test/configuration/prefer-json5/.wotanrc.json5'),
    );
    t.is(
        cp.find(path.resolve(cwd, 'test/configuration/prefer-json/foo.ts')),
        path.resolve(cwd, 'test/configuration/prefer-json/.wotanrc.json'),
    );
    t.is(
        cp.find(path.resolve(cwd, 'test/configuration/js/foo.ts')),
        path.resolve(cwd, 'test/configuration/js/.wotanrc.js'),
    );
    t.is(
        cp.find(path.resolve(cwd, path.resolve(cwd, 'test/foo.ts'))),
        path.resolve(cwd, '../.wotanrc.yaml'),
    );
});

test('DefaultConfigurationProvider.resolve', (t) => {
    const container = new Container();
    container.bind(CachedFileSystem).toSelf();
    container.bind(CacheManager).to(DefaultCacheManager);
    container.bind(Resolver).to(NodeResolver);
    container.bind(FileSystem).to(NodeFileSystem);
    container.bind(MessageHandler).to(ConsoleMessageHandler);

    const cp = container.resolve(DefaultConfigurationProvider);
    t.throws(
        () => cp.resolve('wotan:non-existent-preset', '.'),
        "'wotan:non-existent-preset' is not a valid builtin configuration, try 'wotan:recommended'.",
    );
    t.is(cp.resolve('wotan:recommended', ''), path.resolve('./configs/recommended.yaml'));
});

test('DefaultConfigurationProvider.read', (t) => {
    const container = new Container();
    container.bind(CachedFileSystem).toSelf();
    container.bind(CacheManager).to(DefaultCacheManager);

    const empty = {};
    const resolver: Resolver = {
        resolve() {
            return '';
        },
        require() {
            return empty;
        },
    };
    @injectable()
    class MockFileSystem implements FileSystem {
        public normalizePath(file: string): string {
            return file;
        }
        public readFile(file: string): string {
            switch (path.basename(file)) {
                case 'invalid.json':
                case 'invalid.yaml':
                    return '}';
                case 'empty.json':
                    return '{}';
                case 'empty.yaml':
                    return '---';
                default:
                    throw new Error('file not found');
            }
        }
        public readDirectory(): string[] {
            throw new Error('Method not implemented.');
        }
        public stat(): Stats {
            throw new Error('Method not implemented.');
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
    container.bind(Resolver).toConstantValue(resolver);

    const cp = container.resolve(DefaultConfigurationProvider);
    t.is<{}>(cp.read('foo.js'), empty);
    t.deepEqual<{}>(cp.read('empty.json'), empty);
    t.is(cp.read('empty.yaml'), null);
    t.throws(() => cp.read('invalid.json'), /unexpected/i);
    t.throws(() => cp.read('invalid.yaml'));
    t.throws(() => cp.read('non-existent.json5'), 'file not found');
});

test('ConfigurationProvider.parse', (t) => {
    const container = new Container();
    container.bind(CachedFileSystem).toSelf();
    container.bind(CacheManager).to(DefaultCacheManager);
    container.bind(Resolver).to(NodeResolver);
    container.bind(FileSystem).to(NodeFileSystem);
    container.bind(MessageHandler).to(ConsoleMessageHandler);

    const cp = container.resolve(DefaultConfigurationProvider);
    const mockContext: LoadConfigurationContext = {
        stack: [],
        load() {
            throw new Error();
        },
    };

    t.deepEqual(cp.parse({exclude: ['foo.ts', 'bar.ts']}, 'config.yaml', mockContext), {
        extends: [],
        rules: undefined,
        settings: undefined,
        aliases: undefined,
        overrides: undefined,
        rulesDirectories: undefined,
        processor: undefined,
        exclude: ['foo.ts', 'bar.ts'],
        filename: 'config.yaml',
    });
    t.deepEqual(cp.parse({exclude: 'foo.ts'}, 'config.yaml', mockContext), {
        extends: [],
        rules: undefined,
        settings: undefined,
        aliases: undefined,
        overrides: undefined,
        rulesDirectories: undefined,
        processor: undefined,
        exclude: ['foo.ts'],
        filename: 'config.yaml',
    });

    t.throws(() => cp.parse({aliases: {a: {alias: {rule: ''}}}}, 'config.yaml', mockContext), "Alias 'a/alias' does not specify a rule.");
    t.throws(() => cp.parse({aliases: {a: {alias: {rule: 'a/alias'}}}}, 'config.yaml', mockContext), 'Circular Alias: a/alias => a/alias');
    t.throws(
        () => cp.parse({aliases: {a: {alias: {rule: 'b/alias'}}, b: {alias: {rule: 'a/alias'}}}}, 'config.yaml', mockContext),
        'Circular Alias: a/alias => b/alias => a/alias',
    );
    t.deepEqual(cp.parse({aliases: {a: {alias: {rule: 'core-rule'}}}}, 'config.yaml', mockContext), {
        extends: [],
        rules: undefined,
        settings: undefined,
        aliases: new Map([['a/alias', {rule: 'core-rule', rulesDirectories: undefined}]]),
        overrides: undefined,
        rulesDirectories: undefined,
        processor: undefined,
        exclude: undefined,
        filename: 'config.yaml',
    });
    t.deepEqual(cp.parse({rulesDirectories: {local: '.'}, aliases: {a: {alias: {rule: 'local/rule'}}}}, 'config.yaml', mockContext), {
        extends: [],
        rules: undefined,
        settings: undefined,
        aliases: new Map([['a/alias', {rule: 'rule', rulesDirectories: [process.cwd()]}]]),
        overrides: undefined,
        rulesDirectories: new Map([['local', [process.cwd()]]]),
        processor: undefined,
        exclude: undefined,
        filename: 'config.yaml',
    });
    t.deepEqual(
        cp.parse({aliases: {a: {a: {rule: 'rule', options: 1}, b: {rule: 'a/a'}, c: {rule: 'a/b', options: 2}}}}, 'c.yaml', mockContext),
        {
            extends: [],
            rules: undefined,
            settings: undefined,
            aliases: new Map([
                ['a/a', {rule: 'rule', rulesDirectories: undefined, options: 1}],
                ['a/b', {rule: 'rule', rulesDirectories: undefined, options: 1}],
                ['a/c', {rule: 'rule', rulesDirectories: undefined, options: 2}],
            ]),
            overrides: undefined,
            rulesDirectories: undefined,
            processor: undefined,
            exclude: undefined,
            filename: 'c.yaml',
        },
    );
    t.deepEqual(
        cp.parse({aliases: {a: null, b: {alias: null}}}, 'c.yaml', mockContext),
        {
            extends: [],
            rules: undefined,
            settings: undefined,
            aliases: new Map(),
            overrides: undefined,
            rulesDirectories: undefined,
            processor: undefined,
            exclude: undefined,
            filename: 'c.yaml',
        },
    );

    t.throws(
        () => cp.parse({aliases: {a: {alias: {rule: 'local/rule'}}}}, 'config.yaml', mockContext),
        "No rulesDirectories specified for 'local'.",
    );
    t.throws(
        () => cp.parse({aliases: {a: {a: {rule: 'rule'}, b: {rule: 'a/a'}, c: {rule: 'a/d'}}}}, 'c.yaml', mockContext),
        "No rulesDirectories specified for 'a'.",
    );

    t.deepEqual(
        cp.parse({overrides: []}, 'c.yaml', mockContext),
        {
            extends: [],
            rules: undefined,
            settings: undefined,
            aliases: undefined,
            overrides: [],
            rulesDirectories: undefined,
            processor: undefined,
            exclude: undefined,
            filename: 'c.yaml',
        },
    );
    t.throws(
        () => cp.parse({overrides: [{files: []}]}, 'c.yaml', mockContext),
        'Override 0 does not specify files.',
    );
    t.deepEqual(
        cp.parse({overrides: [{files: 'foo.ts', settings: {a: 1}}]}, 'c.yaml', mockContext),
        {
            extends: [],
            rules: undefined,
            settings: undefined,
            aliases: undefined,
            overrides: [{
                files: ['foo.ts'],
                settings: new Map([['a', 1]]),
                rules: undefined,
                processor: undefined,
            }],
            rulesDirectories: undefined,
            processor: undefined,
            exclude: undefined,
            filename: 'c.yaml',
        },
    );

    t.deepEqual(
        cp.parse({rules: {a: null, b: {}, c: {severity: 'warn'}, d: {options: 1}}}, 'c.yaml', mockContext),
        {
            extends: [],
            rules: new Map<string, Configuration.RuleConfig>([
                ['a', {rulesDirectories: undefined, rule: 'a'}],
                ['b', {rulesDirectories: undefined, rule: 'b'}],
                ['c', {rulesDirectories: undefined, rule: 'c', severity: 'warning'}],
                ['d', {rulesDirectories: undefined, rule: 'd', options: 1}],
            ]),
            settings: undefined,
            aliases: undefined,
            overrides: undefined,
            rulesDirectories: undefined,
            processor: undefined,
            exclude: undefined,
            filename: 'c.yaml',
        },
    );

    const testContext: LoadConfigurationContext = {
        stack: [],
        load(file) {
            switch (file) {
                case 'base.yaml':
                    return base;
                case 'base1.yaml':
                    return base1;
                case 'base2.yaml':
                    return base2;
                default:
                    throw new Error('unexpected name');
            }
        },
    };
    const base = cp.parse({aliases: {a: {one: {rule: 'rule-one'}, two: 'rule-two'}}}, 'base.yaml', testContext);
    const expectedBase: Configuration = {
        extends: [],
        rules: undefined,
        settings: undefined,
        aliases: new Map([
            ['a/one', {rule: 'rule-one', rulesDirectories: undefined}],
            ['a/two', {rule: 'rule-two', rulesDirectories: undefined}],
        ]),
        overrides: undefined,
        rulesDirectories: undefined,
        processor: undefined,
        exclude: undefined,
        filename: 'base.yaml',
    };
    t.deepEqual(base, expectedBase);

    const base1 = cp.parse({aliases: {a: {three: {rule: 'rule-three'}, two: 'other-rule-two'}}}, 'base1.yaml', testContext);
    const expectedBase1: Configuration = {
        extends: [],
        rules: undefined,
        settings: undefined,
        aliases: new Map([
            ['a/three', {rule: 'rule-three', rulesDirectories: undefined}],
            ['a/two', {rule: 'other-rule-two', rulesDirectories: undefined}],
        ]),
        overrides: undefined,
        rulesDirectories: undefined,
        processor: undefined,
        exclude: undefined,
        filename: 'base1.yaml',
    };
    t.deepEqual(base1, expectedBase1);

    const base2 = cp.parse({aliases: {a: {one: {rule: 'other-rule-one'}, two: null}}, extends: 'base.yaml'}, 'base2.yaml', testContext);
    const expectedBase2: Configuration = {
        extends: [
            expectedBase,
        ],
        rules: undefined,
        settings: undefined,
        aliases: new Map([
            ['a/one', {rule: 'other-rule-one', rulesDirectories: undefined}],
        ]),
        overrides: undefined,
        rulesDirectories: undefined,
        processor: undefined,
        exclude: undefined,
        filename: 'base2.yaml',
    };
    t.deepEqual(base2, expectedBase2);

    t.deepEqual(
        cp.parse(
            {
                rules: {'a/one': 'error', 'a/two': 'error', 'a/three': 'error', 'a/four': 'error'},
                aliases: {a: {four: 'a/three'}},
                extends: ['base1.yaml', 'base2.yaml'],
            },
            'config.yaml',
            testContext,
        ),
        {
            extends: [
                expectedBase1,
                expectedBase2,
            ],
            rules: new Map<string, Configuration.RuleConfig>([
                ['a/one', {rule: 'other-rule-one', rulesDirectories: undefined, severity: 'error'}],
                ['a/two', {rule: 'other-rule-two', rulesDirectories: undefined, severity: 'error'}],
                ['a/three', {rule: 'rule-three', rulesDirectories: undefined, severity: 'error'}],
                ['a/four', {rule: 'rule-three', rulesDirectories: undefined, severity: 'error'}],
            ]),
            settings: undefined,
            aliases: new Map([
                ['a/three', {rule: 'rule-three', rulesDirectories: undefined}],
                ['a/two', {rule: 'other-rule-two', rulesDirectories: undefined}],
                ['a/one', {rule: 'other-rule-one', rulesDirectories: undefined}],
                ['a/four', {rule: 'rule-three', rulesDirectories: undefined}],
            ]),
            overrides: undefined,
            rulesDirectories: undefined,
            processor: undefined,
            exclude: undefined,
            filename: 'config.yaml',
        },
    );

    t.deepEqual(base, expectedBase, 'extending altered the object');
    t.deepEqual(base1, expectedBase1, 'extending altered the object');
    t.deepEqual(base2, expectedBase2, 'extending altered the object');

});
