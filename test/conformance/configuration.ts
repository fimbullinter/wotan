import test from 'ava';
import { findConfigurationPath } from '../../src/configuration';
import * as path from 'path';

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
