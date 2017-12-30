import { injectable } from 'inversify';
import { CacheManager, CacheIdentifier } from '../types';

@injectable()
export class DefaultCacheManager implements CacheManager {
    private cache = new WeakMap<CacheIdentifier<any, any>, Map<any, any>>();
    public get<K, V>(id: CacheIdentifier<K, V>, key: K): V | undefined {
        const cache = this.cache.get(id);
        return cache === undefined ? undefined : cache.get(key);
    }
    public resolve<K, V>(id: CacheIdentifier<K, V>, key: K, cb: (key: K) => V): V {
        let cache = this.cache.get(id);
        if (cache === undefined) {
            cache = new Map<K, V>();
            this.cache.set(id, cache);
        }
        let result = cache.get(key);
        if (result === undefined && !cache.has(key)) {
            result = cb(key);
            cache.set(key, result);
        }
        return result;
    }
    public set<K, V>(id: CacheIdentifier<K, V>, key: K, value: V): void {
        let cache = this.cache.get(id);
        if (cache === undefined) {
            cache = new Map<K, V>();
            this.cache.set(id, cache);
        }
        cache.set(key, value);
    }
    public delete<K>(id: CacheIdentifier<K, any>, key: K): void {
        const cache = this.cache.get(id);
        if (cache !== undefined)
            cache.delete(key);
    }
    public has<K>(id: CacheIdentifier<K, any>, key: K): boolean {
        const cache = this.cache.get(id);
        return cache !== undefined && cache.has(key);
    }
    public clear(id: CacheIdentifier<any, any>): void {
        this.cache.delete(id);
    }
}
