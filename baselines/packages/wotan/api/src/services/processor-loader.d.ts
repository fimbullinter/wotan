import { ProcessorConstructor, Resolver, CacheFactory } from '@fimbul/ymir';
export declare class ProcessorLoader {
    constructor(resolver: Resolver, cache: CacheFactory);
    loadProcessor(path: string): ProcessorConstructor;
}
