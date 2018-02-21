import { ProcessorConstructor, Resolver, CacheFactory, Cache } from '../types';
import { injectable } from 'inversify';
import { resolveCachedResult } from '../utils';
import bind from 'bind-decorator';
import { ConfigurationError } from '../error';

@injectable()
export class ProcessorLoader {
    private cache: Cache<string, ProcessorConstructor>;
    constructor(private resolver: Resolver, cache: CacheFactory) {
        this.cache = cache.create();
    }

    public loadProcessor(path: string): ProcessorConstructor {
        return resolveCachedResult(this.cache, path, this.requireProcessor);
    }

    @bind
    private requireProcessor(path: string): ProcessorConstructor {
        try {
            const result = this.resolver.require(path).Processor;
            if (result === undefined)
                throw new ConfigurationError(`'${path}' has no export named 'Processor'.`);
            return result;
        } catch (e) {
            if (e != undefined && e.code === 'MODULE_NOT_FOUND' && e.message === `Cannot find module '${path}'`)
                throw new ConfigurationError(e.message);
            throw e;
        }
    }
}
