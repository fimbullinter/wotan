declare function get<T>(): T;

interface ExtendsPromise<T> extends Promise<T> {}

async function test<T extends Promise<string>, U extends T | undefined>(p: T, p2: U) {
    let foo: {await: boolean} = {await: true};
    await p;
    await p2; // as of typescript@2.7.0 the compiler doesn't infer the result of this one correctly, but it's still a promise so we allow it
    await get<Promise<string>>();
    await get<PromiseLike<string>>();
    await get<Promise<string> | PromiseLike<string>>();
    await get<any>();
    await get<Promise<string> | string>();
    await get<ExtendsPromise<number>>();
    await get<Promise<string> & {done: boolean}>();
    await get<Readonly<Promise<string>>>();
    await get<Pick<Promise<string>, 'then'>>();
    await get<(Promise<string> | string) & {}>();
    await get<Promise<string> & {then(cb: (v: string) => void): void}>();
    await get<Promise<string> & {then(cb: (v: number) => void): void}>();
    await get<{then(): void}>(); // don't care to add a failure here as it's already a compile errors
    const v = get<{then?: (cb: (v: string) => void) => void}>();
    if (hasThen(v)) {
        await v;
    } else {
        await v;
    }
    await get;
    await get<{then: any}>();
    await get<{foo: string}>();
    await get<void>();
    await get<never>();
    await get<undefined>();
    await get<{[key: string]: (v: string) => void}>(); // no implicit `then` property
    await get<number | boolean>();
    /** await */ await get<number>();
    await {prop: 1};
}

declare function hasThen(v: {}): v is {then: {}};
