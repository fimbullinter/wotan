import { LineSwitchParser, RawLineSwitch, LineSwitchParserContext } from '@fimbul/wotan';
export declare class TslintLineSwitchParser implements LineSwitchParser {
    parse({ sourceFile }: LineSwitchParserContext): RawLineSwitch[];
}
