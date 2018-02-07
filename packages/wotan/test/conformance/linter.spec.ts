import 'reflect-metadata';
import { test } from 'ava';
import { Container, injectable } from 'inversify';
import {
    CacheManager,
    RuleLoaderHost,
    MessageHandler,
    TypedRule,
    RuleConstructor,
    AbstractRule,
    DeprecationHandler,
    EffectiveConfiguration,
    Failure,
    Replacement,
    LineSwitchParser,
} from '../../src/types';
import { DefaultCacheManager } from '../../src/services/default/cache-manager';
import { RuleLoader } from '../../src/services/rule-loader';
import { Linter } from '../../src/linter';
import * as ts from 'typescript';
import { DefaultDeprecationHandler } from '../../src/services/default/deprecation-handler';
import { LineSwitchService } from '../../src/services/line-switches';
import { DefaultLineSwitchParser } from '../../src/services/default/line-switch-parser';

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
    container.bind(CacheManager).to(DefaultCacheManager);
    container.bind(RuleLoader).toSelf();
    container.bind(DeprecationHandler).to(DefaultDeprecationHandler);
    container.bind(LineSwitchService).toSelf();
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

    t.deepEqual<Failure[]>(
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

    t.deepEqual<Failure[]>(
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

    t.deepEqual<Failure[]>(
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

    t.deepEqual<Failure[]>(
        linter.lintFile(sourceFile, {
            settings: new Map(),
            rules: new Map<string, EffectiveConfiguration.RuleConfig>([
                ['my/other/alias', {severity: 'error', rulesDirectories: ['/foo'], options: undefined, rule: 'my/non-existent'}],
            ]),
        }),
        [],
    );
    t.is(warnings.length, 5);
    t.is(warnings[4], "Could not find rule 'non-existent' in /foo.");

    t.throws(
        () => linter.lintFile(sourceFile, {
            settings: new Map(),
            rules: new Map<string, EffectiveConfiguration.RuleConfig>([
                ['my/other/alias', {severity: 'error', rulesDirectories: undefined, options: undefined, rule: 'my/non-existent'}],
            ]),
        }),
        "No 'rulesDirectories' for rule 'my/non-existent'.",
    );
});
