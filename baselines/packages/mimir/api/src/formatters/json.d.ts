import { AbstractFormatter, FileSummary } from '@fimbul/ymir';
export declare class Formatter extends AbstractFormatter {
    prefix: string;
    format(fileName: string, summary: FileSummary): string | undefined;
    flush(): string;
}
