import def, {ns, v, something as somethingSomething} from './es6-module'; // importing deprecated stuff is not that bad, using it is
import * as moduleNamespace from './es6-module';
import * as namespaceImport from './export-assignment';

import MyImportedInterface = ns.I;
import MyOtherImportedInterface = ns.D;
import myNamespaceAlias = moduleNamespace.ns;
import MyDAlias = moduleNamespace.ns.D;

namespaceImport;
namespaceImport();
def;
v;
somethingSomething;
moduleNamespace.default;
moduleNamespace.v;
moduleNamespace.something;
let _v: ns.I,
    _v2: ns.D,
    _v3: myNamespaceAlias.I;

/** @deprecated */
class Foo implements ns.D, MyDAlias {}
class Bar extends Foo implements ns.I {}

new Foo();
new Bar();

/** @deprecated Use the other overload instead. */
function baz(): string;
function baz(v: string): string;
function baz(...args: string[]) {return args[0];}

baz;
baz();
baz('');
(((baz)));
((baz))();
((baz))('');

declare const bas: {
    /** @deprecated Use the other overload instead. */
    (): string;
    (v: string): string;
};

bas;
bas();
bas('');

/** @deprecated Variable is deprecated. */
declare const fn: typeof bas;
fn;
fn();
fn('');

declare function getFn(): typeof bas;
getFn()();
getFn()('');

declare let key: 'foo';
declare let key2: string;
declare let k: 'b' | 'a' | 'foo';

let obj = {
    /** @deprecated a*/
    a: '',
    b: '',
    /** @deprecated c*/
    'c': '',
    /** @deprecated d*/
    ['d']: '',
    /** @deprecated foo*/
    [key]: '',
    /** @deprecated something*/
    [key2]: '',
};

obj.a;
obj.b;
obj.c;
obj.d;
obj.foo;
obj['a'];
obj['b'];
obj['c'];
obj['d'];
obj['foo'];
obj[key];
obj.somethingElse;
obj['somethingElse'];
obj[key2];
obj[k];
obj[];

declare let obj2: {
    /** @deprecated */
    [key: string]: string;
};
obj2.a;
obj2['b'];
obj2[key];

class HasDeprecatedConstructor {
    /** @deprecated */
    constructor() {}
}
class HasDeprecatedConstructorOverload extends HasDeprecatedConstructor {
    /** @deprecated */
    constructor(p: string);
    constructor(p: number);
    constructor(p: string | number) {
        super();
    }
}
class Extending extends HasDeprecatedConstructorOverload {
    constructor(p?: string) {
        if (p !== undefined) {
            super(p);
        } else {
            super(1);
        }
    }
}

new HasDeprecatedConstructor();
new HasDeprecatedConstructorOverload('');
new HasDeprecatedConstructorOverload(1);
new Extending('');
new Extending();
let _1: HasDeprecatedConstructor,
    _2: HasDeprecatedConstructorOverload,
    _3: Extending;

class HasDeprecatedMethods {
    prop: typeof bas;
    /** @deprecated */
    method(): void;
    method(p: string): void;
    method() {}

    /** @deprecated */
    deprecatedProp: typeof bas;

    /** @deprecated */
    deprecatedProp2: () => void;

    initialized = baz;

    /** @notDeprecated */
    notDeprecated: () => void;
}

{
    const v = new HasDeprecatedMethods();
    v.prop;
    v.prop();
    v.prop('');
    v.method;
    v.method();
    v.method('');
    v.deprecatedProp;
    v.deprecatedProp();
    v.deprecatedProp('');
    v.deprecatedProp2;
    v.deprecatedProp2();
    v.initialized;
    v.initialized();
    v.initialized('');

    v['prop']();
    v['notDeprecated']();
    v[Boolean() ? 'prop' : 'notDeprecated']();
    v[Boolean() ? 'method' : 'notDeprecated']();
    v[Boolean() ? 'method' : 'deprecatedProp']();
    v['method'];
    v['method']();
    v['prop'];
}

{
    /* @deprecated */
    let noJsdoc: string;
    noJsdoc = 'foo';

    // @deprecated
    let alsoNoJsdoc: string;
    alsoNoJsdoc = 'bar';
}

declare function tag(parts: TemplateStringsArray, ...values: string[]): string;
declare function tag(parts: TemplateStringsArray, ...values: number[]): string;
/** @deprecated */
declare function tag(parts: TemplateStringsArray, ...values: any[]): string;

tag`a`;
tag`${''}`;
tag`${1}`;
tag`${''}${1}`;

declare function decorator<T extends Function>(clazz: T): T;
/** @deprecated Options should be provided. */
declare function decorator(): ClassDecorator;
declare function decorator(options: {foo: string, bar: string}): ClassDecorator;

@decorator
@decorator()
@decorator({foo: '', bar: ''})
class Decorated {}

{
    /** @deprecated */
    let a: string;
    /** @deprecated */
    let b: string;
    /** @deprecated */
    let c: {};
    let d: string;
    ({a, c: b, d, ...c} = {a: 'a', b: 'b', c: 'c'});
    // unfortunately we don't get the Symbol of `a` to show the deprecation of the variable
    // https://github.com/Microsoft/TypeScript/issues/21033
}

{
    let obj = {
        /** @deprecated a */
        a: 'a',
        /** @deprecated b */
        b: 'b',
        /** @deprecated c */
        c: 'c',
    };
    let a: string;
    let b: string;
    let c: {};
    ({a, c: b, ...c} = obj);
}

{
    let obj = {
        /** @deprecated a */
        a: 'a',
        /** @deprecated b */
        b: 'b',
        /** @deprecated c */
        c: 'c',
    };
    let {a, c: b, d, 'foo': e, ...c} = obj;
    c.b;
}

{
    let obj = {
        /** @deprecated a */
        a: 'a',
        /** @deprecated b */
        b: 'b',
        /** @deprecated c */
        c: 'c',
    };
    let k: keyof typeof obj = null as any;
    let {[k]: prop} = obj;
    let v: string;
    ({[k]: v} = obj); // TODO this would be possible with some effort
}

{
    const enum Indizes {
        Zero,
        One,
        Two,
    }
    const enum StringIndizes {
        Zero = '0',
        One = '1',
        Two = '2',
    }
    let tuple: {
        0: string;
        /** @deprecated */
        1: number;
        2: boolean;
    } = null as any;
    tuple[0];
    tuple[1];
    tuple[2];
    tuple[Indizes.Zero];
    tuple[Indizes.One];
    tuple[Indizes.Two];
    tuple[StringIndizes.Zero];
    tuple[StringIndizes.One];
    tuple[StringIndizes.Two];
    const key: Indizes = null as any;
    tuple[key];
    const stringKey: StringIndizes = null as any;
    tuple[stringKey];
}
