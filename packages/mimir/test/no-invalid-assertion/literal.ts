export {};

declare function get<T>(): T;

'foo' as 'foo';
'foo' as 'boo';
'foo' as any;
'1' as 1;
1 as 1;
1 as 2;
true as false;
<true>false;

get<boolean>() as true;
get<string>() as 'foo';
get<number>() as 1;

1 as number;
true as boolean;
<string>'foo';

get<any>() as 'foo';
get<never>() as 'foo';

function test<T extends 'foo'>(param: T) {
    param as 'bar';
    param as 'foo';
    1 as T;
    'foo' as T;
    'bar' as T;
}

1 as const;
<const>1;
