declare function decorator(...args: any[]): any;
declare const BaseTypeWithoutDeclarations: new () => {};
declare const BaseTypeWithoutSymbol: new () => object;

class Private {
    private prop = 1;
    other = this['prop'];
    private ['private'] = 2;

    method() {
        this['prop'];
    }

    static fn(a: Private) {
        a['prop'];
    }
}
function testPrivate(this: Private) {
    new Private()['prop'];
    const privateKey = 'private';
    let {['prop']: prop, [privateKey]: priv} = new Private();
    ({['prop']: prop, [privateKey]: priv} = new Private());
    const key = Boolean() ? 'prop' : 'other';
    const {[key]: value} = new Private();
}
class DerivedPrivate extends Private {
    p2 = this['prop'];
    constructor() {
        super();
        const {['prop']: prop} = this;
        const {a: {['prop']: {}}} = {a: this};
    }
}

new Private()['prop'];
new Private()[];
new Private()['pr' + 'op'];

declare var optionalPrivate: Private | undefined;
optionalPrivate?.['prop'];

declare var optionalPrivateProp: undefined | {o: Private};
optionalPrivateProp?.o['prop'];

class Protected {
    protected prop = 1;
    other = this['prop'];

    method(other: OtherProtected) {
        this['prop'];
        other['prop'];
        Protected['fn'](null!);
        DerivedProtected['fn'](null!);
    }

    protected static fn(a: Private) {
        return a['prop'];
    }
}
function testProtected(this: Protected) {
    Protected['fn'](null!);
    new Protected()['prop'];
    enum E {
        bar = new Protected()['prop'],
    }
    @decorator(new Protected()['prop'])
    class Inner extends (new Protected()['prop'] ? Object : Object) {
        bar = new Protected()['prop'];
        @decorator(new Protected()['prop'])
        [new Protected()['prop']](@decorator(new Protected()['prop']) param: string) {}
    }
}
new Protected()['prop'];

function testGeneric<T>(this: T) {
    new Protected()['prop'];
}
function testConstrainedGeneric<T extends Protected>(this: T) {
    new Protected()['prop'];
}
function testIntersection(this: Protected & {something: any}) {
    new Protected()['prop'];
}
function testFunction() {
    new Protected()['prop'];
}
function testUntypedThis(this) {
    new Protected()['prop'];
}

function testGenericAccess<T extends 'prop' | 'private'>(key: T) {
    new Private()[key];
}

class DerivedProtected extends Protected {
    p2 = this['prop'] + Protected['fn'](null!);
}
function testDerivedProtected(this: DerivedProtected) {
    new DerivedProtected()['prop'];
    new Protected()['prop'];
}

interface I { something(): void }
class DerivedProtectedWithImplements extends Protected implements I {
    something() {
        this['prop'];
        new Protected()['fn'](null!);
    }
}

class Unrelated {}
function testUnrelated(this: Unrelated) {
    new Protected()['prop'];
}

class WithoutDeclarations extends BaseTypeWithoutDeclarations {
    prop = new Protected()['prop'];
}

class WithoutSymbol extends BaseTypeWithoutSymbol {
    prop = new Protected()['prop'];
}

function mixin<T extends new (...args: any[]) => object>(p: T) {
    return class extends p {
        constructor(...args: any[]) {
            super(...args);
            new Protected()['prop'];
        }
    }
}

function mixin2<T extends new (...args: any[]) => Protected>(p: T) {
    return class extends p {
        protected fromMixin = 1;
        constructor(...args: any[]) {
            super(...args);
            this['prop'];
            new Protected()['prop'];
            Protected['fn'](null!);
        }
    };
}

const MixedIn = mixin2(Protected);
new MixedIn()['fromMixin'];

class ExtendsMixin extends MixedIn {
    fn() {
        this['fromMixin'];
        new MixedIn()['fromMixin'];
    }
}

new class {
    private foo = 1;
}()['foo'];

const Foo = class {
    private foo = 1;
}
new Foo()['foo'];

class OtherProtected extends Protected {
    protected prop = 1;
    doStuff(instance: Protected & OtherProtected) {
        instance['prop'];
    }
}

class YetAnotherProtected {
    protected prop = 1;
    doStuff(a: Protected & YetAnotherProtected, b: YetAnotherProtected & Protected) {
        a['prop'];
        b['prop'];
    }
}

abstract class Abstract {
    abstract get getter(): number;
    abstract prop: number;
    abstract getProp(): number;
    other = this['prop'] + this['getProp']() + this['getter'];
    yetAnother = decorator(this['prop']);
    constructor(other: Abstract) {
        this['prop'];
        this['getProp']();
        other['prop'];
        this['getter'];
        () => this['prop'];
        (this)['prop']; // should be an error, but TypeScript doesn't unwrap parens either
    }
    method() {
        this['prop'];
    }
    fn = () => this['prop'];
}
class DerivedAbstract extends Abstract {
    prop = 1;
    getter = 2;
    other = this['prop'] + this['getProp']() + super['getProp']() + super['prop'] + super['getter'] + this['getter'];
    constructor(other: Abstract) {
        super(other);
        other['prop'];
        this['prop'];
        this['getProp']();
        super['getProp']();
        super['prop'];
    }

    getProp() {
        return this['prop'];
    }
    m() {
        return new class extends DerivedAbstract {
            other = super['getProp']() + super['prop'];
        }(this);
    }
}

abstract class DerivedAbstractAbstract extends Abstract {
    other = this['prop'] + this['getProp']() + super['getProp']() + this['getter'] + super['getter'];

    constructor(other: Abstract) {
        super(other);
    }
}

abstract class EvenMoreDerivedAbstract extends DerivedAbstractAbstract {
    other = super['getProp']();
}

class A {
    protected prop = 1;

    method(a: A, b: B, c: C) {
        a['prop'];
        b['prop'];
        c['prop'];
    }
}

class B extends A {
    method(a: A, b: B, c: C) {
        a['prop'];
        b['prop'];
        c['prop'];
    }
}

class C extends B {
    method(a: A, b: B, c: C) {
        a['prop'];
        b['prop'];
        c['prop'];
    }
}

function fnA(this: A, a: A, b: B, c: C) {
    a['prop'];
    b['prop'];
    c['prop'];
}
function fnB(this: B, a: A, b: B, c: C) {
    a['prop'];
    b['prop'];
    c['prop'];
}
function fnC(this: B, a: A, b: B, c: C) {
    a['prop'];
    b['prop'];
    c['prop'];
}

type Constructor<T = {}> = new (...args: any[]) => T;

function Mixin<TBase extends Constructor>(Base: TBase) {
    abstract class C extends Base {
        abstract method(): number;
    }
    return C;
}

class MixinSubclass extends Mixin(class {a() {return 1;}}) {
    method() {
        return super['method']();
    }
}

class MixinSubclass2 extends Mixin(class {method() {return 1;}}) {
    prop = this['method']();
    other() {
        return super['method']();
    }
}

declare var tuple: [string, string];
tuple['length']; // don't crash

class WithMethod {
    method() { return 1; }
}
abstract class WithAbstractMethod {
    abstract method(): number;
}
declare const Base: new() => WithMethod & WithAbstractMethod;
class IntersectionSubclass extends Base {
    doStuff() {
        return super['method']();
    }
}

namespace testStatic {
    class Base {
        static prop = 1;
        static method() {return 1;}
        static get accessor() {return 1;}

        v = 1;
    }
    namespace Base {
        export var v = 1;
    }

    class Other {}

    class Derived extends Base {
        static fn() {
            return super['prop'] + super['method']() + super['accessor'] + super['v'];
        }

        static nestedClass() {
            @decorator(super['v'])
            class C extends Other {
                @decorator(super['v'])
                static [super['v']](@decorator(super['v']) param: string) {}

                @decorator(super['v'])
                [super['v']](@decorator(super['v']) param: string) {}
            }
        }

        nestedClass() {
            @decorator(super['v'])
            class C extends Other {
                @decorator(super['v'])
                static [super['v']](@decorator(super['v']) param: string) {}

                @decorator(super['v'])
                [super['v']](@decorator(super['v']) param: string) {}
            }
        }
    }
}

class MyClass extends Object {
    toString() {
        return super['toString']();
    }
}

null!['prop'];
