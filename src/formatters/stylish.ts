import { Failure, AbstractFormatter } from '../types';
import chalk from 'chalk';
import * as path from 'path';

export class Formatter extends AbstractFormatter {
    public format(failures: Failure[], fixed: number) {
        const lines: string[] = [];
        let lastFile: string | undefined;
        const maxSeverityWidth = Math.max(...failures.map(ruleSeverityWidth));
        const maxPositionWidth = Math.max(...failures.map(positionWidth));
        const maxNameWidth = Math.max(...failures.map(ruleNameWidth));
        for (const failure of failures.sort(Failure.compare)) {
            const position = `${failure.start.line + 1}:${failure.start.character + 1}`;
            if (failure.fileName !== lastFile) {
                if (lastFile !== undefined)
                    lines.push('');
                lastFile = failure.fileName;
                lines.push(path.normalize(failure.fileName) + chalk.hidden(':' + position));
            }
            const positionColor = failure.severity === 'warning' ? chalk.blue : chalk.red;
            lines.push(
                positionColor(`${pad(failure.severity.toUpperCase() + ':', maxSeverityWidth)} ${pad(position, maxPositionWidth)}`) +
                `  ${chalk.grey(pad(failure.ruleName, maxNameWidth))}  ${chalk.yellow(failure.message)}`,
            );
        }
        if (fixed !== 0) {
            if (failures.length !== 0)
                lines.push('');
            lines.push(`Automatically fixed ${fixed} failure${fixed === 1 ? '' : 's'}.`);
        }
        return lines.join('\n');
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
