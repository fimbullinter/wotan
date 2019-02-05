import { RuleLoaderHost, RuleConstructor, MessageHandler, CacheFactory } from '@fimbul/ymir';
export declare class RuleLoader {
    private host;
    private logger;
    private cache;
    constructor(host: RuleLoaderHost, logger: MessageHandler, cache: CacheFactory);
    loadRule(name: string, directories: ReadonlyArray<string> | undefined): RuleConstructor | undefined;
    private loadCoreRule;
    private loadCustomRule;
}
