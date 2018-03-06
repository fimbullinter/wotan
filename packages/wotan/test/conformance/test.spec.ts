import 'reflect-metadata';
import test from 'ava';
import { isCodeLine, createBaselineDiff, createBaseline, RuleTestHost, RuleTester, BaselineKind } from '../../src/test';
import chalk, { Level } from 'chalk';
import { Failure, FileSummary, LintResult } from '@fimbul/ymir';
import { Runner, LintOptions } from '../../src/runner';

test.before(() => {
    chalk.enabled = true;
    chalk.level = Level.Basic;
});

test('isCodeLine', (t) => {
    t.true(isCodeLine(''));
    t.true(isCodeLine('a'));
    t.true(isCodeLine('~[]'));
    t.true(isCodeLine('~~nil'));
    t.true(isCodeLine('~nil '));
    t.true(isCodeLine('a = b'));
    t.true(isCodeLine('[error]'));
    t.true(isCodeLine('~ [foo'));
    t.true(isCodeLine('~~ '));
    t.false(isCodeLine('~nil'));
    t.false(isCodeLine(' ~nil'));
    t.false(isCodeLine('~~~~~~~~~~~'));
    t.false(isCodeLine('~~~~~~~~~~~ [a]'));
    t.false(isCodeLine(' ~nil     [error]'));
});

test('createBaselineDiff', (t) => {
    diff(
        '\uFEFFtest',
        'test',
        'BOM',
    );

    diff(
        'foo = bar;',
        'foo = bar;',
        'equal',
    );

    diff(
        'a\nc\n',
        'a\nb\nc\n',
        'missing code line',
    );

    diff(
        'a\r\n~ [error]\n',
        'a\n~ [erreur]\n',
        'CR',
    );

    diff(
        'a\n~nil\n',
        'a\n',
        'additional error line',
    );

    diff(
        '    ',
        '\t\t\t\t',
        'tabs vs spaces',
    );

    function diff(a: string, b: string, name: string) {
        t.snapshot(createBaselineDiff(a, b), {id: `createBaselineDiff ${name}`});
    }
});

test('createBaseline', (t) => {
    const content = `export {};
let foo = 'foo';
let bar = foo;
`;
    apply('valid', []);
    apply('multiline', [{
        ruleName: 'multiline',
        message: 'I am groot',
        severity: 'error',
        start: {
            position: 0,
            line: 0,
            character: 0,
        },
        end: {
            position: content.length,
            line: 3,
            character: 0,
        },
        fix: undefined,
    }]);
    apply('zero length', [{
        ruleName: 'rule',
        message: 'where is my squiggly tail',
        severity: 'warning',
        start: {
            position: 1,
            line: 0,
            character: 1,
        },
        end: {
            position: 1,
            line: 0,
            character: 1,
        },
        fix: undefined,
    }]);
    const mixed: Failure[] = [
        {
            ruleName: 'multiline',
            message: 'I am groot',
            severity: 'error',
            start: {
                position: 0,
                line: 0,
                character: 0,
            },
            end: {
                position: content.length,
                line: 3,
                character: 0,
            },
            fix: undefined,
        },
        {
            ruleName: 'rule',
            message: 'where is my squiggly tail',
            severity: 'warning',
            start: {
                position: 1,
                line: 0,
                character: 1,
            },
            end: {
                position: 1,
                line: 0,
                character: 1,
            },
            fix: undefined,
        },
        {
            ruleName: 'rule',
            message: 'where is my squiggly tail',
            severity: 'error',
            start: {
                position: 1,
                line: 0,
                character: 1,
            },
            end: {
                position: 1,
                line: 0,
                character: 1,
            },
            fix: undefined,
        },
        {
            ruleName: 'other',
            message: 'two lines',
            severity: 'warning',
            start: {
                position: 1,
                line: 0,
                character: 1,
            },
            end: {
                position: content.indexOf('foo'),
                line: 1,
                character: 4,
            },
            fix: undefined,
        },
        {
            ruleName: 'another',
            message: 'other two lines',
            severity: 'error',
            start: {
                position: content.indexOf('let'),
                line: 1,
                character: 0,
            },
            end: {
                position: content.indexOf('bar'),
                line: 2,
                character: 4,
            },
            fix: undefined,
        },
    ];
    apply('mixed', mixed);

    verify('no eofline', {
        content: 'let foo;',
        failures: [{
            ruleName: 'rule',
            message: 'where is my squiggly tail',
            severity: 'warning',
            start: {
                position: 1,
                line: 0,
                character: 1,
            },
            end: {
                position: 1,
                line: 0,
                character: 1,
            },
            fix: undefined,
        }],
        fixes: 0,
    });

    verify('CRLF', {
        content: 'foo;\r\nbar;\r\n',
        failures: [{
            ruleName: 'rule',
            message: 'some message',
            severity: 'error',
            start: {
                position: 0,
                line: 0,
                character: 0,
            },
            end: {
                position: 6,
                line: 1,
                character: 0,
            },
            fix: undefined,
        }],
        fixes: 0,
    });

    function apply(name: string, failures: Failure[]) {
        verify(name, {content, failures, fixes: 0});
    }

    function verify(name: string, summary: FileSummary) {
        t.snapshot(createBaseline(summary), {id: `createBaseline ${name}`});
    }
});

test('RuleTester', (t) => {
    class MockRunner {
        public *lintCollection(options: LintOptions): LintResult {
            switch (options.project) {
                case 'third':
                    yield [
                        'third.ts',
                        {
                            content: options.fix ? 'fixed' : '', // tslint:disable-next-line
                            failures: [{ruleName: '', message: '', severity: 'error', start: {position: 0, line: 0, character: 0}, end: {position: 0, line: 0, character: 0}, fix: {replacements: []}}],
                            fixes: 0,
                        },
                    ];
                    // falls through
                case 'second':
                    yield ['second.ts', {content: '', failures: [], fixes: 0}];
                    // falls through
                case 'first':
                    yield ['first.ts', {content: '', failures: [], fixes: 0}];
            }
        }
    }
    let keepGoing = 0;
    let checked: Array<[string, string]> = [];
    const host: RuleTestHost = {
        checkResult(file, kind, summary) {
            if (file === 'third.ts')
                t.is(summary.content, kind === BaselineKind.Fix ? 'fixed' : '', 'lints again with fix option');
            checked.push([file, kind]);
            return keepGoing-- > 0;
        },
    };
    const tester = new RuleTester(<Runner><Partial<Runner>>new MockRunner(), host);
    t.false(tester.test({project: 'first'}));
    t.deepEqual(checked, [['first.ts', BaselineKind.Lint]]);
    checked = [];

    keepGoing = 1;
    t.false(tester.test({project: 'first'}));
    t.deepEqual(checked, [['first.ts', BaselineKind.Lint], ['first.ts', BaselineKind.Fix]]);
    checked = [];

    keepGoing = 1;
    t.true(tester.test({project: 'first', fix: false}));
    t.deepEqual(checked, [['first.ts', BaselineKind.Lint]]);
    checked = [];

    keepGoing = 1;
    t.false(tester.test({project: 'second', fix: false}));
    t.deepEqual(checked, [['second.ts', BaselineKind.Lint], ['first.ts', BaselineKind.Lint]]);
    checked = [];

    keepGoing = 3;
    t.false(tester.test({project: 'second'}));
    t.deepEqual(checked, [
        ['second.ts', BaselineKind.Lint], ['first.ts', BaselineKind.Lint], ['second.ts', BaselineKind.Fix], ['first.ts', BaselineKind.Fix],
    ]);
    checked = [];

    keepGoing = 3;
    t.false(tester.test({project: 'third'}));
    t.deepEqual(checked, [
        ['third.ts', BaselineKind.Lint], ['second.ts', BaselineKind.Lint], ['first.ts', BaselineKind.Lint], ['third.ts', BaselineKind.Fix],
    ]);
    checked = [];

    keepGoing = 1;
    t.false(tester.test({project: 'third', fix: false}));
    t.deepEqual(checked, [['third.ts', BaselineKind.Lint], ['second.ts', BaselineKind.Lint]]);
    checked = [];
});
