class Private {
    private prop = 1;
    other = this['prop'];

    method() {
        this['prop'];
    }

    static fn(a: Private) {
        a['prop'];
    }
}
function testPrivate(this: Private) {
    new Private()['prop'];
}
class DerivedPrivate extends Private {
    p2 = this['prop'];
}

new Private()['prop'];

class Protected {
    protected prop = 1;
    other = this['prop'];

    method(other: OtherProtected) {
        this['prop'];
        other['prop'];
    }

    static fn(a: Private) {
        a['prop'];
    }
}
function testProtected(this: Protected) {
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

class DerivedProtected extends Protected {
    p2 = this['prop'];
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
}

abstract class Abstract {
    abstract prop: number;
    abstract getProp(): number;
    other = this['prop'] + this['getProp']();
    yetAnother = decorator(this['prop']);
    constructor(other: Abstract) {
        this['prop'];
        this['getProp']();
        other['prop'];
        () => this['prop'];
    }
    method() {
        this['prop'];
    }
    fn = () => this['prop'];
}
class DerivedAbstract extends Abstract {
    prop = 1;
    other = this['prop'] + this['getProp']() + super['getProp']() + super['prop'];
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
    other = this['prop'] + this['getProp']() + super['getProp']();

    constructor(other: Abstract) {
        super(other);
    }
}

abstract class EvenMoreDerivedAbstract extends DerivedAbstractAbstract {
    other = super['getProp']();
}

declare function decorator(...args: any[]): any;
