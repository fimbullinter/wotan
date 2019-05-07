import {jsObj} from './prop';

class Base {
    get prop() { return 1; }
    get prop2() { return 1; }
    get prop3() { return 1; }
    get prop4() { return 1; }
    get prop5() { return 1; }
    set prop5(_) {}
    get [name]() { return 1; }
    get [Symbol.toStringTag]() {return 'A'};
}
const prop4 = 'prop4';
class Derived extends Base {
    prop = 1;
    'prop2' = 1;
    'prop3' = 1;
    [prop4] = 1;
    prop5 = 1;
    [name] = 1;
    [Symbol.toStringTag] = 'B';
}

class Derived2 extends ((): new () => Readonly<Record<'foo', number>> => undefined!)() {
    foo = 1;
}

class Derived3 extends ((): new () => {readonly [K in 'bar']: number} => undefined!)() {
    bar = 1;
}

type Mutable<T> = {-readonly [K in keyof T]: T[K]};

class Derived4 extends ((): new () => Mutable<Readonly<Record<'baz', number>>> => undefined!)() {
    baz = 1;
}

class Derived5 extends ((): new () => Pick<Readonly<Record<'bas', number>>, 'bas'> => undefined!)() {
    bas = 1;
}

class Derived6 extends ((): new () => Partial<Readonly<Record<'foo', number>>> & Pick<Readonly<{bar: number} & {baz: number}>, 'baz'> => undefined!)() {
    foo = 1;
    bar = 1;
    baz = 1;
}

const obj = {const: 1 + 1} as const;

class Derived7 extends ((): new() => typeof obj => undefined!)() {
    const = 1;
}

class Derived8 extends ((): new() => readonly [number, string] => undefined!)() {
    0 = 1;
}

class TsClass extends ((): new() => typeof jsObj => undefined!)() {
    a = 1;
    b = 1;
    c = 1;
    d = 1;
    e = 1;
    f = 1;
}
