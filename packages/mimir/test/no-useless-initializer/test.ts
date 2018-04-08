{
    let foo = undefined;
    const bar = undefined;
    var baz = undefined;
}
{
    // TODO these need more accurate types from the type checker
    let {a = undefined, b = undefined} = {a: 1}; // a useless, b necessary
    const {c = undefined} = {}; // necessary
    let v = Boolean() ? {d: 1} : {};
    const {d = undefined} = v; // useless
    const {e = undefined} = Boolean() ? {e: 1} : {}; // necessary
    ({a = undefined, b = undefined} = {a}); // a useless, b necessary
}
{
    let foo = "undefined";
    let bar = null;
    let baz = bar ? bar : undefined;
    let bas = undefined!;
    const {a = null, b = "undefined"} = {};
}

function one(a: string | undefined = undefined, b: string, c: any = undefined, d?: number) {}
(function two(a: undefined | string = undefined, b = 1, ...rest: string[]) {});

type undef = undefined;
function three(a: boolean | undef = undefined) {}

let fn: typeof three = (a = undefined) => {};

class Foo {
    prop = undefined;
    prop2: string | undefined = undefined;

    method(param = undefined) {}

    constructor(private prop3: string | undefined = undefined) {}
}

let obj = {
    prop: undefined,
};

declare function get<T>(): T;

{
    let {prop = 'foo'} = obj;
    let {foo = 'foo'} = {foo: 'foo'};
    let {bar = 'bar'} = Boolean() ? {bar: 'bar'} : {};
    let {baz = 'baz'} = Boolean() ? {baz: 'baz'} : {baz: undefined};
    let {bas = 'bas'} = Boolean() ? {bas: 'bas'} : {bas: 'foobas'};
}
{
    let obj = {
        prop: 'foo',
    };
    let {prop = 'foo'} = obj;
    let {foo = 'oof'} = get<{foo: 'foo'}>();
    let {bar = 'bar'} = get<{bar?: 'bar'}>();
    let {baz = 'baz'} = get<{baz: 'baz'} | {baz: undefined}>();
    let {bas = 'bas'} = get<{bas: 'bas'} | {bas: 'foobas'}>();
    let {something = 'something'} = get<{[key: string]: string}>();
    let {any = 'any'} = get<{any: any}>();
    let {'prop': renamed = 'renamed'} = obj;
    let {[get<'prop'>()]: computed = 'computed'} = obj;
    let {nested: {prop: nestedProp = 'nestedProp'} = obj} = get<{nested: typeof obj}>();
    let {toString = () => 'foo'} = 1;

    ({toString = () => 'foo'} = 2);

    ({prop = ''} = {prop: 'foo'});
    ({prop = ''} = obj);
    ({prop = ''} = {});
    ({prop = ''} = get<typeof obj>());
    ({prop = ''} = get<{prop?: string}>());
}
{
    let [one = '', two = '', , four = ''] = get<string[]>();
    let [,, three = ''] = get<Array<string | undefined>>();
    let [a = '', b = 1, c = true] = get<[string, number, boolean]>();
    let [d = '', e = 1, f = true] = get<[string | undefined, number | undefined, boolean | undefined]>();
    let [g = '', h = 1, i = true] = get<[string, number, boolean] | [undefined, undefined, undefined]>();
    let [first = 2, second = 3] = [1, undefined];
}
