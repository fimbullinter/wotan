export {};
declare function get<T>(): T;
interface MyWeirdPromise<V> {
    then<T extends (p: V) => void>(cb: T): void;
}
interface MyEvenWeirderPromise<T> {
    then(cb: T): void;
}
async function test<T extends PromiseLike<string>, U extends {then(cb: () => void): void}>(p1: T, p2: U) {
    try {
        let x: T | U | boolean = null as any;
        return x;
        return p1;
        return p2;
        return get<Promise<void>>();
        return get<PromiseLike<void>>();
        return get<MyWeirdPromise<string>>();
        return get<MyEvenWeirderPromise<(v: string) => void>>();
        return get<Record<'then', (cb: (v: string) => void) => void>>();
        return get<Pick<PromiseLike<string>, 'then'>>();
        return get<Promise<string> | string>();
        return get<{} | Promise<string> | string>();
        return get<PromiseLike<void> | Promise<void>>();
        return get<PromiseLike<string> | PromiseLike<number>>();
        return get<Promise<string> | PromiseLike<number>>();
        return get<(Promise<string> | PromiseLike<number>) & {foo: any}>();
        return get<{then(): void, then(cb: (v: string) => void): void}>();
        return get<{then: {(): void, (cb: (v: string) => void): void}}>();
        return get<{then(...args: Array<() => void>): void}>();
        return get<{then(cb: () => void): void}>();
        return get<{then(cb: (v: string) => void): void}>();
        return get<{then(cb?: (v: string) => void): void}>();
        return get<{then(fulfill: (v: string) => void, reject: (v: string) => void): void}>();
        return get<{then(fulfill: () => void, reject: () => void, something: () => void): void}>();
        return get<PromiseLike<number> | {then(fulfill: (v: string) => void, reject: (v: string) => void): void}>();
        return get<PromiseLike<number> | {then(fulfill: (v: string, v2: number) => void): void}>();
        return get<PromiseLike<number> & {then: {}}>();
        return get<PromiseLike<number> & {then(): void}>();
        return get<PromiseLike<number> & {then(cb: (v: number) => void): void}>();
        // the compiler complains when adding `await` here because the signatures are not compatible
        // adding a check for this case is not worth the effort because the compiler also won't let you return this abomination
        return get<PromiseLike<number> & {then(cb: () => void): void}>();

        // not valid Promises
        return get<{then: any}>();
        return get<{then(): void}>();
        return get<{}>();
        return get<any>();
        return get<{[key: string]: any}>();
        return get<{[key: string]: (cb: (v: any) => void) => void}>();
        return get<{then(fulfill: string): void}>();
        return get<{then(...args: () => void): void}>();
        return get<string | number>();
    } catch {
    }
}
