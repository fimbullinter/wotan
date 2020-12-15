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
    class Inner {
        bar = new Protected()['prop'];
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

class Unrelated {}
function testUnrelated(this: Unrelated) {
    new Protected()['prop'];
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
        const {['prop']: prop, ['getter']: getter} = this; // TODO this could be an error
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

declare function decorator(...args: any[]): any;

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
