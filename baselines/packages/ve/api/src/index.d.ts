import { AbstractProcessor, ProcessorUpdateResult, Finding, ProcessorSuffixContext, ProcessorContext } from '@fimbul/ymir';
import * as ts from 'typescript';
export declare class Processor extends AbstractProcessor {
    static getSuffixForFile(context: ProcessorSuffixContext): string;
    private range;
    constructor(context: ProcessorContext);
    preprocess(): string;
    updateSource(newSource: string, changeRange: ts.TextChangeRange): ProcessorUpdateResult;
    postprocess(findings: Finding[]): Finding[];
    private mapFinding;
    private adjustPosition;
    private mapReplacement;
}
