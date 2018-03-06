export {};

1;
(1 + 2);
null;
undefined;
NaN;
Infinity;
something;

const a = 1;
a;

let b: string | undefined;
b = "b";
b;
b = undefined;
b;

const c = !b ? "foo" : undefined;
c;

const obj = {
    prop: c,
};
obj.prop;

let d: string;
d;
d = "foo";
d;

let e: string | number;
e;
e = 1;
e;

const f = c ? c : null;
f;
f;

declare let g: string;
g;

let {h} = {h: ''};
h;

let i: string;
i;
{
    i;
}
function foo(j: string) {
    j;
    i;
}

let k = b || c; // this line should not be an error in strict mode
k; // but this line should

let l: string | null;

let m: any;
m;

foobar;

declare let possiblyNull: string | null;
declare let possiblyUndefined: string | undefined;
declare let possiblyBoth: string | null | undefined;

function take<T extends string | null | undefined>(arg: T, cb: (p: T) => void) {}
function takeAny(arg: any) {}
function takeNull(arg: string | null) {}
function takeUndefined(arg: string | undefined) {}
function takeBoth(arg: string | null | undefined) {}
function takeStringNumberUndefined(arg: string | number | undefined) {}

take<string | null>(possiblyNull, (p) => p);
take(possiblyNull, (p: string) => p);
take(possiblyNull, (p) => p.length);

takeAny(possiblyNull);
takeAny(possiblyUndefined);
takeAny(possiblyBoth);
takeAny(l);

takeNull(possiblyNull);
takeNull(possiblyUndefined);
takeNull(possiblyBoth);
takeNull(l);

takeUndefined(possiblyNull);
takeUndefined(possiblyUndefined);
takeUndefined(possiblyBoth);

takeBoth(possiblyNull);
takeBoth(possiblyUndefined);
takeBoth(possiblyBoth);

takeStringNumberUndefined(possiblyNull);
takeStringNumberUndefined(possiblyUndefined);
takeStringNumberUndefined(possiblyBoth);

declare let functionOrAny: (() => void) | undefined;
functionOrAny();

function fn<T extends string | undefined, U extends string, V>(one: T, two: U, three: V) {
    one;
    two;
    fn(one, two);
    foo(one);
    fn(two, one);
    foo(three);
    takeUndefined(one);
    let uninitialized: T;
    uninitialized;
    let uninitialized2: U;
    uninitialized2;
    let uninitialized3: V;
    uninitialized3;
    let uninitialized4: T | undefined;
    uninitialized4;
    let uninitialized5: U | undefined;
    uninitialized5;
    foo(uninitialized5);
    takeUndefined(uninitialized5);
}

interface I {
    foo?: string;
    bar?: string;
}

function fn1<T extends I>(o: T, k: keyof I) {
    foo(o[k]);
    takeUndefined(o[k]);
}

function fn2<T extends I, K extends keyof T>(o: T, k: K) {
    foo(o[k]); // TODO https://github.com/Microsoft/TypeScript/issues/12991
    takeUndefined(o[k]);
}

function fn3<K extends keyof I>(o: I, k: K) {
    foo(o[k]);
    takeUndefined(o[k]);
}

function fn4<T extends {} | undefined, U extends {}>(param1: T, param2: U) {
    const v = Boolean() ? param1 : param2;
    takeObject(v); // should be valid
    function takeObject(o: {}) {}
}
