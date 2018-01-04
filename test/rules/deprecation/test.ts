/** @deprecated */
class Foo {}
class Bar extends Foo {}

new Foo();
new Bar();

/** @deprecated Use the other overload instead. */
function baz(): string;
function baz(v: string): string;
function baz(...args: string[]) {return args[0];}

baz;
baz();
baz('');

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

declare let obj2: {
    /** @deprecated */
    [key: string]: string;
};
obj2.a;
obj2['b'];
obj2[key];
