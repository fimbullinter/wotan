import test from 'ava';
import * as path from 'path';
import * as TSLint from 'tslint';
import { TslintConfigurationProvider } from '../src/configuration-provider';
import { Container } from 'inversify';
import { createCoreModule, createDefaultModule, ConfigurationProvider, Configuration, GlobalOptions } from '@fimbul/wotan';
import * as resolve from 'resolve';

test('resolve', (t) => {
    const container = new Container();
    container.bind(ConfigurationProvider).to(TslintConfigurationProvider);
    container.load(createCoreModule({}), createDefaultModule());
    const cp = container.get(ConfigurationProvider);
    t.regex(cp.resolve('tslint:all', '').replace(/\\/g, '/'), /\/tslint\/.*\/configs\/all.js$/);
    t.throws(
        () => cp.resolve('tslint:non-existent-name', ''),
        { message: "'tslint:non-existent-name' is not a valid builtin configuration, try 'tslint:recommended.'" },
    );

    t.is(cp.resolve('./fixtures/tslint.json', __dirname), path.resolve(__dirname, 'fixtures/tslint.json'));
    t.throws(() => cp.resolve('fixtures/tslint.json', __dirname));
});

test('find', (t) => {
    const container = new Container();
    container.bind(ConfigurationProvider).to(TslintConfigurationProvider);
    container.load(createCoreModule({}), createDefaultModule());
    const cp = container.get(ConfigurationProvider);

    // don't know if this is a good idea, might fail if someone has a tslint.json in their home directory
    t.is(cp.find(path.join(path.parse(process.cwd()).root, 'file.ts')), undefined);
    t.is(cp.find(path.join(__dirname, 'fixtures/subdir/file.ts')), path.join(__dirname, 'fixtures/tslint.json'));
    t.is(cp.find(path.join(__dirname, 'fixtures/file.ts')), path.join(__dirname, 'fixtures/tslint.json'));
});

test('parse', (t) => {
    const container = new Container();
    container.load(createCoreModule({}), createDefaultModule());
    container.bind(TslintConfigurationProvider).toSelf();
    let cp = container.get(TslintConfigurationProvider);

    t.deepEqual(
        cp.parse(
            {
                extends: [],
                linterOptions: {},
                jsRules: new Map(),
                rulesDirectory: [],
                rules: new Map<string, Partial<TSLint.IOptions>>([
                    ['foo', {ruleSeverity: 'error'}],
                    ['bar', {ruleSeverity: 'off', ruleArguments: ['test']}],
                ]),
            },
            'filename.ts',
        ),
        {
            filename: 'filename.ts',
            extends: [],
            exclude: undefined,
            overrides: [
                {
                    files: ['*', '!*.js?(x)'],
                    rules: new Map<string, Configuration.RuleConfig>([
                        ['foo', {rule: 'foo', options: undefined, rulesDirectories: undefined, severity: 'error'}],
                        ['bar', {rule: 'bar', options: ['test'], rulesDirectories: undefined, severity: 'off'}],
                    ]),
                },
            ],
        },
    );

    t.deepEqual(
        cp.parse(
            {
                extends: [],
                rules: new Map(),
                rulesDirectory: ['/foo'],
                jsRules: new Map<string, Partial<TSLint.IOptions>>([
                    ['foo', {ruleSeverity: 'error'}],
                    ['bar', {ruleSeverity: 'off', ruleArguments: ['test']}],
                ]),
            },
            'filename.ts',
        ),
        {
            filename: 'filename.ts',
            extends: [],
            exclude: undefined,
            overrides: [
                {
                    files: ['*.js?(x)'],
                    rules: new Map<string, Configuration.RuleConfig>([
                        ['foo', {rule: 'foo', options: undefined, rulesDirectories: ['/foo'], severity: 'error'}],
                        ['bar', {rule: 'bar', options: ['test'], rulesDirectories: ['/foo'], severity: 'off'}],
                    ]),
                },
            ],
        },
    );

    container.rebind(GlobalOptions).toConstantValue({valtyr: {exclude: ['foo.ts']}});
    cp = container.get(TslintConfigurationProvider);
    t.throws(
        () => cp.parse({extends: [], jsRules: new Map(), rules: new Map(), rulesDirectory: []}, 'tslint.json'),
        { message: "Error parsing global configuration for 'valtyr': 'exclude' is not allowed in global configuration." },
    );

    container.rebind(GlobalOptions).toConstantValue({valtyr: {extends: 'wotan:recommended'}});
    cp = container.get(TslintConfigurationProvider);
    t.throws(
        () => cp.parse({extends: [], jsRules: new Map(), rules: new Map(), rulesDirectory: []}, 'tslint.json'),
        { message: "Error parsing global configuration for 'valtyr': Global configuration is not allowed to extend other configs." },
    );

    container.rebind(GlobalOptions).toConstantValue({valtyr: {processor: '@fimbul/ve'}});
    cp = container.get(TslintConfigurationProvider);
    t.deepEqual(
        cp.parse({extends: [], jsRules: new Map(), rules: new Map(), rulesDirectory: []}, 'tslint.json'),
        {
            filename: 'tslint.json',
            extends: [{
                filename: path.resolve('.fimbullinter.yaml'),
                extends: [],
                settings: undefined,
                aliases: undefined,
                rules: undefined,
                rulesDirectories: undefined,
                exclude: undefined,
                processor: resolve.sync('@fimbul/ve', {basedir: process.cwd()}),
                overrides: undefined,
            }],
            overrides: [],
            exclude: undefined,
        },
    );

    container.rebind(GlobalOptions).toConstantValue({
        valtyr: {overrides: [{files: '*.vue', processor: '@fimbul/ve'}], settings: {foo: 'bar'}},
    });
    cp = container.get(TslintConfigurationProvider);
    t.deepEqual(
        cp.parse({extends: [], jsRules: new Map(), rules: new Map(), rulesDirectory: []}, 'tslint.json'),
        {
            filename: 'tslint.json',
            extends: [{
                filename: path.resolve('.fimbullinter.yaml'),
                extends: [],
                settings: new Map([['foo', 'bar']]),
                aliases: undefined,
                rules: undefined,
                rulesDirectories: undefined,
                exclude: undefined,
                processor: undefined,
                overrides: [{
                    files: ['*.vue'],
                    processor: resolve.sync('@fimbul/ve', {basedir: process.cwd()}),
                    rules: undefined,
                    settings: undefined,
                }],
            }],
            overrides: [],
            exclude: undefined,
        },
    );
});
