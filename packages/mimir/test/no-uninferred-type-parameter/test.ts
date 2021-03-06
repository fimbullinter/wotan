export {};

declare var bool: boolean;
type EmptyObject = {};

nonExistent();

declare function nonGeneric(): void;

nonGeneric();
nonGeneric('foo');
fn(1, 2, 3);

import {fn as jsFn, arrayFn, multiParam, weirdMultiParam, nonGenericJs, JsClass, RealJsClass, functionTyped, notGeneric} from './js';

nonGenericJs();

jsFn();
jsFn(1);
jsFn<number>();
jsFn<number>(1);

arrayFn();
arrayFn(null as any);
arrayFn([]);
arrayFn([1]);
arrayFn([{}]);
arrayFn<number>();

multiParam();
multiParam(1);
multiParam(1, '2');
multiParam(1, '2', true);

weirdMultiParam();

functionTyped();
functionTyped(1);
functionTyped<number>();
functionTyped<number>(1);

notGeneric();
notGeneric(1);

new JsClass();
new JsClass(1);
new JsClass<number>();
new JsClass<number>(1);

new RealJsClass();
new RealJsClass(1);
new RealJsClass<number>();
new RealJsClass<number>(1);

declare function fn<T, U>(one?: T, two?: U): void;

fn();
fn(1);
fn(1, '2');
fn<number, string>();
fn<number, string>(1);
fn<number, string>(1, '2');
fn({}, '2'); // there's not reliable way to tell if the empty object type is really intended like in this case
fn(1, {});
fn({foo: 1}, {bar: 2});

type LongLiteral = 'somereallyreallyreallyreallyreallyreallyreallyreallyreallylongliteraltypethathopefullycausestruncation';
declare function get(): {
    foo: LongLiteral;
    bar?: LongLiteral;
    baz: LongLiteral & {'prop': LongLiteral};
    bas: Set<LongLiteral>;
    foobar: Record<LongLiteral | 'foo', LongLiteral>;
    someReallyReallyReallyReallyLongNameThatHelpsWithTruncation: LongLiteral;
    yetAnotherReallyReallyReallyReallyLongNameThatHelpsWithTruncation: LongLiteral;
};
fn(get());

fn(bool ? 1 as {} : undefined, bool ? 1 as {} : null);
fn(bool ? 1 as {} : null, bool ? 1 as {} : undefined);
fn(bool ? 1 as unknown : undefined, bool ? 1 as unknown : null);
fn(bool ? 1 as unknown : null, bool ? 1 as unknown : undefined);

declare function inferParameter<T>(param?: Array<T>): void;

inferParameter();
inferParameter([]);
inferParameter([{}]);
inferParameter([null as any]);
inferParameter(null as any);

declare function withDefault<T = number, U = T>(one?: T, two?: U): void;

withDefault();
withDefault(1);
withDefault(1, '2');
withDefault<number, string>();
withDefault<number, string>(1);
withDefault<number, string>(1, '2');

declare function withWrongDefault<T = U, U = number>(one?: T, two?: U): void;

withWrongDefault(); // T is inferred as {}, but we're not able to detect that
withWrongDefault(1);
withWrongDefault(2, '2');

declare function withEmptyDefault<T = {}, U = EmptyObject>(one?: T, two?: U): void;

withEmptyDefault();
withEmptyDefault(1);
withEmptyDefault(1, '2');
withEmptyDefault<number, string>();
withEmptyDefault<number, string>(1);
withEmptyDefault<number, string>(1, '2');

declare function withDefaultDefault<T = {}, U = T>(one?: T, two?: U): void;

withDefaultDefault();
withDefaultDefault(1);
withDefaultDefault(1, '2');
withDefaultDefault<number, string>();
withDefaultDefault<number, string>(1);
withDefaultDefault<number, string>(1, '2');

declare function withOneDefault<T, U = T>(one?: T, two?: U): void;

withOneDefault();
withOneDefault({} as object);
withOneDefault([{}]);
withOneDefault(1);
withOneDefault(1, '2');

new NonExistent();

declare class NonGeneric {}
new NonGeneric();
interface NonGenericConstructor {
    new (): NonGeneric;
}
declare const NonGenericCtor: NonGenericConstructor;
new NonGenericCtor();

declare class Wrapper<T> {
    val: T;
}

new Wrapper();
new Wrapper<number>();
let wrapped: Wrapper<number> = new Wrapper();

interface WrapConstructor {
    new<T>(param?: T): Wrapper<T>;
}
declare const Wrap: WrapConstructor;
new Wrap();
new Wrap(1);
new Wrap<number>();
new Wrap<number>(1);

wrapped = new Wrap();

class MyWrap<T> {
    constructor(public param?: T) {}
}

new MyWrap();
new MyWrap<number>()
new MyWrap(1);

class MyOtherWrap<T> {
    constructor() {}
}
new MyOtherWrap();
new MyOtherWrap<number>();

function getWrapper() {
    return Wrapper;
}
new (getWrapper())();
new (getWrapper())<number>();

declare function getWrapConstructor(): WrapConstructor;
new (getWrapConstructor())();
new (getWrapConstructor())(1);
new (getWrapConstructor())<number>();
new (getWrapConstructor())<number>(1);

function getWrapConstructorInferred() {
    return Wrap;
}
new (getWrapConstructorInferred())();
new (getWrapConstructorInferred())(1);
new (getWrapConstructorInferred())<number>();
new (getWrapConstructorInferred())<number>(1);

interface C<T> {}
class C<T = {}> {}

new C();
new C<string>();

namespace C2 {}
interface C2<T, U, V = {}> {}
class C2<T, U = {}> {}
interface C2<T, U, V, W = {}> {}
interface C2<T> {}
interface C2<T, U> {}

new C2();
new C2<string>();

// avoid false positives while parsing type arguments
withOneDefault(<T>(param: T) => param);
withOneDefault({key: {}, anotherKey: {nested: {}}});
withOneDefault(fn);
withOneDefault(new Wrapper<{}>());
withOneDefault({key: new Wrapper<{}>()});
withOneDefault({'{}, {}': [{}]});
withOneDefault((() => 1) as {<T>(param: T): T});

/**
 * @template T
 * @param {T} [p]
 */
function withJsDoc(p?) {}
withJsDoc();

new withJsDoc();

new Promise<object>((resolve, reject) => {
    return import('js-yaml').then((yaml) => { // avoid crashing here
        try {
            return resolve(yaml.safeLoad("", {strict: true}) || {});
        } catch (e) {
            return reject(e);
        }
    });
});

declare function myTagFn<T>(parts: TemplateStringsArray, ...values: T[]): string;
declare function myOtherTag<T>(parts: TemplateStringsArray): T;
declare function tag(parts: TemplateStringsArray): string;

tag``;

myTagFn``;
myTagFn`${''}`;
myTagFn`${1}`;
myTagFn`${1}${''}`;
myTagFn<string | number>`${1}${''}`;

myOtherTag``;
myOtherTag`${''}`;
myOtherTag<string>``;

interface SomeConstructor<T> {
    new(arg: T): unknown;
}
declare const Ctor: SomeConstructor<any>;
new Ctor(''); // don't crash here

declare function pipe<A extends any[], B, C>(ab: (...args: A) => B, bc: (b: B) => C): (...args: A) => C;

declare function list<T>(a?: T): T[];
declare function list2<T = string>(a?: T): T[];
declare function box<V>(x: V): { value: V };

list();

const listBox = pipe(list, box);
listBox(1);
listBox();

const list2Box = pipe(list2, box);
list2Box(1);
list2Box();

declare function pipe2<A, B, C, D>(ab: (a: A) => B, cd: (c: C) => D): (a?: [A, C] | [A]) => [B, D];

const listList = pipe2(list, list);
listList([1, '2']);
listList([1]);
listList();

const list2List = pipe2(list, list2);
list2List([1, '2']);
list2List([1]);
list2List();

function pipe3<A, B, C, D>(ab: (a?: A) => B, cd: (c?: C) => D) {
    return (a?: A, c?: C) => [ab(a), cd(c)] as const;
}

const listList2 = pipe3(list, list);
listList2(1, '2');
listList2(1);
listList2();

declare function pipe4<A extends any[], B, C>(ab: (...args: A) => B, bc?: (b: B) => C): (...args: A) => C;

const listNone = pipe4(list);
listNone(1);

const unified = bool ? <T>(param?: T) => param : () => undefined;
unified('1');
unified();

const unified2 = bool ? (a?: string) => undefined : <T>(param?: T) => param;
unified2('2');
unified2();

const unified3 = bool ? (a?: string) => undefined : <T = string>(param?: T) => param;
unified3('2');
unified3();

declare const unified4: {(): void; (param?: string): string} | (<T>(param?: T) => T);
unified4('1');
unified4();

declare const unified5: (<T>(a?: T) => T) | {(): void; (param?: string): string};
unified5('1');
unified5();

declare const unified6: (<T = string>(a?: T) => T) | {(): void; (param?: string): string};
unified6('1');
unified6();

declare function overloaded<T>(): void;
declare function overloaded<T, U>(param: T): void;
declare function overloaded<T, U, V, W = string>(a: T, b: T): void;
declare function overloaded(a: string, b: string, c: string): void;

overloaded();
overloaded(1);
overloaded(1, 2);
overloaded('', '', '');

function f<T extends typeof overloaded, U extends typeof unified5, V extends typeof unified6>(t: T, u: U, v: V) {
    t();
    t(1);
    t(1, 2);
    t('', '', '');

    u('1');
    u();

    v('1');
    v();
}

declare let untyped: Function;
untyped();

declare function toConstructor<P extends unknown[], R>(fn: (...params: P) => R): new (...params: P) => R;

const List = toConstructor(list);
new List(1);
new List();
new List<number>();

const List2 = toConstructor(list2);
new List2();
