"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = require("ava");
const ymir_1 = require("@fimbul/ymir");
const json_1 = require("../src/formatters/json");
const stylish_1 = require("../src/formatters/stylish");
const chalk_1 = require("chalk");
const path = require("path");
ava_1.default.before(() => {
    chalk_1.default.enabled = true;
    chalk_1.default.level = 1;
});
function createFailure(name, severity, message, start, end, fix) {
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
const summary = new Map();
summary.set('/some/directory/a.ts', {
    content: '',
    failures: [],
    fixes: 0,
});
summary.set('/some/other/directory/b.ts', {
    content: 'foo = bar',
    failures: [
        createFailure('foo', 'warning', 'no foo', 0, 3, [ymir_1.Replacement.delete(0, 3)]),
        createFailure('bar', 'error', 'no bar', 6, 9, [ymir_1.Replacement.replace(6, 9, 'baz')]),
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
        createFailure('trailing-newline', 'error', 'missing trailing newline', 9, 9, [ymir_1.Replacement.append(9, '\n')]),
    ],
    fixes: 0,
});
const emptySummary = new Map();
const noFailureSummary = new Map([['/some/file.js', { content: '', failures: [], fixes: 0 }]]);
const fixedSummary = new Map([['/project/fixed.js', { content: '', failures: [], fixes: 1 }]]);
const fixableSummary = new Map([
    [
        '/dir/fixableError.ts',
        { content: 'debugger;', failures: [createFailure('no-debugger', 'error', 'debugger', 0, 9, [ymir_1.Replacement.delete(0, 9)])], fixes: 0 },
    ],
]);
const warningSummary = new Map([
    [
        '/dir/warnings.ts',
        { content: 'a', failures: [createFailure('a', 'warning', 'a', 0, 0)], fixes: 0 },
    ],
    [
        'C:/dir/warnings2.ts',
        { content: 'b', failures: [createFailure('b', 'warning', 'b', 0, 0)], fixes: 0 },
    ],
]);
const bomSummary = new Map([[
        '/dir/warnings.ts',
        {
            content: '\uFEFFa\nb',
            failures: [
                {
                    severity: 'error',
                    message: 'BOM',
                    ruleName: 'bom',
                    start: {
                        position: 0,
                        line: 0,
                        character: 0,
                    },
                    end: {
                        position: 1,
                        line: 0,
                        character: 1,
                    },
                    fix: undefined,
                },
                {
                    severity: 'warning',
                    message: 'a',
                    ruleName: 'a',
                    start: {
                        position: 1,
                        line: 0,
                        character: 1,
                    },
                    end: {
                        position: 2,
                        line: 0,
                        character: 2,
                    },
                    fix: undefined,
                },
                {
                    severity: 'warning',
                    message: 'b',
                    ruleName: 'a',
                    start: {
                        position: 3,
                        line: 1,
                        character: 0,
                    },
                    end: {
                        position: 4,
                        line: 1,
                        character: 1,
                    },
                    fix: undefined,
                },
                {
                    severity: 'warning',
                    message: 'EOF',
                    ruleName: 'eof',
                    start: {
                        position: 4,
                        line: 1,
                        character: 1,
                    },
                    end: {
                        position: 4,
                        line: 1,
                        character: 1,
                    },
                    fix: undefined,
                },
            ],
            fixes: 0,
        },
    ]]);
function testFormatter(formatterCtor, t, transform) {
    testOutput(emptySummary, 'empty');
    testOutput(noFailureSummary, 'success');
    testOutput(fixedSummary, 'fixed');
    testOutput(fixableSummary, 'fixable');
    testOutput(warningSummary, 'warnings');
    testOutput(summary, 'mixed');
    testOutput(bomSummary, 'bom');
    function testOutput(lintResult, name) {
        const output = format(lintResult, new formatterCtor());
        t.snapshot(transform === undefined ? output : transform(output), { id: `${t.title} ${name}` });
    }
}
function format(lintResult, formatter) {
    let result = formatter.prefix !== undefined ? formatter.prefix + '\n' : '';
    for (const [fileName, fileResult] of lintResult) {
        const formatted = formatter.format(fileName, fileResult);
        if (formatted !== undefined)
            result += formatted + '\n';
    }
    if (formatter.flush !== undefined) {
        const formatted = formatter.flush();
        if (formatted !== undefined)
            result += formatted + '\n';
    }
    return result;
}
ava_1.default('JSON', (t) => {
    testFormatter(json_1.Formatter, t);
});
ava_1.default('Stylish', (t) => {
    const lines = format(warningSummary, new stylish_1.Formatter()).split('\n');
    t.true(lines[0].startsWith(`\u001b[4m${path.normalize('/dir/warnings.ts')}\u001b[24m`));
    t.true(lines[3].startsWith(`\u001b[4m${path.normalize('C:/dir/warnings2.ts')}\u001b[24m`));
    testFormatter(stylish_1.Formatter, t, (output) => {
        return output
            .split('\n')
            .map((line) => line.startsWith('\u001b[4m') ? line.replace(/\\/g, '/') : line)
            .join('\n');
    });
});
//# sourceMappingURL=formatters.spec.js.map