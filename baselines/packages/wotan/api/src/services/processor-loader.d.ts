import { ProcessorConstructor, Resolver, CacheFactory } from '@fimbul/ymir';
export declare class ProcessorLoader {
    private resolver;
    private cache;
    constructor(resolver: Resolver, cache: CacheFactory);
    loadProcessor(path: string): ProcessorConstructor;
}
