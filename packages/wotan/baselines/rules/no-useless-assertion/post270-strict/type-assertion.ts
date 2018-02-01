export {};

<1>1;
<number>1;
(1 + 1);

let a: string = "foo";
a;
a;
a as {} as number;
a as any;

let b = a ? a : undefined;
b as string;
b!;

"".trim();

let c = !!b;
c;

interface I {
    prop: string;
    method(): number;
}

declare let d: I;
d;
d.method();

let e = "foo" as 'foo';
e as typeof e;

['a', 'b', 'c'].map((element, i) => [i, element] as [number, string]);
let f: Array<[number, string]> = ['a', 'b', 'c'].map((element, i) => [i, element] as [number, string]);

declare const g: '1.0';
g as string === '2.0';
declare let h: Array<'a' | 'b' | 'c'>;
(h as string[])[0] === 'z';
declare let i: 'a' | 'b' | 'c';
i as string === 'z';

interface NotATuple {
    0: number,
    0.5: number,
    2: number,
}

interface AlsoNotATuple {}

declare const notATuple: NotATuple;
notATuple;

declare const alsoNoTuple: AlsoNotATuple;
alsoNoTuple;

unknownName;

function fn<T extends string | undefined>(param: T) {
    param as string;
    param;
    param;
    b as T;
    b = param;
    param = b as T;

    function takeStringUndefined(p: string | undefined) {}

    // better not add an error when calling `fn` as the assertion is used to infer T
    fn(a as string | undefined);
    fn(b);
    fn(b as string);
    fn(param);
    fn(param as string);

    // it's safe to show errors here
    takeStringUndefined(a as string | undefined);
    takeStringUndefined(b);
    takeStringUndefined(b);
    takeStringUndefined(param);
    takeStringUndefined(param);
    takeStringUndefined(param);
    takeStringUndefined(b);
}
