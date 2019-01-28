import {literal, emptyLiteral} from './literal';

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

({
    foo: 1,
    bar: 1,
    ...get<{bar: number} & Record<'foo' | 'baz', number>>(),
    bas: 1,
});

({
    ...get<{bar: number} & Record<'foo' | 'baz', number>>(),
    foo: 1,
    bar: 1,
    bas: 1,
});

({
    ...get<{bar: number} & Record<'foo' | 'baz', number>>(),
    foo: 1,
    bar: 1,
    baz: 1,
});

({
    bar: 1,
    ...get<{bar: number} & Record<string, number>>(),
});

({
    ...get<{bar: number} & Record<string, number>>(),
    bar: 1,
});

({
    ...emptyLiteral,
    a: 1,
    b: 1,
});

({
    a: 1,
    b: 1,
    c: 1,
    ...emptyLiteral,
});

({
    ...literal,
    a: 1,
    b: 1,
});

({
    a: 1,
    b: 1,
    c: 1,
    ...literal,
});

function test<T, U extends T, V extends any, W extends object>(t: T, u: U, v: V, w: W) {
    ({foo: 1, ...t, ...u, ...v});
    ({valueOf: null, toString: null, ...w}); // make sure we don't use the apparent type
}

function test2<T extends Record<'foo', number>, U extends T, V extends T & Record<'bar', number>>(t: T, u: U, v: V) {
    ({foo: 1, bar: 1, ...t});
    ({foo: 1, bar: 1, ...u});
    ({...t, ...u});
    ({...t, ...get<T>()});
    ({...u, ...t});
    ({...t, ...u, foo: 1});
    ({foo: 1, bar: 1, ...get<T & {bar: number}>()});
    ({foo: 1, bar: 1, ...v});
}

function test3<T>(t: T) {
    ({foo: 1, bar: 1, ...get<T extends number ? {foo: 1} : {bar: 1}>()});
    ({foo: 1, bar: 1, ...get<T extends number ? {foo: 1} : {foo: 2}>()});
}

function test4<T extends {foo: 1} | {bar: 1}, U extends {foo: 1} | {foo: 2}>(t: T, u: U) {
    ({foo: 1, bar: 1, ...t});
    ({foo: 1, bar: 1, ...u});
}
