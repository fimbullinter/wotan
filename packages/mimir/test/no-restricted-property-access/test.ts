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

    method() {
        this['prop'];
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

declare function decorator(...args: any[]): any;
