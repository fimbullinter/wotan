import { Failure, FileSummary } from '@fimbul/ymir';

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
    const failureStart = Math.max(failure.start.position, lineStart);
    let errorLine = ' '.repeat(failureStart - lineStart);
    const failureLength = Math.min(lineEnd, failure.end.position) - failureStart;
    errorLine += failureLength === 0 ? '~nil' : '~'.repeat(failureLength);
    if (failure.end.position <= nextLineStart)
        return errorLine + ' '.repeat(Math.max(1, lineLength - errorLine.length + 1)) +
            `[${failure.severity} ${failure.ruleName}: ${failure.message.replace(/[\r\n]/g, '\\$&')}]`;

    remaining.push(failure);
    return errorLine;
}
