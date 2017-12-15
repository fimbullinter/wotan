import { Failure, AbstractFormatter, LintResult } from '../types';
import chalk from 'chalk';
import * as path from 'path';

export class Formatter extends AbstractFormatter {
    public format(result: LintResult) {
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
                `${path.normalize(fileName)}${chalk.hidden(`:${failures[0].start.line + 1}:${failures[0].start.character + 1}`)}`,
            );
            for (const failure of failures) {
                const position = `${failure.start.line + 1}:${failure.start.character + 1}`;
                const positionColor = failure.severity === 'warning' ? chalk.blue : chalk.red;
                lines.push(
                    positionColor(`${pad(failure.severity.toUpperCase() + ':', maxSeverityWidth)} ${pad(position, maxPositionWidth)}`) +
                    `  ${chalk.grey(pad(failure.ruleName, maxNameWidth))}  ${chalk.yellow(failure.message)}`,
                );
            }
        }
        if (fixed !== 0)
            lines.push(
                '', `Automatically fixed ${fixed} failure${fixed === 1 ? '' : 's'}.`,
            );
        return lines
            .slice(1) // remove first line, because it's always empty
            .join('\n');
    }
}

function pad(str: string, width: number) {
    return str + ' '.repeat(width - str.length);
}

function ruleSeverityWidth(failure: Failure) {
    return failure.severity.length + 1;
}

function ruleNameWidth(failure: Failure) {
    return failure.ruleName.length;
}

function positionWidth(failure: Failure) {
    return `${failure.start.line + 1}${failure.start.character + 1}`.length + 1;
}
