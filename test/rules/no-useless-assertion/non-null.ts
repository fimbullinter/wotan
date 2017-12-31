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

foobar!;
