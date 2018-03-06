import { AbstractFormatter, FileSummary } from '@fimbul/ymir';

export class Formatter extends AbstractFormatter {
    public prefix = '[';

    public format(fileName: string, summary: FileSummary) {
        if (summary.failures.length === 0)
            return;
        return summary.failures.map((f) => JSON.stringify({...f, fileName})).join();
    }

    public flush() {
        return ']';
    }
}
