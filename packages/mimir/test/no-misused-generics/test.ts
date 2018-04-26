declare function get(): void;
declare function get<T>(): T;
declare function get<T extends object>(): T;
declare function get<T, U = T>(param: U): U;
declare function get<T, U extends T = T>(param: T): U;
declare function get<T>(param: T[]): T;
declare function get<T extends string, U>(param: Record<T, U>): boolean;
declare function get<T>(param: <T, U>(param: T) => U): T

function fn<T>(param: string) {
    let v: T = null!;
    return v;
}

declare class C<V> {
    method<T, U>(param: T): U;
    prop: <T>() => T;
}

<T>(param): T => null!;

get<string>();

declare function take<T>(param: T): void; // T not used as constraint -> could just be `any`
declare function take<T extends object>(param: T): void; // could just use `object`
declare function take<T, U = T>(param1: T, param2: U): void; // no constraint

declare function identity<T>(param: T): T; // this is valid as it constrains the return type to the parameter type
declare function compare<T>(param1: T, param2: T): boolean; // this is valid because it enforces comparable types for both parameters
declare function compare<T, U extends T>(param1: T, param2: U): boolean; // this is also valid because T constrains U

// type parameters in implementations are always necessary, because they enforce type safety in the function body
function doStuff<K, V>(map: Map<K, V>, key: K) {
    let v = map.get(key);
    v = 1; // this error disappears if V is replaces with `any`
    map.set(key, v);
    return v; // signature has implicit return type `V`, but we cannot know that without type information
}

declare class Foo {
    prop: string;
    getProp<T>(this: Record<'prop', T>): T;
    compare<T>(this: Record<'prop', T>, other: Record<'prop', T>): number;
    foo<T>(this: T): void;
}
