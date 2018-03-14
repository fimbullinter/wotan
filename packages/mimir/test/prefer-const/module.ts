import imported from 'foo';
let imported = 0;

var ns = {}, notMerged = '';
namespace ns {}

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

typeof foobar;
var foobar = 0;

var {[v1]: v2, v1} = {v1: 0};
var [v3] = [v3];
var {foo: {} = v4, v4} = {v4: v2};

function test(a: string, {length}: any[]) {
    var a = '', d = 0;
    var b = 0, c = 0;
    var b: number;
}

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
