import * as ts from 'typescript';
import { FindingFilterFactory, FindingFilter, FindingFilterContext, LineSwitchParser, LineSwitchParserContext, RawLineSwitch } from '@fimbul/ymir';
export declare const LINE_SWITCH_REGEX: RegExp;
export declare class LineSwitchFilterFactory implements FindingFilterFactory {
    constructor(parser: LineSwitchParser);
    create(context: FindingFilterContext): FindingFilter;
    getDisabledRanges(context: FindingFilterContext): Map<string, ts.TextRange[]>;
}
export declare class DefaultLineSwitchParser implements LineSwitchParser {
    parse(context: LineSwitchParserContext): RawLineSwitch[];
}
