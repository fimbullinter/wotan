import test from 'ava';
import * as TSLint from 'tslint';
import { wrapTslintRule } from '../src';
import * as ts from 'typescript';
import { RuleContext, Replacement } from '@fimbul/wotan';

test('correctly wraps rule', (t) => {
    class RegularRule extends TSLint.Rules.AbstractRule {
        public apply() {
            return [];
        }
    }
    let rule = wrapTslintRule(RegularRule, 'regular');
    t.false(rule.requiresTypeInformation);
    t.false(rule.deprecated);
    t.true(rule.supports!(ts.createSourceFile('foo.ts', '', ts.ScriptTarget.Latest), undefined, new Map()));
    t.true(rule.supports!(ts.createSourceFile('foo.js', '', ts.ScriptTarget.Latest), undefined, new Map()));

    class TypescriptOnlyRule extends TSLint.Rules.AbstractRule {
        public static metadata = <any>{
            typescriptOnly: true,
            deprecationMessage: '',
        };
        public apply() {
            return [];
        }
    }
    rule = wrapTslintRule(TypescriptOnlyRule, 'ts-only');
    t.false(rule.requiresTypeInformation);
    t.true(rule.deprecated);
    t.true(rule.supports!(ts.createSourceFile('foo.tsx', '', ts.ScriptTarget.Latest), undefined, new Map()));
    t.false(rule.supports!(ts.createSourceFile('foo.jsx', '', ts.ScriptTarget.Latest), undefined, new Map()));

    class TypescriptOnlyTypedRule extends TSLint.Rules.AbstractRule {
        public static metadata = <any>{
            typescriptOnly: true,
            requiresTypeInfo: true,
        };
        public apply() {
            return [];
        }
    }
    rule = wrapTslintRule(TypescriptOnlyTypedRule, 'ts-only-typed');
    t.true(rule.requiresTypeInformation);
    t.false(rule.deprecated);
    t.true(rule.supports!(ts.createSourceFile('foo.ts', '', ts.ScriptTarget.Latest), undefined, new Map()));
    t.false(rule.supports!(ts.createSourceFile('foo.js', '', ts.ScriptTarget.Latest), undefined, new Map()));

    class TypedRule extends TSLint.Rules.TypedRule {
        public static metadata = <any>{
            deprecationMessage: 'foo',
        };
        public applyWithProgram() {
            return [];
        }
    }
    rule = wrapTslintRule(TypedRule, 'typed');
    t.true(rule.requiresTypeInformation);
    t.is(rule.deprecated, 'foo');
    t.true(rule.supports!(ts.createSourceFile('foo.tsx', '', ts.ScriptTarget.Latest), undefined, new Map()));
    t.true(rule.supports!(ts.createSourceFile('foo.jsx', '', ts.ScriptTarget.Latest), undefined, new Map()));
});

test('applies rules correctly', (t) => {
    let expectedOptions: any;
    let fix: TSLint.Fix | undefined;
    let expectedReplacement: Replacement[] = [];
    class TestRule extends TSLint.Rules.AbstractRule {
        constructor(options: TSLint.IOptions) {
            super(options);
            t.is(options.ruleName, 'foo-bar');
            t.deepEqual(options.disabledIntervals, []);
            t.is(options.ruleSeverity, 'error');
            t.deepEqual(options.ruleArguments, expectedOptions);
        }
        public apply(sourceFile: ts.SourceFile) {
            return [new TSLint.RuleFailure(sourceFile, 0, 5, 'some message', 'my-rule', fix)];
        }
    }
    let ruleCtor = wrapTslintRule(TestRule, 'foo-bar');
    const context: RuleContext = {
        addFailure(start, end, message, replacements): any {
            t.is(start, 0);
            t.is(end, 5);
            t.is(message, 'some message');
            t.deepEqual(replacements, expectedReplacement);
        },
        getFlatAst(): any {},
        getWrappedAst(): any {},
        sourceFile: ts.createSourceFile('foo.ts', '', ts.ScriptTarget.Latest),
        options: undefined,
        settings: new Map(),
        program: undefined,
    };
    expectedOptions = [];
    t.notThrows(() => new ruleCtor(context));
    (<any>context).options = 'foo';
    expectedOptions = ['foo'];
    t.notThrows(() => new ruleCtor(context));
    (<any>context).options = ['bar'];
    expectedOptions = ['bar'];
    t.notThrows(() => new ruleCtor(context));

    new ruleCtor(context).apply();

    fix = TSLint.Replacement.appendText(0, 'x');
    expectedReplacement = [Replacement.append(0, 'x')];
    (<any>context).program = true;
    new ruleCtor(context).apply();

    fix = [fix];
    new ruleCtor(context).apply();

    let applyCalled = false;
    let applyWithProgramCalled = false;
    class TypedRule extends TSLint.Rules.OptionallyTypedRule {
        public apply() {
            applyCalled = true;
            applyWithProgramCalled = false;
            return [];
        }
        public applyWithProgram() {
            applyWithProgramCalled = true;
            applyCalled = false;
            return [];
        }
    }

    ruleCtor = wrapTslintRule(TypedRule, 'my-typed');
    new ruleCtor(context).apply();
    t.true(applyWithProgramCalled);

    (<any>context).program = undefined;
    new ruleCtor(context).apply();
    t.true(applyCalled);

    class DisabledRule extends TSLint.Rules.AbstractRule {
        public isEnabled() {
            return false;
        }
        public apply(): never {
            throw new Error('should not be called');
        }
    }
    new (wrapTslintRule(DisabledRule, 'disabled'))(context).apply();

    class WrongFileFailureRule extends TSLint.Rules.AbstractRule {
        public apply() {
            return [new TSLint.RuleFailure(
                ts.createSourceFile('other.ts', '', ts.ScriptTarget.Latest),
                0,
                0,
                '',
                '',
            )];
        }
    }
    t.throws(
        () => new (wrapTslintRule(WrongFileFailureRule, 'wrong-file'))(context).apply(),
        "Adding failures for a different SourceFile is not supported. Expected 'foo.ts' but received 'other.ts' from rule 'wrong-file'.",
    );
});
