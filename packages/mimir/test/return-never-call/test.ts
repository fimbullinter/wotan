export {};

declare function get<T>(): T;
declare let n: never;

n;

get<string>();
get<number>();
get<never>();

function test<T extends never>(param: T) {
    get<T>();
    get<typeof param>();
    return param;
}

test(get<never>());

function returned(fn: () => never) {
    fn();
    return fn();
}

function thrown(fn: () => never) {
    fn();
    throw fn();
}

function last(fn: () => never) {
    console.log('foo');
    fn();
}

if (Boolean()) {
    get<never>();
} else {
    get<never>();
}
