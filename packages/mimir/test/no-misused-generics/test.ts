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
