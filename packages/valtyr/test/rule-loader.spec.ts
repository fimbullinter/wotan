import test, {TestContext} from 'ava';
import { TslintRuleLoaderHost } from '../src/rule-loader';
import * as ts from 'typescript';
import { RuleConstructor } from '@fimbul/wotan';
import * as path from 'path';

function testRule(t: TestContext, ctor: RuleConstructor, start: number, end: number, message: string) {
    let called = false;
    const instance = new ctor({
        options: undefined,
        settings: new Map(),
        addFailure(s, e, m) {
            t.is(s, start);
            t.is(e, end);
            t.is(m, message);
            called = true;
        },
        getFlatAst(): any {},
        getWrappedAst(): any {},
        sourceFile: ts.createSourceFile('foo.ts', 'a;', ts.ScriptTarget.Latest),
    });
    instance.apply();
    t.true(called);
}

test('loads core TSLint rule', (t) => {
    const loader = new TslintRuleLoaderHost();
    const rule = loader.loadCoreRule('eofline');
    t.truthy(rule);
    testRule(t, rule!, 2, 2, 'file should end with a newline');
});

test('loads core TSLint rule when directory given', (t) => {
    const loader = new TslintRuleLoaderHost();
    const rule = loader.loadCustomRule('eofline', path.join(__dirname, 'fixtures'));
    t.truthy(rule);
    testRule(t, rule!, 2, 2, 'file should end with a newline');
});

test('loads custom TSLint rule', (t) => {
    const loader = new TslintRuleLoaderHost();
    const rule = loader.loadCustomRule('my-rule', path.join(__dirname, 'fixtures'));
    t.truthy(rule);
    testRule(t, rule!, 0, 0, 'test message');
});

test('returns undefined if no rule is found', (t) => {
    const loader = new TslintRuleLoaderHost();
    t.is(loader.loadCoreRule('non-existent-core-rule'), undefined);
    t.is(loader.loadCustomRule('my-non-existent-rule', path.join(__dirname, 'fixtures')), undefined);
});
