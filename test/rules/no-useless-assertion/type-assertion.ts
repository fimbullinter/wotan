export {};

<1>1;
<number>1;
<number>(1 + 1);

let a: string = "foo";
a as typeof a;
<string><string>a as string as string as string;
a as {} as number;
a as any;

let b = a ? a : undefined;
b as string;
b! as string;

"".trim() as string;

let c = !!b;
c as boolean;

interface I {
    prop: string;
    method(): number;
}

declare let d: I;
d as I;
d.method() as number;

let e = "foo" as 'foo';
e as typeof e;

['a', 'b', 'c'].map((element, i) => [i, element] as [number, string]);
let f: Array<[number, string]> = ['a', 'b', 'c'].map((element, i) => [i, element] as [number, string]);

interface NotATuple {
    0: number,
    0.5: number,
    2: number,
}

interface AlsoNotATuple {}

declare const notATuple: NotATuple;
<NotATuple>notATuple;

declare const alsoNoTuple: AlsoNotATuple;
<AlsoNotATuple>alsoNoTuple;

<any>unknownName;

function fn<T extends string | undefined>(param: T) {
    param as string;
    param as string | undefined;
    param as typeof param;
    param!;
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
    takeStringUndefined(b as T);
    takeStringUndefined(param);
    takeStringUndefined(param as T);
    takeStringUndefined(param as string | undefined);
    takeStringUndefined(b as string);
}
