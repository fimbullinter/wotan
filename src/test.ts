import { Failure, FileSummary, LintResult } from './types';
import chalk from 'chalk';
import * as diff from 'diff';
import { Runner, LintOptions } from './runner';
import { injectable } from 'inversify';

export const enum BaselineKind {
    Lint = 'lint',
    Fix = 'fix',
}

export abstract class RuleTestHost {
    public abstract checkResult(file: string, kind: BaselineKind, result: FileSummary): boolean;
}

@injectable()
export class RuleTester {
    constructor(private runner: Runner, private host: RuleTestHost) {}
    public test(config: Partial<LintOptions>): boolean {
        const lintOptions: LintOptions = {
            config: undefined,
            exclude: [],
            files: [],
            project: undefined,
            ...config,
            fix: false,
        };
        const lintResult = this.runner.lintCollection(lintOptions);
        for (const [fileName, summary] of lintResult)
            if (!this.host.checkResult(fileName, BaselineKind.Lint, summary))
                return false;

        if (!('fix' in config) || config.fix) {
            lintOptions.fix = config.fix || true; // fix defaults to true if not specified
            const fixResult = containsFixes(lintResult) ? this.runner.lintCollection(lintOptions) : lintResult;
            for (const [fileName, summary] of fixResult)
                if (!this.host.checkResult(fileName, BaselineKind.Fix, summary))
                    return false;
        }
        return true;
    }
}

function containsFixes(result: LintResult): boolean {
    for (const {failures} of result.values())
        for (const failure of failures)
            if (failure.fix !== undefined)
                return true;
    return false;
}

export function createBaselineDiff(actual: string, expected: string) {
    const result = [
        chalk.red('Expected'),
        chalk.green('Actual'),
    ];
    const lines = diff.createPatch('', expected, actual, '', '').split(/\n(?!\\)/g).slice(4);
    for (let line of lines) {
        switch (line[0]) {
            case '@':
                line = chalk.blueBright(line);
                break;
            case '+':
                line = chalk.green(isCodeLine(line.substr(1)) ? '+' + prettyCodeLine(line.substr(1)) : line);
                break;
            case '-':
                line = chalk.red(isCodeLine(line.substr(1)) ? '-' + prettyCodeLine(line.substr(1)) : line);
        }
        result.push(line);
    }
    return result.join('\n');
}

export function prettyCodeLine(line: string): string {
    return line
        .replace(/\t/g, '\u2409') // ␉
        .replace(/\r$/, '\u240d') // ␍
        .replace(/^\uFEFF/, '<BOM>');
}

export function isCodeLine(line: string): boolean {
    return !/^ *~(~*|nil)( +\[.+\])?$/.test(line);
}

export function createBaseline(summary: FileSummary): string {
    if (summary.failures.length === 0)
        return summary.content;

    const failures = summary.failures.slice().sort(Failure.compare);
    const lines: string[] = [];
    let lineStart = 0;
    let failurePosition = 0;
    let pendingFailures: Failure[] = [];
    for (const line of summary.content.split(/\n/g)) {
        lines.push(line);
        const nextLineStart = lineStart + line.length + 1;
        const lineLength = line.length - (line.endsWith('\r') ? 1 : 0);
        const pending: Failure[] = [];
        for (const failure of pendingFailures)
            lines.push(formatFailure(failure, lineStart, lineLength, nextLineStart, pending));
        pendingFailures = pending;

        for (; failurePosition < failures.length && failures[failurePosition].start.position < nextLineStart; ++failurePosition)
            lines.push(formatFailure(failures[failurePosition], lineStart, lineLength, nextLineStart, pendingFailures));

        lineStart = nextLineStart;
    }

    return lines.join('\n');
}

function formatFailure(failure: Failure, lineStart: number, lineLength: number, nextLineStart: number, remaining: Failure[]): string {
    const lineEnd = lineStart + lineLength;
    let errorLine = ' '.repeat(failure.start.position - lineStart);
    const failureLength = Math.min(lineEnd, failure.end.position) - Math.max(failure.start.position, lineStart);
    errorLine += failureLength === 0 ? '~nil' : '~'.repeat(failureLength);
    if (failure.end.position <= nextLineStart)
        return errorLine + ' '.repeat(Math.max(1, lineLength - errorLine.length + 1)) +
            `[${failure.severity} ${failure.ruleName}: ${failure.message.replace(/[\r\n]/g, '\\$&')}]`;

    remaining.push(failure);
    return errorLine;
}
