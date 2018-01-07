import { Failure, AbstractFormatter, LintResult } from '../types';
import chalk from 'chalk';
import * as path from 'path';

export class Formatter extends AbstractFormatter {
    public format(result: LintResult) {
        let errors = 0;
        let warnings = 0;
        let fixable = 0;
        const lines: string[] = [];
        let fixed = 0;
        const fileNames: string[] = [];
        const allFailures: Failure[] = [];
        for (const [fileName, summary] of result) {
            if (summary.failures.length !== 0) {
                fileNames.push(fileName);
                allFailures.push(...summary.failures);
            }
            fixed += summary.fixes;
        }

        const maxSeverityWidth = Math.max(...allFailures.map(ruleSeverityWidth));
        const maxPositionWidth = Math.max(...allFailures.map(positionWidth));
        const maxNameWidth = Math.max(...allFailures.map(ruleNameWidth));

        for (const fileName of fileNames) {
            const failures = result.get(fileName)!.failures.slice().sort(Failure.compare);
            lines.push(
                '',
                `${
                    chalk.underline(path.normalize(fileName))
                }${
                    chalk.hidden(`:${failures[0].start.line + 1}:${failures[0].start.character + 1}`)
                }`,
            );
            for (const failure of failures) {
                if (failure.fix !== undefined)
                    ++fixable;
                const position = `${failure.start.line + 1}:${failure.start.character + 1}`;
                let positionColor: typeof chalk;
                if (failure.severity === 'error') {
                    positionColor = chalk.red;
                    ++errors;
                } else {
                    positionColor = chalk.yellow;
                    ++warnings;
                }
                lines.push(
                    positionColor(`${pad(failure.severity.toUpperCase(), maxSeverityWidth)} ${pad(position, maxPositionWidth)}`) +
                        `  ${chalk.grey(pad(failure.ruleName, maxNameWidth))}  ${chalk.blue.bold(failure.message)}`,
                );
            }
        }
        if (fixed !== 0)
            lines.push(
                '', chalk.green(`Automatically fixed ${addCount(fixed, 'failure')}.`),
            );
        if (fileNames.length !== 0) {
            const summaryLine = [];
            if (errors !== 0)
                summaryLine.push(chalk.red.bold(`✖ ${addCount(errors, 'error')}`));
            if (warnings !== 0)
                summaryLine.push(chalk.yellow.bold(`⚠ ${addCount(warnings, 'warning')}`));
            lines.push('', summaryLine.join('  '));
            if (fixable !== 0)
                lines.push(
                    chalk.grey(
                        `${addCount(fixable, 'failure')} ${fixable === 1 ? 'is' : 'are'} potentially fixable with the '--fix' option.`,
                    ),
                );
        }
        return lines
            .slice(1) // remove first line, because it's always empty
            .join('\n');
    }
}

function addCount(count: number, word: string) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function pad(str: string, width: number) {
    return str + ' '.repeat(width - str.length);
}

function ruleSeverityWidth(failure: Failure) {
    return failure.severity.length;
}

function ruleNameWidth(failure: Failure) {
    return failure.ruleName.length;
}

function positionWidth(failure: Failure) {
    return `${failure.start.line + 1}${failure.start.character + 1}`.length + 1;
}
