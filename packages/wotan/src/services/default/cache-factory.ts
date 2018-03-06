import { injectable } from 'inversify';
import { CacheFactory, Cache } from '@fimbul/ymir';

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
export class DefaultCacheFactory implements CacheFactory {
    public create<K extends object, V = any>(weak: true): Cache<K, V>;
    public create<K = any, V = any>(weak?: false): Cache<K, V>;
    public create(weak?: boolean): Cache<any, any> {
        return weak ? new WeakCache() : new Map();
    }
}
