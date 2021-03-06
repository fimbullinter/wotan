<1>1;
<number>1;
<number>(1 + 1);

let a: string = "foo";
a as typeof a;
<string><string>a as string as string as string;
a as {} as number;
a as any;

declare let arr: Array<string | undefined>;
arr.indexOf(<string>a);

let b = a ? a : undefined;
b as string;
b! as string;
arr.indexOf(<string>b);
arr.indexOf(b as string);


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

[] as [];

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
<NotATuple>notATuple;

declare const alsoNoTuple: AlsoNotATuple;
<AlsoNotATuple>alsoNoTuple;

<any>unknownName;

function fn<T extends string | undefined>(param: T): T {
    param as string;
    param as string | undefined;
    param as typeof param;
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

    return param;
}

function fn2<T>(param: T) {
    fn(param as any);
}

function fn3<T>(param: T) {
    fn2(param as any);
}

function fn4<T>(cb: (param: T) => void) {
    return function <T>(v: T) {
        cb(v as any);
    }
}

function typeArg<T extends string | undefined>(a: T, b: (param: T) => void) {
    b(a);
}

typeArg(a as string | undefined, (b) => b);

`${a as string | undefined}`;

declare function tag(strings: TemplateStringsArray, ...values: any[]): string;
tag`${a as string | undefined}`;

declare function genericTag<T>(strings: TemplateStringsArray, ...values: T[]): T;
genericTag`${a as string | undefined}`;

declare function genericTag2<T extends string | undefined>(strings: TemplateStringsArray, ...values: T[]): T;
genericTag2`${a as string | undefined}`;

namespace A {
    export class MyClass {
        public prop = '';
    }
}

namespace B {
    export class MyClass {
        public prop = '';
        public prop2 = '';
    }
}

declare let myObj: A.MyClass;
<B.MyClass>myObj;

<number>{prop: 1}.prop;
<number>class {static prop: number}.prop;
<number>function() { return 1; }();

export default <number>class{static prop: number}.prop;
export default <number>{prop: 1}.prop;
export = <number>class{static prop: number}.prop;

fn2<1>(1 as const);
fn2<''>(<const>'');

<const>{a: 1 as 1, b: true as false};
<const>[<const>1, 2 as const, fn('' as const)];
