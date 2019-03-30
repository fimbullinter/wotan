import { GlobalOptions } from '@fimbul/ymir';
import { LintOptions } from './runner';
import { OptionParser } from './optparse';
export interface ParsedGlobalOptions extends LintOptions {
    modules: ReadonlyArray<string>;
    formatter: string | undefined;
}
export declare const GLOBAL_OPTIONS_SPEC: {
    modules: OptionParser.ParseFunction<ReadonlyArray<string>>;
    config: OptionParser.ParseFunction<string | undefined>;
    files: OptionParser.ParseFunction<ReadonlyArray<string>>;
    exclude: OptionParser.ParseFunction<ReadonlyArray<string>>;
    project: OptionParser.ParseFunction<ReadonlyArray<string>>;
    references: OptionParser.ParseFunction<boolean>;
    formatter: OptionParser.ParseFunction<string | undefined>;
    fix: OptionParser.ParseFunction<number | boolean>;
    extensions: OptionParser.ParseFunction<ReadonlyArray<string> | undefined>;
    reportUselessDirectives: OptionParser.ParseFunction<boolean | "error" | "warning" | "suggestion">;
};
export declare function parseGlobalOptions(options: GlobalOptions | undefined): ParsedGlobalOptions;
