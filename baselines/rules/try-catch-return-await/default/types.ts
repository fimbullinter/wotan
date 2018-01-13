interface MyWeirdPromise<V> {
    then<T extends (p: V) => void>(cb: T): void;
}
interface MyEvenWeirderPromise<T> {
    then(cb: T): void;
}
async function test<T extends PromiseLike<string>, U extends {then(cb: () => void): void}>(p1: T, p2: U) {
    try {
        return await p1;
        return await p2;
        return await get<Promise<void>>();
        return await get<PromiseLike<void>>();
        return await get<MyWeirdPromise<string>>();
        return await get<MyEvenWeirderPromise<(v: string) => void>>();
        return await get<Record<'then', (cb: (v: string) => void) => void>>();
        return await get<Pick<PromiseLike<string>, 'then'>>();
        return await get<PromiseLike<void> | Promise<void>>();
        return await get<PromiseLike<string> | PromiseLike<number>>();
        return await get<Promise<string> | PromiseLike<number>>();
        return await get<(Promise<string> | PromiseLike<number>) & {foo: any}>();
        return await get<{then(): void, then(cb: (v: string) => void): void}>();
        return await get<{then: {(): void, (cb: (v: string) => void): void}}>();
        return await get<{then(...args: Array<() => void>): void}>();
        return await get<{then(cb: () => void): void}>();
        return await get<{then(cb: (v: string) => void): void}>();
        return await get<{then(cb?: (v: string) => void): void}>();
        return await get<{then(fulfill: (v: string) => void, reject: (v: string) => void): void}>();
        return await get<{then(fulfill: () => void, reject: () => void, something: () => void): void}>();
        return await get<PromiseLike<number> | {then(fulfill: (v: string) => void, reject: (v: string) => void): void}>();
        return await get<PromiseLike<number> | {then(fulfill: (v: string, v2: number) => void): void}>();
        return await get<PromiseLike<number> & {then: {}}>();
        return await get<PromiseLike<number> & {then(): void}>();
        return await get<PromiseLike<number> & {then(cb: (v: number) => void): void}>();
        // the compiler complains when adding `await` here because the signatures are not compatible
        // adding a check for this case is not worth the effort because the compiler also won't let you return this abomination
        return await get<PromiseLike<number> & {then(cb: () => void): void}>();

        // not valid Promises
        return get<{then(): void}>();
        return get<{}>();
        return get<any>();
        return get<{[key: string]: any}>();
        return get<{[key: string]: (cb: (v: any) => void) => void}>();
        return get<{then(fulfill: string): void}>();
        return get<{then(...args: () => void): void}>();
    } catch {
    }
}
