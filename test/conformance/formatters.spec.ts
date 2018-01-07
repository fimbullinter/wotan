import 'reflect-metadata';
import test, { TestContext } from 'ava';
import { LintResult, Failure, Severity, Replacement, AbstractFormatter } from '../../src/types';
import { Formatter as JsonFormatter} from '../../src/formatters/json';
import { Formatter as StylishFormatter } from '../../src/formatters/stylish';
import chalk, { Level } from 'chalk';
import * as path from 'path';
import { unixifyPath } from '../../src/utils';

test.before(() => {
    chalk.enabled = true;
    chalk.level = Level.Basic;
});

function createFailure(name: string, severity: Severity, message: string, start: number, end: number, fix?: Replacement[]): Failure {
    return {
        severity,
        message,
        ruleName: name,
        start: {
            position: start,
            line: 0,
            character: start,
        },
        end: {
            position: end,
            line: 0,
            character: end,
        },
        fix: fix && { replacements: fix },
    };
}

const summary: LintResult = new Map();
summary.set('/some/directory/a.ts', {
    content: '',
    failures: [],
    fixes: 0,
});
summary.set('/some/other/directory/b.ts', {
    content: 'foo = bar',
    failures: [
        createFailure('foo', 'warning', 'no foo', 0, 3, [Replacement.deleteAt(0, 3)]),
        createFailure('bar', 'error', 'no bar', 6, 9, [Replacement.replaceAt(6, 3, 'baz')]),
        createFailure('equals', 'error', 'no equals', 4, 5),
    ],
    fixes: 1,
});
summary.set('/some/directory/c.ts', {
    content: '',
    failures: [],
    fixes: 3,
});
summary.set('/my/project/a.ts', {
    content: 'debugger;',
    failures: [
        createFailure('trailing-newline', 'error', 'missing trailing newline', 9, 9, [Replacement.append(9, '\n')]),
    ],
    fixes: 0,
});

const emptySummary: LintResult = new Map();
const noFailureSummary: LintResult = new Map([['/some/file.js', {content: '', failures: [], fixes: 0}]]);
const fixedSummary: LintResult = new Map([['/project/fixed.js', {content: '', failures: [], fixes: 1}]]);
const fixableSummary: LintResult = new Map([
    [
        '/dir/fixableError.ts',
        {content: 'debugger;', failures: [createFailure('no-debugger', 'error', 'debugger', 0, 9, [Replacement.delete(0, 9)])], fixes: 0},
    ],
]);
const warningSummary: LintResult = new Map([
    [
        '/dir/warnings.ts',
        {content: 'a', failures: [createFailure('a', 'warning', 'a', 0, 0)], fixes: 0},
    ],
    [
        'C:/dir/warnings2.ts',
        {content: 'b', failures: [createFailure('b', 'warning', 'b', 0, 0)], fixes: 0},
    ],
]);

function testFormatter(formatter: AbstractFormatter, t: TestContext, transform?: (s: string) => string) {
    testOutput(emptySummary, 'empty');
    testOutput(noFailureSummary, 'success');
    testOutput(fixedSummary, 'fixed');
    testOutput(fixableSummary, 'fixable');
    testOutput(warningSummary, 'warnings');
    testOutput(summary, 'mixed');

    function testOutput(lintResult: LintResult, name: string) {
        const output = formatter.format(lintResult);
        t.snapshot(transform === undefined ? output : transform(output), <any>{id: `${t.title} ${name}`});
    }
}

test('JSON', (t) => {
    testFormatter(new JsonFormatter(), t);
});

test('Stylish', (t) => {
    const formatter = new StylishFormatter();
    const lines = formatter.format(warningSummary).split('\n');
    t.true(lines[0].startsWith(`\u001b[4m${path.normalize('/dir/warnings.ts')}\u001b[24m`));
    t.true(lines[3].startsWith(`\u001b[4m${path.normalize('C:/dir/warnings2.ts')}\u001b[24m`));
    testFormatter(new StylishFormatter(), t, (output) => {
        return output
            .split('\n')
            .map((line) => line.startsWith('\u001b[4m') ? unixifyPath(line) : line)
            .join('\n');
    });
});
