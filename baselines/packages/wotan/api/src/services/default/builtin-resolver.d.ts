import { BuiltinResolver, Resolver } from '@fimbul/ymir';
export declare class DefaultBuiltinResolver implements BuiltinResolver {
    private resolver;
    private readonly builtinPackagePath;
    constructor(resolver: Resolver);
    resolveConfig(name: string): string;
    resolveRule(name: string): string;
    resolveFormatter(name: string): string;
}
