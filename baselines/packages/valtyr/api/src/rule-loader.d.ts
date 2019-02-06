import { RuleLoaderHost, RuleConstructor } from '@fimbul/wotan';
export declare class TslintRuleLoaderHost implements RuleLoaderHost {
    loadCoreRule(name: string): RuleConstructor | undefined;
    loadCustomRule(name: string, dir: string): RuleConstructor | undefined;
}
