import test from 'ava';
import * as TSLint from 'tslint';
import { wrapTslintRule, wrapRuleForTslint } from '../src';
import * as ts from 'typescript';
import { RuleContext, Replacement, AbstractRule, TypedRule, typescriptOnly, predicate } from '@fimbul/ymir';
import { convertAst } from 'tsutils';

test('correctly wraps TSLint rule', (t) => {
    class RegularRule extends TSLint.Rules.AbstractRule {
        public apply() {
            return [];
        }
    }
    let rule = wrapTslintRule(RegularRule, 'regular');
    t.false(rule.requiresTypeInformation);
    t.false(rule.deprecated);
    t.is(rule.supports, undefined);

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
    t.truthy(rule.supports);
    t.true(rule.supports!(ts.createSourceFile('foo.tsx', '', ts.ScriptTarget.Latest), {options: undefined, settings: new Map()}));
    t.is(
        rule.supports!(ts.createSourceFile('foo.jsx', '', ts.ScriptTarget.Latest), {options: undefined, settings: new Map()}),
        'TypeScript only',
    );

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
    t.truthy(rule.supports);
    t.true(rule.supports!(ts.createSourceFile('foo.ts', '', ts.ScriptTarget.Latest), {options: undefined, settings: new Map()}));
    t.is(
        rule.supports!(ts.createSourceFile('foo.js', '', ts.ScriptTarget.Latest), {options: undefined, settings: new Map()}),
        'TypeScript only',
    );

    class MyTypedRule extends TSLint.Rules.TypedRule {
        public static metadata = <any>{
            deprecationMessage: 'foo',
        };
        public applyWithProgram() {
            return [];
        }
    }
    rule = wrapTslintRule(MyTypedRule, 'typed');
    t.true(rule.requiresTypeInformation);
    t.is(rule.deprecated, 'foo');
    t.is(rule.supports, undefined);
});

test('applies TSLint rules correctly', (t) => {
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
        addFinding(start, end, message, replacements): any {
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
    class MyTypedRule extends TSLint.Rules.OptionallyTypedRule {
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

    ruleCtor = wrapTslintRule(MyTypedRule, 'my-typed');
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
        "Adding findings for a different SourceFile is not supported. Expected 'foo.ts' but received 'other.ts' from rule 'wrong-file'.",
    );
    t.throws(
        () => new (wrapTslintRule(WrongFileFailureRule))(context).apply(),
        "Adding findings for a different SourceFile is not supported. Expected 'foo.ts' but received 'other.ts' from rule 'rule.spec'.",
    );

    class AnotherWrongFileFailureRule extends TSLint.Rules.AbstractRule {
        public static metadata: TSLint.IRuleMetadata = {
            type: 'typescript',
            description: '',
            optionsDescription: '',
            options: undefined,
            ruleName: 'some-name',
            typescriptOnly: false,
        };
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
        () => new (wrapTslintRule(AnotherWrongFileFailureRule))(context).apply(),
        "Adding findings for a different SourceFile is not supported. Expected 'foo.ts' but received 'other.ts' from rule 'some-name'.",
    );
});

test('correctly wraps rule for TSLint', (t) => {
    class RegularRule extends AbstractRule {
        public apply() {
        }
    }
    let rule = wrapRuleForTslint(RegularRule);
    t.false(rule.metadata.typescriptOnly);
    t.is(rule.metadata.deprecationMessage, undefined);
    t.truthy(rule.prototype.apply);
    t.truthy(rule.prototype.applyWithProgram);

    class MyTypedRule extends TypedRule {
        public static deprecated = true;
        public apply() {
        }
    }
    rule = wrapRuleForTslint(MyTypedRule);
    t.truthy(rule.prototype.apply);
    t.is(rule.prototype.apply, TSLint.Rules.TypedRule.prototype.apply);
    t.is(rule.metadata.deprecationMessage, '');

    class MyDeprecatedRule extends AbstractRule {
        public static deprecated = "don't use this any longer";
        public apply() {}
    }
    rule = wrapRuleForTslint(MyDeprecatedRule);
    t.is(rule.metadata.deprecationMessage, "don't use this any longer");
});

test('correctly applies rule when wrapped for TSLint', (t) => {
    @typescriptOnly
    class TypeScriptOnlyRule extends AbstractRule {
        public static supports(sourceFile: ts.SourceFile) {
            return !sourceFile.isDeclarationFile;
        }
        public apply() {
            t.is(this.context.options, 'foo');
            if (this.context.program !== undefined)
                t.is(this.context.program, <any>'');
            this.addFinding(0, 0, 'test message');
        }
    }
    let wrapped = wrapRuleForTslint(TypeScriptOnlyRule);
    let rule = <TSLint.Rules.OptionallyTypedRule>new wrapped(
        {ruleArguments: ['foo'], disabledIntervals: [], ruleName: 'some-name', ruleSeverity: 'error'},
    );
    const jsSourceFile = ts.createSourceFile('foo.js', ';', ts.ScriptTarget.ESNext);
    t.deepEqual(
        rule.apply(jsSourceFile),
        [],
    );
    t.deepEqual(
        rule.applyWithProgram(jsSourceFile, <any>''),
        [],
    );
    const tsSourceFile = ts.createSourceFile('foo.ts', ';', ts.ScriptTarget.ESNext);
    t.deepEqual(
        rule.apply(tsSourceFile),
        [new TSLint.RuleFailure(tsSourceFile, 0, 0, 'test message', 'some-name')],
    );
    t.deepEqual(
        rule.applyWithProgram(tsSourceFile, <any>''),
        [new TSLint.RuleFailure(tsSourceFile, 0, 0, 'test message', 'some-name')],
    );

    t.deepEqual(
        rule.apply(ts.createSourceFile('foo.d.ts', '', ts.ScriptTarget.ESNext)),
        [],
    );

    @predicate((_, {program, compilerOptions}) => program!.getCompilerOptions() === compilerOptions)
    class MyTypedRule extends TypedRule {
        public apply() {
            t.is(this.program.getCompilerOptions(), this.context.compilerOptions);
            t.deepEqual(this.context.getFlatAst(), convertAst(tsSourceFile).flat);
            t.deepEqual(this.context.getWrappedAst(), convertAst(tsSourceFile).wrapped);
            t.deepEqual(this.context.options, ['foo', 'bar']);
            this.addFinding(0, 0, 'message', Replacement.replace(0, 1, 'x'));
        }
    }
    wrapped = wrapRuleForTslint(MyTypedRule);
    rule = <TSLint.Rules.OptionallyTypedRule>new wrapped(
        {ruleArguments: ['foo', 'bar'], disabledIntervals: [], ruleName: 'some-other-name', ruleSeverity: 'error'},
    );
    t.deepEqual(
        rule.applyWithProgram(tsSourceFile, <any>{getCompilerOptions() { return this; }}),
        [new TSLint.RuleFailure(tsSourceFile, 0, 0, 'message', 'some-other-name', [TSLint.Replacement.replaceFromTo(0, 1, 'x')])],
    );
});
