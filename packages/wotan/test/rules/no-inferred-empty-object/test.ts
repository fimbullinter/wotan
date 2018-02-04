export {};

type EmptyObject = {};

nonExistent();

declare function nonGeneric(): void;

nonGeneric();

declare function fn<T, U>(one?: T, two?: U): void;

fn();
fn(1);
fn(1, '2');
fn<number, string>();
fn<number, string>(1);
fn<number, string>(1, '2');
fn({}, '2'); // there's not reliable way to tell if the empty object type is really intended like in this case
fn(1, {});

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

// avoid false positives while parsing type arguments
withOneDefault(<T>(param: T) => param);
withOneDefault({key: {}, anotherKey: {nested: {}}});
withOneDefault(fn);
withOneDefault(new Wrapper<{}>());
withOneDefault({key: new Wrapper<{}>()});
withOneDefault({'{}, {}': [{}]});
