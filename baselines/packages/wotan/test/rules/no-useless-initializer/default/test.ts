{
    let foo;
    const bar = undefined;
    var baz;
    const {a, b} = {a: 1, b: 2};
    const {c, d} = {}; // TODO this should be allowed
}
{
    let foo = "undefined";
    let bar = null;
    let baz = bar ? bar : undefined;
    let bas = undefined!;
    const {a = null, b = "undefined"} = {};
}

function one(a?: string, b: string, c?: any, d?: number) {}
(function two(a?: string, ...rest: string[]) {});

type undef = undefined;
function three(a?: boolean | undef) {}

let fn: typeof three = (a?) => {};

class Foo {
    prop = undefined;
    prop2: string | undefined = undefined;

    method(param?) {}

    constructor(private prop3?: string) {}
}

let obj = {
    prop: undefined,
};
