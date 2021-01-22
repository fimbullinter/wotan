import { injectable } from 'inversify';
import { RuleLoaderHost, RuleConstructor, MessageHandler, CacheFactory, Cache } from '@fimbul/ymir';
import * as debug from 'debug';
import bind from 'bind-decorator';
import { resolveCachedResult } from '../utils';

const log = debug('wotan:ruleLoader');

@injectable()
export class RuleLoader {
    private cache: Cache<string, RuleConstructor | undefined>;
    constructor(private host: RuleLoaderHost, private logger: MessageHandler, cache: CacheFactory) {
        this.cache = cache.create();
    }

    public loadRule(name: string, directories: ReadonlyArray<string> | undefined): RuleConstructor | undefined {
        if (directories === undefined) {
            const ctor = resolveCachedResult(this.cache, name, this.loadCoreRule);
            if (ctor === undefined)
                this.logger.warn(`Could not find core rule '${name}'.`);
            return ctor;
        }
        for (const dir of directories) {
            const ctor = resolveCachedResult(this.cache, `${dir}💩${name}`, this.loadCustomRule);
            if (ctor !== undefined)
                return ctor;
        }
        this.logger.warn(`Could not find rule '${name}' in '${directories.join()}'.`);
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
