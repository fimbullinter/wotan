export {};

declare function get<T>(): T;

get<'foo' | 'bar'>() as 'foo';
get<'foo' | 'bar'>() as 'bar';
get<'foo' | 'bar'>() as 'boo';

get<'foo'>() as 'foo' | 'bar';
get<'foo'>() as 'boo' | 'bar';

get<'foo'>() as 'foo' | 1;
get<'foo'>() as 'boo' | 1;

get<'foo' | 1>() as 'foo';
get<'foo' | 1>() as 'boo';

get<'foo' | 1>() as 1;
get<'foo' | 1>() as 2;

get<'foo' | 'bar'>() as 'bar' | 'baz';
get<'foo' | 'bar'>() as 'baz' | 'bas';

get<'foo' | 'bar' | 1 | 2 | true>() as 'foo';
get<'foo' | 'bar' | 1 | 2 | true>() as 1;
get<'foo' | 'bar' | 1 | 2 | true>() as 1 | 'foo';
get<'foo' | 'bar' | 1 | 2 | true>() as 1 | 'foo' | false;
get<'foo' | 'bar' | 1 | 2 | true>() as 3;
get<'foo' | 'bar' | 1 | 2 | true>() as false;
get<'foo' | 'bar' | 1 | 2 | true>() as 'boo';
get<'foo' | 'bar' | 1 | 2 | true>() as 'boo' | 3 | false;

get<'foo' | 'bar' | 1 | 2 | true | object>() as 'boo' | object;

get<'foo'>() as 'baz' | (string & {length: number}) | 'bar';
get<'foo'>() as ('bar' & {length: number}) | string;
get<'foo'>() as string | ('bar' & {length: number});
get<'foo'>() as 'bar' | ('bar' & {length: number});
get<'foo'>() as ('baz' & {length: number}) | 'bar';
get<'foo'>() as ('baz' & {length: number}) | 'foo';
false as (true & {toString(): string}) | true;
false as true | (true & {toString(): string});
false as boolean | (true & {toString(): string});
1 as 0 | (number & {toString(base: number): string}) | 2 | 3;
1 as number | (0 & {toString(base: number): string});
1 as 1 & '';
1 as 0 & '';
