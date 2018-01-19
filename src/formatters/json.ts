import { AbstractFormatter, FileSummary } from '../types';

export class Formatter extends AbstractFormatter {
    public prefix() {
        return '[';
    }

    public format(fileName: string, summary: FileSummary) {
        if (summary.failures.length === 0)
            return;
        return summary.failures.map((f) => JSON.stringify({...f, fileName})).join();
    }

    public flush() {
        return ']';
    }
}
