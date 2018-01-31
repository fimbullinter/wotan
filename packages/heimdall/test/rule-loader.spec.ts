import test from 'ava';
import { TslintRuleLoaderHost } from '../src';
import * as path from 'path';

test('loads TSLint rule as custom rule if no wotan rule is found', (t) => {
    const loader = new TslintRuleLoaderHost();
    t.is(loader.loadCustomRule('my-rule', path.resolve('./test/fixtures')), require('./fixtures/my-rule').Rule); // tslint:disable-line
    t.not(loader.loadCustomRule('semicolon', '/'), undefined);
    t.not(loader.loadCustomRule('my-tslint-rule', path.resolve('./test/fixtures')), undefined);
    t.is(loader.loadCustomRule('non-existent-rule-name', '/'), undefined);
});
