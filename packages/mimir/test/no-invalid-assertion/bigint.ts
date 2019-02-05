export {};

declare function get<T>(): T;

get<1n>() as 1n;
get<1n>() as 2n;
get<1n>() as 1n | 2n;
get<2n>() as -2n;
get<-2n>() as -2n;
get<1n | 2n>() as 1n;
get<1n | 2n>() as 2n;
get<1n | 2n>() as 3n;

get<1n | 'foo'>() as 1 | 'foo';
get<1n | 'foo'>() as 2n | 'foo';
get<bigint | 1n & {foo: 1}>() as 2n;
get<1n | bigint & {foo: 1}>() as 2n;

get<1n | '1n'>() as 2n | '1n';
