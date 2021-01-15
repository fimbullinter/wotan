export {};

class Base {
    _ = 1;
    a = 1;
    b = 1;
    c = 1;
    d = 1;
    e = 1;
}

class Derived extends Base {
    a = 2;
    b;
    declare c: number;
    d: number = this['_'] + this['a'] + this['b'] + this['c'] + this['d'] + this['e'];
    e;

    constructor() {
        super();
        this['b'] = 2;
        this['e'] = 2;
    }
}

class C {
    a;
    declare b;
    c: number = this[Boolean() ? 'a' : Boolean() ? 'b' : 'c'];
    d = this['p'];

    constructor(private p: number) {
        this['a'] = 1;
        this['b'] = 1;
    }
}

class D {
    a!: number;
    b = this['a'] + this['c'];
    c!: number;
}

class Derived2 extends Base {
    b = this['a'];

    constructor(public a: number) {
        super();
    }
}

class E {
    private prop: number | undefined = this['parent']?.['prop'];

    constructor(private parent?: E) {}
}

class F {
    a: number;
    b = this['a'] = 1;
}
