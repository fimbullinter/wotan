import { injectable } from 'inversify';
import { RuleLoaderHost, RuleConstructor, MessageHandler, CacheManager, CacheIdentifier, Cache } from '../types';
import { ConfigurationError } from '../error';
import * as debug from 'debug';
import bind from 'bind-decorator';
import { resolveCachedResult } from '../utils';

const cacheId = new CacheIdentifier<string, RuleConstructor | undefined>('rules');
const log = debug('wotan:ruleLoader');

@injectable()
export class RuleLoader {
    private cache: Cache<string, RuleConstructor | undefined>;
    constructor(private host: RuleLoaderHost, private logger: MessageHandler, cache: CacheManager) {
        this.cache = cache.create(cacheId);
    }

    public loadRule(name: string, directories: string[] | undefined): RuleConstructor | undefined {
        const slashIndex = name.lastIndexOf('/');
        if (slashIndex === -1) {
            const ctor = resolveCachedResult(this.cache, name, this.loadCoreRule);
            if (ctor === undefined)
                this.logger.warn(`Could not find core rule '${name}'.`);
            return ctor;
        }
        if (directories === undefined)
            throw new ConfigurationError(`No 'rulesDirectories' for rule '${name}'.`);
        name = name.substr(slashIndex + 1);
        for (const dir of directories) {
            const ctor = resolveCachedResult(this.cache, `${dir}💩${name}`, this.loadCustomRule);
            if (ctor !== undefined)
                return ctor;
        }
        this.logger.warn(`Could not find rule '${name}' in ${directories}.`);
        return;
    }

    @bind
    private loadCoreRule(name: string) {
        log('Loading core rule %s', name);
        return this.host.loadCoreRule(name);
    }

    @bind
    private loadCustomRule(cacheKey: string) {
        const [directory, name] = cacheKey.split('💩');
        log('Looking for %s in directory %s', name, directory);
        return this.host.loadCustomRule(name, directory);
    }
}
