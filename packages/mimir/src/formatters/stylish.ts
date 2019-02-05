import { Finding, AbstractFormatter, FileSummary, Severity } from '@fimbul/ymir';
import chalk from 'chalk';
import * as path from 'path';

interface FindingInfo {
    severity: Severity;
    ruleName: string;
    position: string;
    message: string;
}

const COLORS: Record<Severity, typeof chalk> = {
    error: chalk.red,
    warning: chalk.yellow,
    suggestion: chalk.cyan,
};

const SYMBOLS: Record<Severity, string> = {
    error: '✖',
    warning: '⚠',
    suggestion: '💡',
};

export class Formatter extends AbstractFormatter {
    private fixed = 0;
    private fixable = 0;

    private maxSeverityWidth = 0;
    private maxPositionWidth = 0;
    private maxNameWidth = 0;

    private files = new Map<string, FindingInfo[]>();

    public format(fileName: string, summary: FileSummary): undefined {
        this.fixed += summary.fixes;
        if (summary.findings.length === 0)
            return;
        const mapped: FindingInfo[] = [];
        for (const finding of summary.findings.slice().sort(Finding.compare)) {
            if (finding.fix !== undefined)
                ++this.fixable;
            if (finding.severity.length > this.maxSeverityWidth)
                this.maxSeverityWidth = finding.severity.length;
            if (finding.ruleName.length > this.maxNameWidth)
                this.maxNameWidth = finding.ruleName.length;
            let {character, line} = finding.start;
            if (line !== 0 || character === 0 || !summary.content.startsWith('\uFEFF'))
                character += 1; // avoid incrementing the character position on the first line if BOM is present, editors ignore BOM
            const position = `${line + 1}:${character}`;
            if (position.length > this.maxPositionWidth)
                this.maxPositionWidth = position.length;
            mapped.push({
                position,
                severity: finding.severity,
                ruleName: finding.ruleName,
                message: finding.message,
            });
        }
        this.files.set(fileName, mapped);
        return;
    }

    public flush() {
        const counts: Record<Severity, number> = {
            error: 0,
            warning: 0,
            suggestion: 0,
        };
        const lines: string[] = [];

        for (const [fileName, findings] of this.files) {
            lines.push(
                '',
                `${chalk.underline(path.normalize(fileName))}${chalk.hidden(':' + findings[0].position)}`,
            );
            for (const finding of findings) {
                const positionColor = COLORS[finding.severity];
                ++counts[finding.severity];
                lines.push(
                    positionColor(
                        pad(finding.severity.toUpperCase(), this.maxSeverityWidth) + ' ' + pad(finding.position, this.maxPositionWidth),
                    ) + `  ${chalk.grey(pad(finding.ruleName, this.maxNameWidth))}  ${chalk.blueBright(finding.message)}`,
                );
            }
        }
        if (this.fixed !== 0)
            lines.push(
                '', chalk.green(`Automatically fixed ${addCount(this.fixed, 'finding')}.`),
            );
        if (this.files.size !== 0) {
            const summaryLine = [];
            for (const severity of <Severity[]>Object.keys(counts)) {
                const count = counts[severity];
                if (count !== 0)
                    summaryLine.push(COLORS[severity].bold(`${SYMBOLS[severity]} ${addCount(count, severity)}`));
            }
            lines.push('', summaryLine.join('  '));
            if (this.fixable !== 0)
                lines.push(
                    chalk.grey(
                        addCount(this.fixable, 'finding') + ' ' +
                        (this.fixable === 1 ? 'is' : 'are') + " potentially fixable with the '--fix' option.",
                    ),
                );
        }
        return lines.length === 0
            ? undefined
            : lines.slice(1).join('\n'); // remove first line, because it's always empty
    }
}

function addCount(count: number, word: string) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function pad(str: string, width: number) {
    return str + ' '.repeat(width - str.length);
}
