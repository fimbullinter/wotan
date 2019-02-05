import { NodeFormatterLoader, Resolver, FormatterConstructor, NodeRuleLoader, RuleConstructor, BuiltinResolver } from '@fimbul/wotan';
import { ContainerModule } from 'inversify';
export declare class TslintFormatterLoaderHost extends NodeFormatterLoader {
    constructor(resolver: Resolver, builtinResolver: BuiltinResolver);
    loadCustomFormatter(name: string, basedir: string): FormatterConstructor | undefined;
}
export declare class TslintRuleLoaderHost extends NodeRuleLoader {
    constructor(builtinResolver: BuiltinResolver, resolver: Resolver);
    loadCustomRule(name: string, dir: string): RuleConstructor | undefined;
}
export declare function createModule(): ContainerModule;
