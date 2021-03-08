import { CacheFactory, Cache } from '@fimbul/ymir';
export declare class DefaultCacheFactory implements CacheFactory {
    create<K extends object, V = any>(weak: true): Cache<K, V>;
    create<K = any, V = any>(weak?: false): Cache<K, V>;
}
