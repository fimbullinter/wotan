import 'reflect-metadata';
import { test } from 'ava';
import { DefaultCacheManager } from '../../src/services/default/cache-manager';
import { CacheIdentifier, WeakCacheIdentifier, FileSystem, CacheManager } from '../../src/types';
import { NodeDirectoryService } from '../../src/services/default/directory-service';
import * as os from 'os';
import { NodeRuleLoader } from '../../src/services/default/rule-loader-host';
import { Rule } from '../../src/rules/no-debugger';
import * as path from 'path';
import { ConsoleMessageHandler } from '../../src/services/default/message-handler';
import { ConfigurationError } from '../../src/error';
import { Container } from 'inversify';
import { NodeResolver } from '../../src/services/default/resolver';
import { NodeFileSystem } from '../../src/services/default/file-system';
import { CachedFileSystem } from '../../src/services/cached-file-system';

test('CacheManager', (t) => {
    const cm = new DefaultCacheManager();
    testWithIdentifier(new CacheIdentifier('test'));
    testWithIdentifier(new WeakCacheIdentifier('test'));

    function testWithIdentifier(id: CacheIdentifier<object, number>) {
        let cache = cm.get(id);
        t.is(cache, undefined);
        cache = cm.create(id);
        t.not(cache, undefined);
        t.is(cm.get(id), cache);
        t.is(cm.create(id), cache);
        t.is(cm.get(id), cache);
        const key = {};
        t.is(cache.get(key), undefined);
        t.is(cache.has(key), false);
        cache.delete(key);
        cache.set(key, 1);
        t.is(cache.get(key), 1);
        t.is(cache.has(key), true);
        cache.set(key, 2);
        t.is(cache.get(key), 2);
        t.is(cache.has(key), true);
        cache.delete(key);
        t.is(cache.get(key), undefined);
        t.is(cache.has(key), false);
        cache.set(key, 3);
        t.is(cache.get(key), 3);
        t.is(cache.has(key), true);
        cache.set({}, 4);
        t.is(cache.get(key), 3);
        cache.clear();
        t.is(cache.get(key), undefined);
        t.is(cache.has(key), false);
    }
});

test('DirectoryService', (t) => {
    const service = new NodeDirectoryService();
    t.is(service.getCurrentDirectory(), process.cwd());
    t.is(service.getHomeDirectory(), os.homedir());
});

test('RuleLoaderHost', (t) => {
    const loader = new NodeRuleLoader();
    t.is(loader.loadCoreRule('no-debugger'), Rule);
    t.is(loader.loadCoreRule('fooBarBaz'), undefined);
    t.throws(() => loader.loadCoreRule('../../test/fixtures/invalid'));

    t.is(loader.loadCustomRule('no-debugger', path.resolve('src/rules')), Rule);
    t.is(loader.loadCustomRule('fooBarBaz', process.cwd()), undefined);
    t.throws(() => loader.loadCustomRule('invalid', path.resolve('test/fixtures')));
});

test('MessageHandler', (t) => {
    const logger = new ConsoleMessageHandler();
    const otherLogger = new ConsoleMessageHandler();
    const {log, warn, error} = console;

    const logOutput: string[] = [];
    const warnOutput: string[] = [];
    const errorOutput: any[] = [];

    console.log = (message: string) => {
        logOutput.push(message);
    };
    console.warn = (message: string) => {
        warnOutput.push(message);
    };
    console.error = (message) => {
        errorOutput.push(message);
    };

    logger.log('foo');
    logger.log('bar');
    logger.warn('something is deprecated');
    logger.warn('something requires type information');
    logger.warn('something is deprecated');
    logger.warn('does anyone even test console output?');
    otherLogger.warn('something is deprecated');
    otherLogger.warn('something is deprecated');
    logger.log('baz');
    logger.error(new ConfigurationError('hello?'));
    const someError = new Error('not a ConfigurationError');
    logger.error(someError);

    console.log = log;
    console.warn = warn;
    console.error = error;

    t.deepEqual(logOutput, ['foo', 'bar', 'baz']);
    t.deepEqual(warnOutput, [
        'something is deprecated',
        'something requires type information',
        'does anyone even test console output?',
        'something is deprecated',
    ]);
    t.is(errorOutput.length, 2);
    t.is(errorOutput[0], 'hello?');
    t.is(errorOutput[1], someError);
});

test('Resolver', (t) => {
    const container = new Container();
    container.bind(FileSystem).to(NodeFileSystem);
    container.bind(CachedFileSystem).toSelf();
    container.bind(CacheManager).to(DefaultCacheManager);
    const resolver = container.resolve(NodeResolver);
    t.is(resolver.resolve('tsutils', process.cwd(), ['.js']), require.resolve('tsutils'));
    t.is(resolver.resolve('tsutils', '/', ['.js'], module.paths), require.resolve('tsutils'));
    t.is(resolver.resolve('./no-debugger', path.resolve('src/rules'), ['.ts']), path.resolve('src/rules/no-debugger.ts'));
});
