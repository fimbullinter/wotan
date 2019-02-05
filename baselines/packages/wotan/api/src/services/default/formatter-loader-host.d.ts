import { FormatterLoaderHost, FormatterConstructor, Resolver, BuiltinResolver } from '@fimbul/ymir';
export declare class NodeFormatterLoader implements FormatterLoaderHost {
    private resolver;
    private builtinResolver;
    constructor(resolver: Resolver, builtinResolver: BuiltinResolver);
    loadCoreFormatter(name: string): FormatterConstructor | undefined;
    loadCustomFormatter(name: string, basedir: string): FormatterConstructor | undefined;
}
