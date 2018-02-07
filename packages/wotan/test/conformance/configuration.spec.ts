import 'reflect-metadata';
import test from 'ava';
import {
    CacheManager,
    Resolver,
    DirectoryService,
    FileSystem,
    Stats,
    ConfigurationProvider,
    ReducedConfiguration,
    Configuration,
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
    t.is(
        cp.find(path.resolve(cwd, '/foo.ts')),
        path.normalize('/.homedir/.wotanrc.json'),
    );

    directories.getHomeDirectory = () => '/non-existent';
    t.is(
        cp.find(path.resolve(cwd, '/bar.ts')),
        undefined,
    );
    directories.getHomeDirectory = undefined;
    t.is(
        cp.find(path.resolve(cwd, '/baz.ts')),
        undefined,
    );
    t.is(
        cp.find(path.resolve(cwd, 'test/bas.ts')),
        path.resolve(cwd, '../.wotanrc.yaml'),
    );
});
