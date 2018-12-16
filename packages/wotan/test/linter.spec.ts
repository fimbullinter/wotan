import 'reflect-metadata';
import test from 'ava';
import { Container, injectable } from 'inversify';
import {
    CacheFactory,
    RuleLoaderHost,
    MessageHandler,
    TypedRule,
    RuleConstructor,
    AbstractRule,
    DeprecationHandler,
    EffectiveConfiguration,
    Failure,
    Replacement,
    FailureFilterFactory,
    LineSwitchParser,
} from '@fimbul/ymir';
import { DefaultCacheFactory } from '../src/services/default/cache-factory';
import { RuleLoader } from '../src/services/rule-loader';
import { Linter } from '../src/linter';
import * as ts from 'typescript';
import { DefaultDeprecationHandler } from '../src/services/default/deprecation-handler';
import { LineSwitchFilterFactory, DefaultLineSwitchParser } from '../src/services/default/line-switches';

class MyTypedRule extends TypedRule {
    public apply() {
        this.addFailure(0, 0, 'message');
    }
}
class MyDeprecatedRule extends AbstractRule {
    public static deprecated: boolean | string = true;
    public apply() {
        this.addFailure(0, 0, 'message', []);
    }
}
class MyCustomDeprecatedRule extends AbstractRule {
    public static deprecated = 'Use that other rule instead.';
    public apply() {
        this.addFailure(0, 0, 'message', [Replacement.append(0, '\uFEFF')]);
    }
}

test('Linter', (t) => {
    const warnings: string[] = [];
    const container = new Container();
    container.bind(CacheFactory).to(DefaultCacheFactory);
    container.bind(RuleLoader).toSelf();
    container.bind(DeprecationHandler).to(DefaultDeprecationHandler);
    container.bind(FailureFilterFactory).to(LineSwitchFilterFactory);
    container.bind(LineSwitchParser).to(DefaultLineSwitchParser);
    container.bind(MessageHandler).toConstantValue({
        log() {
            throw new Error('not implemented');
        },
        warn(message) {
            warnings.push(message);
        },
        error() {
            throw new Error('not implemented');
        },
    });
    @injectable()
    class Host implements RuleLoaderHost {
        public loadCoreRule(name: string): RuleConstructor | undefined {
            switch (name) {
                case 'typed':
                    return <RuleConstructor>MyTypedRule;
                case 'deprecated':
                    return MyDeprecatedRule;
                case 'deprecation-message':
                    return MyCustomDeprecatedRule;
            }
            return;
        }

        public loadCustomRule(): undefined {
            return;
        }
    }
    container.bind(RuleLoaderHost).to(Host);

    const sourceFile = ts.createSourceFile('/foo.ts', 'foo;', ts.ScriptTarget.ESNext);
    const linter = container.resolve(Linter);
    t.deepEqual(
        linter.lintFile(sourceFile, {
            settings: new Map(),
            rules: new Map<string, EffectiveConfiguration.RuleConfig>([
                ['my/alias', {severity: 'warning', rulesDirectories: undefined, options: undefined, rule: 'typed'}],
            ]),
        }),
        [],
    );
    t.deepEqual(warnings, ["Rule 'my/alias' requires type information."]);

    t.deepEqual(
        linter.lintFile(sourceFile, {
            settings: new Map(),
            rules: new Map<string, EffectiveConfiguration.RuleConfig>([
                ['my/alias', {severity: 'off', rulesDirectories: undefined, options: undefined, rule: 'deprecated'}],
            ]),
        }),
        [],
    );
    t.is(warnings.length, 1);

    t.deepEqual<ReadonlyArray<Failure>>(
        linter.lintFile(sourceFile, {
            settings: new Map(),
            rules: new Map<string, EffectiveConfiguration.RuleConfig>([
                ['my/alias', {severity: 'warning', rulesDirectories: undefined, options: undefined, rule: 'deprecated'}],
            ]),
        }),
        [{
            ruleName: 'my/alias',
            fix: undefined,
            message: 'message',
            severity: 'warning',
            start: {position: 0, line: 0, character: 0},
            end: {position: 0, line: 0, character: 0},
        }],
    );
    t.is(warnings.length, 2);
    t.is(warnings[1], "Rule 'my/alias' is deprecated.");

    t.deepEqual<ReadonlyArray<Failure>>(
        linter.lintFile(sourceFile, {
            settings: new Map(),
            rules: new Map<string, EffectiveConfiguration.RuleConfig>([
                ['my/other/alias', {severity: 'error', rulesDirectories: undefined, options: undefined, rule: 'deprecation-message'}],
            ]),
        }),
        [{
            ruleName: 'my/other/alias',
            fix: {
                replacements: [{start: 0, end: 0, text: '\uFEFF'}],
            },
            message: 'message',
            severity: 'error',
            start: {position: 0, line: 0, character: 0},
            end: {position: 0, line: 0, character: 0},
        }],
    );
    t.is(warnings.length, 3);
    t.is(warnings[2], "Rule 'my/other/alias' is deprecated: Use that other rule instead.");

    t.deepEqual<ReadonlyArray<Failure>>(
        linter.lintFile(sourceFile, {
            settings: new Map(),
            rules: new Map<string, EffectiveConfiguration.RuleConfig>([
                ['my/other/alias', {severity: 'error', rulesDirectories: undefined, options: undefined, rule: 'non-existent'}],
            ]),
        }),
        [],
    );
    t.is(warnings.length, 4);
    t.is(warnings[3], "Could not find core rule 'non-existent'.");

    t.deepEqual<ReadonlyArray<Failure>>(
        linter.lintFile(sourceFile, {
            settings: new Map(),
            rules: new Map<string, EffectiveConfiguration.RuleConfig>([
                ['my/other/alias', {severity: 'error', rulesDirectories: ['/foo'], options: undefined, rule: 'non-existent'}],
            ]),
        }),
        [],
    );
    t.is(warnings.length, 5);
    t.is(warnings[4], "Could not find rule 'non-existent' in /foo.");
});
