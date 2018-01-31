"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = require("ava");
const TSLint = require("tslint");
const src_1 = require("../src");
const ts = require("typescript");
const wotan_1 = require("@fimbul/wotan");
ava_1.default('correctly wraps rule', (t) => {
    class RegularRule extends TSLint.Rules.AbstractRule {
        apply() {
            return [];
        }
    }
    let rule = src_1.wrapTslintRule(RegularRule, 'regular');
    t.false(rule.requiresTypeInformation);
    t.false(rule.deprecated);
    t.true(rule.supports(ts.createSourceFile('foo.ts', '', ts.ScriptTarget.Latest), undefined, new Map()));
    t.true(rule.supports(ts.createSourceFile('foo.js', '', ts.ScriptTarget.Latest), undefined, new Map()));
    class TypescriptOnlyRule extends TSLint.Rules.AbstractRule {
        apply() {
            return [];
        }
    }
    TypescriptOnlyRule.metadata = {
        typescriptOnly: true,
        deprecationMessage: '',
    };
    rule = src_1.wrapTslintRule(TypescriptOnlyRule, 'ts-only');
    t.false(rule.requiresTypeInformation);
    t.true(rule.deprecated);
    t.true(rule.supports(ts.createSourceFile('foo.tsx', '', ts.ScriptTarget.Latest), undefined, new Map()));
    t.false(rule.supports(ts.createSourceFile('foo.jsx', '', ts.ScriptTarget.Latest), undefined, new Map()));
    class TypescriptOnlyTypedRule extends TSLint.Rules.AbstractRule {
        apply() {
            return [];
        }
    }
    TypescriptOnlyTypedRule.metadata = {
        typescriptOnly: true,
        requiresTypeInfo: true,
    };
    rule = src_1.wrapTslintRule(TypescriptOnlyTypedRule, 'ts-only-typed');
    t.true(rule.requiresTypeInformation);
    t.false(rule.deprecated);
    t.true(rule.supports(ts.createSourceFile('foo.ts', '', ts.ScriptTarget.Latest), undefined, new Map()));
    t.false(rule.supports(ts.createSourceFile('foo.js', '', ts.ScriptTarget.Latest), undefined, new Map()));
    class TypedRule extends TSLint.Rules.TypedRule {
        applyWithProgram() {
            return [];
        }
    }
    TypedRule.metadata = {
        deprecationMessage: 'foo',
    };
    rule = src_1.wrapTslintRule(TypedRule, 'typed');
    t.true(rule.requiresTypeInformation);
    t.is(rule.deprecated, 'foo');
    t.true(rule.supports(ts.createSourceFile('foo.tsx', '', ts.ScriptTarget.Latest), undefined, new Map()));
    t.true(rule.supports(ts.createSourceFile('foo.jsx', '', ts.ScriptTarget.Latest), undefined, new Map()));
});
ava_1.default('applies rules correctly', (t) => {
    let expectedOptions;
    let fix = undefined;
    let expectedReplacement = [];
    class TestRule extends TSLint.Rules.AbstractRule {
        constructor(options) {
            super(options);
            t.is(options.ruleName, 'foo-bar');
            t.deepEqual(options.disabledIntervals, []);
            t.is(options.ruleSeverity, 'error');
            t.deepEqual(options.ruleArguments, expectedOptions);
        }
        apply(sourceFile) {
            return [new TSLint.RuleFailure(sourceFile, 0, 5, 'some message', 'my-rule', fix)];
        }
    }
    let ruleCtor = src_1.wrapTslintRule(TestRule, 'foo-bar');
    const context = {
        addFailure(start, end, message, replacements) {
            t.is(start, 0);
            t.is(end, 5);
            t.is(message, 'some message');
            t.deepEqual(replacements, expectedReplacement);
        },
        getFlatAst() { },
        getWrappedAst() { },
        isDisabled() { },
        sourceFile: ts.createSourceFile('foo.ts', '', ts.ScriptTarget.Latest),
        options: undefined,
        settings: new Map(),
        program: undefined,
    };
    expectedOptions = [];
    t.notThrows(() => new ruleCtor(context));
    context.options = 'foo';
    expectedOptions = ['foo'];
    t.notThrows(() => new ruleCtor(context));
    context.options = ['bar'];
    expectedOptions = ['bar'];
    t.notThrows(() => new ruleCtor(context));
    new ruleCtor(context).apply();
    fix = TSLint.Replacement.appendText(0, 'x');
    expectedReplacement = [wotan_1.Replacement.append(0, 'x')];
    context.program = true;
    new ruleCtor(context).apply();
    fix = [fix];
    new ruleCtor(context).apply();
    let applyCalled = false;
    let applyWithProgramCalled = false;
    class TypedRule extends TSLint.Rules.OptionallyTypedRule {
        apply() {
            applyCalled = true;
            applyWithProgramCalled = false;
            return [];
        }
        applyWithProgram() {
            applyWithProgramCalled = true;
            applyCalled = false;
            return [];
        }
    }
    ruleCtor = src_1.wrapTslintRule(TypedRule, 'my-typed');
    new ruleCtor(context).apply();
    t.true(applyWithProgramCalled);
    context.program = undefined;
    new ruleCtor(context).apply();
    t.true(applyCalled);
    class DisabledRule extends TSLint.Rules.AbstractRule {
        isEnabled() {
            return false;
        }
        apply() {
            throw new Error('should not be called');
        }
    }
    new (src_1.wrapTslintRule(DisabledRule, 'disabled'))(context).apply();
});
//# sourceMappingURL=rule.spec.js.map