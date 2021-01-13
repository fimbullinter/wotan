class C {
    get foo() { return 1; }
    set foo(v) {}

    get bar() { return 1; }

    set baz(v: number) {}

    prop = 1;

    fn() {
        ++this.foo;
        ++this.bar;
        ++this.baz;
        ++this.prop;
        this.foo = 1;
        this.bar = 1;
        this.baz = 1;
        this.prop = 1;
        return this.foo + this.bar + this.baz + this.prop;
    }
}

class Other {
    foo = 1;
    bar = 1;
    baz = 1;
    prop = 1;
}

const v = Boolean() ? new C() : new Other();
v.foo + v.bar + v.baz + v.prop;
v['foo'] + v['bar'] + v['baz'] + v['prop'];

const opt = Boolean() ? new C() : undefined;
opt?.foo || opt?.bar || opt?.baz || opt?.prop;
opt?.['foo'] || opt?.['bar'] || opt?.['baz'] || opt?.['prop'];

let {foo, bar, baz, prop} = v;
({foo, bar, baz, prop} = v);
({'foo': foo, 'bar': bar, 'baz': baz, 'prop': prop} = v);
({['foo']: foo, ['bar']: bar, ['baz']: baz, ['prop']: prop} = v);

({ set foo(v: number) {}}).foo++;
({ set foo(v: number) {}, get foo() {return 1;}}).foo++;
({ set foo(v: number) {}}).foo = 1;

class Base {
    set foo(v: number) {}
}

class Derived extends Base {
    get foo() {return 1;}
}

new Base().foo++;
new Derived().foo++;
