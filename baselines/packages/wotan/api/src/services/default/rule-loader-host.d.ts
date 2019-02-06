import { RuleLoaderHost, RuleConstructor, BuiltinResolver, Resolver } from '@fimbul/ymir';
export declare class NodeRuleLoader implements RuleLoaderHost {
    private builtinResolver;
    private resolver;
    constructor(builtinResolver: BuiltinResolver, resolver: Resolver);
    loadCoreRule(name: string): RuleConstructor | undefined;
    loadCustomRule(name: string, directory: string): RuleConstructor | undefined;
}
