import { NodeFormatterLoader, Resolver, FormatterConstructor, NodeRuleLoader, RuleConstructor } from '@fimbul/wotan';
import { ContainerModule } from 'inversify';
export declare class TslintFormatterLoaderHost extends NodeFormatterLoader {
    constructor(resolver: Resolver);
    loadCustomFormatter(name: string, basedir: string): FormatterConstructor | undefined;
}
export declare class TslintRuleLoaderHost extends NodeRuleLoader {
    loadCustomRule(name: string, dir: string): RuleConstructor | undefined;
}
export declare const module: ContainerModule;
