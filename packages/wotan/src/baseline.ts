import { Finding, FileSummary } from '@fimbul/ymir';

export function isCodeLine(line: string): boolean {
    return !/^ *~(~*|nil)( +\[.+\])?$/.test(line);
}

export function createBaseline(summary: FileSummary): string {
    if (summary.findings.length === 0)
        return summary.content;

    const findings = summary.findings.slice().sort(Finding.compare);
    const lines: string[] = [];
    let lineStart = 0;
    let findingPosition = 0;
    let pendingFindings: Finding[] = [];
    for (const line of summary.content.split(/\n/g)) {
        lines.push(line);
        const nextLineStart = lineStart + line.length + 1;
        const lineLength = line.length - (line.endsWith('\r') ? 1 : 0);
        const pending: Finding[] = [];
        for (const finding of pendingFindings)
            lines.push(formatFinding(finding, lineStart, lineLength, nextLineStart, pending));
        pendingFindings = pending;

        for (; findingPosition < findings.length && findings[findingPosition].start.position < nextLineStart; ++findingPosition)
            lines.push(formatFinding(findings[findingPosition], lineStart, lineLength, nextLineStart, pendingFindings));

        lineStart = nextLineStart;
    }

    return lines.join('\n');
}

function formatFinding(finding: Finding, lineStart: number, lineLength: number, nextLineStart: number, remaining: Finding[]): string {
    const lineEnd = lineStart + lineLength;
    const findingStart = Math.max(finding.start.position, lineStart);
    let errorLine = ' '.repeat(findingStart - lineStart);
    const findingLength = Math.min(lineEnd, finding.end.position) - findingStart;
    errorLine += findingLength === 0 ? '~nil' : '~'.repeat(findingLength);
    if (finding.end.position <= nextLineStart)
        return errorLine + ' '.repeat(Math.max(1, lineLength - errorLine.length + 1)) +
            `[${finding.severity} ${finding.ruleName}: ${finding.message.replace(/[\r\n]/g, '\\$&')}]`;

    remaining.push(finding);
    return errorLine;
}
