export {};

1!;
(1 + 2)!;
null!;
undefined!;

const a = 1;
a!;

let b: string | undefined;
b = "b";
b!;
b = undefined;
b!;

const c = !b ? "foo" : undefined;
c!;

const obj = {
    prop: c,
};
obj!.prop!;

let d: string;
d!;
d = "foo";
d!;

let e: string | number;
e!;
e = 1;
e!;

const f = c ? c : null;
f!;
f!!;

declare let g: string;
g!;

let {h} = {h: ''};
h!;

let i: string;
i!;
{
    i!;
}
function foo(j: string) {
    j!;
    i!;
}

let k = b || c!; // this line should not be an error in strict mode
k!; // but this line should

foobar!;

declare let possiblyNull: string | null;
declare let possiblyUndefined: string | undefined;
declare let possiblyBoth: string | null | undefined;

function takeAny(arg: any) {}
function takeNull(arg: string | null) {}
function takeUndefined(arg: string | undefined) {}
function takeBoth(arg: string | null | undefined) {}
function takeStringNumberUndefined(arg: string | number | undefined) {}

takeAny(possiblyNull!);
takeAny(possiblyUndefined!);
takeAny(possiblyBoth!);

takeNull(possiblyNull!);
takeNull(possiblyUndefined!);
takeNull(possiblyBoth!);

takeUndefined(possiblyNull!);
takeUndefined(possiblyUndefined!);
takeUndefined(possiblyBoth!);

takeBoth(possiblyNull!);
takeBoth(possiblyUndefined!);
takeBoth(possiblyBoth!);

takeStringNumberUndefined(possiblyNull!);
takeStringNumberUndefined(possiblyUndefined!);
takeStringNumberUndefined(possiblyBoth!);

declare let functionOrAny: (() => void) | undefined;
functionOrAny!();
