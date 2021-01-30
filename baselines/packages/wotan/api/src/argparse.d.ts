import { GlobalOptions, Severity } from '@fimbul/ymir';
import { LintOptions } from './runner';
import { OptionParser } from './optparse';
export interface ParsedGlobalOptions extends LintOptions {
    modules: ReadonlyArray<string>;
    formatter: string | undefined;
}
export declare const GLOBAL_OPTIONS_SPEC: {
    modules: OptionParser.ParseFunction<readonly string[]>;
    config: OptionParser.ParseFunction<string | undefined>;
    files: OptionParser.ParseFunction<readonly string[]>;
    exclude: OptionParser.ParseFunction<readonly string[]>;
    project: OptionParser.ParseFunction<readonly string[]>;
    references: OptionParser.ParseFunction<boolean>;
    formatter: OptionParser.ParseFunction<string | undefined>;
    fix: OptionParser.ParseFunction<number | boolean>;
    extensions: OptionParser.ParseFunction<string[] | undefined>;
    reportUselessDirectives: OptionParser.ParseFunction<boolean | Severity>;
};
export declare function parseGlobalOptions(options: GlobalOptions | undefined): ParsedGlobalOptions;
