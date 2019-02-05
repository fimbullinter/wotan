import { AbstractFormatter, FileSummary } from '@fimbul/ymir';

export class Formatter extends AbstractFormatter {
    public prefix = '[';

    public format(fileName: string, summary: FileSummary) {
        if (summary.findings.length === 0)
            return;
        return summary.findings.map((f) => JSON.stringify({...f, fileName})).join();
    }

    public flush() {
        return ']';
    }
}
