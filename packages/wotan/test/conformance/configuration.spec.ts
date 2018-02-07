import 'reflect-metadata';
import test from 'ava';
import {
    CacheManager,
    Resolver,
    DirectoryService,
    FileSystem,
    Stats,
    ConfigurationProvider,
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

// tslint:disable:no-null-keyword

test('ConfigurationManager', (t) => {
    const configProvider: ConfigurationProvider = {
        find(file) {
            return file;
        },
        resolve(file, _basedir) {
            return file;
        },
        load(_file, _context) {
            throw new Error();
        },
    };

    const cm = new ConfigurationManager(new NodeDirectoryService(), configProvider, new DefaultCacheManager());
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
});

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
