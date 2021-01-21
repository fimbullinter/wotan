declare function get<T>(): T;
declare function fn(...args: any[]): any;
declare let obj: Record<string, unknown>;
declare let s: string;
declare let n: number;

'foo' + 'bar';
'foo' + 1;
1 + 'foo';
1 + 1;
'foo' + console.log('bar');

s += 'foo';
s += 1;
n += 'foo';
n += 1;

get<string | number>() + '';
'' + get<string | number>();

`${true}`;
fn`${true}`;

({
    [1]: 1,
    [1n]: 1,
    [Symbol.toStringTag]: 'foo',
    [{}]: 2,
});

`${1n}`;
`${Symbol.iterator}`;
`${get<string>()}`;
`${get<string & {__brand: never}>()}`;
`${get<object & {__brand: never}>()}`;
`${get<string | number>()}`;
`${get<unknown>()}`;
`${get<any>()}`;
`${get<never>()}`;
`${get<null | undefined>()}`;
`${get<string | undefined>()}`;
`${get<number | undefined>()}`;

function foo<T extends number>(p: T) {
    return 'foo' + p;
}

obj[1n];
obj[true];
