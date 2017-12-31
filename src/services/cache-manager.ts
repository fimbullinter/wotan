import { injectable } from 'inversify';
import { CacheManager, CacheIdentifier, Cache } from '../types';

class WeakCache<K extends object, V> implements Cache<K, V> {
    private store = new WeakMap<K, V>();
    public get(key: K): V | undefined {
        return this.store.get(key);
    }
    public set(key: K, value: V): void {
        this.store.set(key, value);
    }
    public delete(key: K): void {
        this.store.delete(key);
    }
    public has(key: K): boolean {
        return this.store.has(key);
    }
    public clear(): void {
        this.store = new WeakMap();
    }
}

@injectable()
export class DefaultCacheManager implements CacheManager {
    private cache = new WeakMap<CacheIdentifier<any, any>, Cache<any, any>>();
    public get<K, V>(id: CacheIdentifier<K, V>): Cache<K, V> | undefined {
        return this.cache.get(id);
    }
    public create<K, V>(id: CacheIdentifier<K, V>): Cache<K, V> {
        let result = this.cache.get(id);
        if (result === undefined) {
            result = id.weak ? new WeakCache() : new Map();
            this.cache.set(id, result);
        }
        return result;
    }
}
