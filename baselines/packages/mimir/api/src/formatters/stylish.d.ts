import { AbstractFormatter, FileSummary } from '@fimbul/ymir';
export declare class Formatter extends AbstractFormatter {
    format(fileName: string, summary: FileSummary): undefined;
    flush(): string | undefined;
}
