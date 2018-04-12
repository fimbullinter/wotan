export {};

declare function get<T>(): T;

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
