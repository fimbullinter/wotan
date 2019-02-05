import imported from 'foo';
let imported = 0;

export let exported = 0;
let exported2 = 0;
export {
    exported2,
};

try {
    throw 'foo';
} catch (e) {}

var ns = {}, notMerged = '';
namespace ns {}

let ns2 = {};
namespace ns2 {}

var a;

var foo = 0;
foo;
{
    foo;
    foo === 0;
    let local: typeof foo = 0;
}

bar;
var bar = 0;

useBaz();
var baz = 0;
function useBaz() {
    let local: typeof foo = baz;
}

{
    var bas = 0;
}
bas;

{
    var nested = 0;
}
{
    nested;
}

typeof foobar;
var foobar = 0;

var {[v1]: v2, v1} = {v1: 0};
var [v3] = [v3];
var {foo: {} = v4, v4} = {v4: v2}, v5 = 0;

function test(a: string, {length}: any[]) {
    var a = '', d = 0, {p1 = p1, foo: [{p3, p4, p5, ...p6} = p3, ...p2] = [p2, p5] } = {p4} as any;
    var b = 0, c = 0;
    var b: number;
}

for (let len = 10, i = 0; i < len; ++i);
for (let len = 10, i = 0; i < len;);
for (let [key, value] of new Map()) {
    key = null!;
}
for (let key in {}) {}
for (var arr of arr) {}

let uninitialized: number | undefined;

const alreadyConst = 0;

declare let ambient: string;

declare global {
    let globalVar: number;
}

declare namespace ambientNamespace {
    let var1: string;
    let var2: number;
    export {
        var2,
    };
}

for (var element of new Array(element)) {
    element;
}

for (var element2 of []) {
    element2;
}
