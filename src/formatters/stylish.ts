import { Failure } from '../linter';
export class Formatter {
    public format(failures: Failure[]) {
        const lines: string[] = [];
        let lastFile: string | undefined;
        for (const failure of failures.sort(Failure.compare)) {
            if (failure.fileName !== lastFile) {
                if (lastFile !== undefined)
                    lines.push('');
                lastFile = failure.fileName;
                lines.push(failure.fileName);
            }
            lines.push(`${failure.severity.toUpperCase()}: ${failure.ruleName} ${failure.message}`);
        }
        return lines.join('\n');
    }
}
