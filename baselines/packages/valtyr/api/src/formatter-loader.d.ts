import { FormatterLoaderHost, FormatterConstructor } from '@fimbul/wotan';
export declare class TslintFormatterLoaderHost implements FormatterLoaderHost {
    loadCoreFormatter: typeof loadFormatter;
    loadCustomFormatter: typeof loadFormatter;
}
declare function loadFormatter(name: string): FormatterConstructor | undefined;
export {};
