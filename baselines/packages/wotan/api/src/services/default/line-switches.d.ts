import * as ts from 'typescript';
import { FindingFilterFactory, FindingFilter, FindingFilterContext, LineSwitchParser, LineSwitchParserContext, RawLineSwitch } from '@fimbul/ymir';
export declare const LINE_SWITCH_REGEX: RegExp;
export declare class LineSwitchFilterFactory implements FindingFilterFactory {
    private parser;
    constructor(parser: LineSwitchParser);
    create(context: FindingFilterContext): FindingFilter;
    getDisabledRanges(context: FindingFilterContext): Map<string, ts.TextRange[]>;
    private parseLineSwitches;
}
export declare class DefaultLineSwitchParser implements LineSwitchParser {
    parse(context: LineSwitchParserContext): RawLineSwitch[];
}
