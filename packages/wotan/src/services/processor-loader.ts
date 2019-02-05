import { ProcessorConstructor, Resolver, CacheFactory, Cache, ConfigurationError } from '@fimbul/ymir';
import { injectable } from 'inversify';
import { resolveCachedResult } from '../utils';

@injectable()
export class ProcessorLoader {
    private cache: Cache<string, ProcessorConstructor>;
    constructor(private resolver: Resolver, cache: CacheFactory) {
        this.cache = cache.create();
    }

    public loadProcessor(path: string): ProcessorConstructor {
        return resolveCachedResult(this.cache, path, (p) => {
            const result = this.resolver.require(p).Processor;
            if (result === undefined)
                throw new ConfigurationError(`'${p}' has no export named 'Processor'.`);
            return result;
        });
    }
}
