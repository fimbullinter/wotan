import { AbstractFormatter, FileSummary } from '@fimbul/ymir';
export declare class Formatter extends AbstractFormatter {
    private fixed;
    private fixable;
    private maxSeverityWidth;
    private maxPositionWidth;
    private maxNameWidth;
    private files;
    format(fileName: string, summary: FileSummary): undefined;
    flush(): string | undefined;
}
