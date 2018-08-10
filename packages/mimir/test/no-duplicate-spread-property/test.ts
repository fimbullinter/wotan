export {};

declare function get<T>(): T;

declare class WithMethods {
    foo(): void;
    bar: () => void;
    baz: string;
}

const foo = 'foo';

({
    x: 1,
    ...{x: 2, y: 2},
    y: 1,
    ...{x: 3},
});

({
    foo,
    ...{foo},
});

({
    [foo]: 1,
    ...{[foo]: 2},
});

({
    '__@iterator': 1,
    [Symbol.iterator]: 1,
    ...{[Symbol.iterator]: 2},
});

({
    [get<string>()]: 1,
    ...{[get<string>()]: 2},
});

({
    [get<'foo'>()]: 1,
    ...{[get<'foo'>()]: 2},
    ...{[foo]: 3},
});

({
    foo: 1,
    bar: 1,
    baz: 1,
    ...get<{foo?: string, bar: number, baz: boolean | undefined}>(),
});

({
    foo: 1,
    bar: 1,
    baz: 1,
    bas: 1,
    ...get<{foo: string, bar: number, bas: number} | {bar: number, baz: boolean, bas?: number}>(),
    ...Boolean() && {foo},
});

{
    let a, b;
    ({[foo]: a, foo: b, ...{}} = get<{foo: string}>());
}

({
    foo: 1,
    bar: 1,
    baz: 1,
    ...get<WithMethods>(),
});

({
    foo() {},
    bar: () => {},
    baz: get<() => void>(),
    ...get<WithMethods>(),
});

({
    foo() {},
    bar: () => {},
    baz: get<() => void>(),
    ...get<{foo(): void, bar: () => void, baz: number}>(),
});

({
    ...get<WithMethods>(),
    foo() {},
    bar: () => {},
    baz: get<() => void>(),
});

({
    ...get<{foo: number, bar: number, baz: number}>(),
    foo() {},
    bar: () => {},
    baz: get<() => void>(),
});

({
    prop: 1,
    ...get<unknown>(),
    prop2: 2,
    ...get<any>(),
});

var v: any;
({v, ...{v}} = get<Record<string, any>>());

({
    ['foo'+Math.random()]: 1,
    ['foo'+Math.random()]: 1,
    ['bar'+Math.random()]: 1,
    ['bar'+Math.random()]: 1,
    ...{
        ['foo'+Math.random()]: 2,
        ['bar'+Math.random()]: 2,
        bar: 2,
    },
    ...{
        ['foo'+Math.random()]: 2.5,
        ['bar'+Math.random()]: 2.5,
    },
    bar: 3,
    ['foo'+Math.random()]: 3,
    ['bar'+Math.random()]: 3,
});

({
    [get<'foo' | 'bar'>()]: 1,
    ...{
        foo: 2,
    },
});

({
    ...{
        foo: 2,
        bar: 2,
    },
    [get<'foo' | 'bar'>()]: 1,
});

({
    ...{
        foo: 2,
    },
    [get<'foo' | 'bar'>()]: 1,
});

({
    [get<'foo' | 'bar'>()]: 1,
    ...{
        foo: 2,
    },
    [get<'foo' | 'bar'>()]: 3,
});

({
    [get<'foo' | 'bar'>()]: 1,
    ...{
        foo: 2,
        bar: 2,
    },
});

({
    [get<'foo' | 'bar' | number>()]: 1,
    ...{
        foo: 2,
        bar: 2,
    },
});

({
    foo: 1,
    ...new class {
        get foo() { return 1; }
        set foo(v) {}
        bar = 1;
    },
});

({
    foo: 1,
    ...{
        get foo() { return 1; },
        bar: 2,
    },
});

({
    foo: 1,
    ...{
        get foo() { return 1; },
        set foo(v: number) {},
        bar: 2,
    },
});

({
    foo: 1,
    ...{
        set foo(v: number) {},
        bar: 2,
    },
});

({
    get foo() { return 1; },
    set foo(v: number) {},
    ...{
        bar: 1,
    },
});

({
    get foo() { return 1; },
    set foo(v: number) {},
    ...{
        foo: 2,
    },
});

({
    ...{
        get foo() { return 1 },
    },
    get foo() { return 2; },
    set foo(v: number) {},
});
