import test from 'ava';
import { findConfigurationPath, reduceConfigurationForFile } from '../../src/configuration';
import * as path from 'path';
import { Configuration, EffectiveConfiguration } from '../../src/types';

test('findConfigurationPath returns closest .wotanrc', (t) => {
    t.is(
        findConfigurationPath('test/fixtures/configuration/config-findup/foo.ts'),
        path.resolve('test/fixtures/configuration/config-findup/.wotanrc.yaml'),
    );
    t.is(
        findConfigurationPath('test/fixtures/configuration/config-findup/a/foo.ts'),
        path.resolve('test/fixtures/configuration/config-findup/a/.wotanrc.json'),
    );
    t.is(
        findConfigurationPath('test/fixtures/configuration/config-findup/a/aa/foo.ts'),
        path.resolve('test/fixtures/configuration/config-findup/a/.wotanrc.json'),
    );
    t.is(
        findConfigurationPath('test/fixtures/configuration/config-findup/b/foo.ts'),
        path.resolve('test/fixtures/configuration/config-findup/.wotanrc.yaml'),
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
    t.deepEqual<EffectiveConfiguration | undefined>(reduceConfigurationForFile(config, '/a.ts', '/'), {
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
    t.deepEqual<EffectiveConfiguration | undefined>(reduceConfigurationForFile(config, '/a.ts', '/'), {
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
