import def, {ns, v, something as somethingSomething} from './es6-module'; // importing deprecated stuff is not that bad, using it is
import * as moduleNamespace from './es6-module';

import MyImportedInterface = ns.I;
import MyOtherImportedInterface = ns.D;
import myNamespaceAlias = moduleNamespace.ns;
import MyDAlias = moduleNamespace.ns.D;

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
