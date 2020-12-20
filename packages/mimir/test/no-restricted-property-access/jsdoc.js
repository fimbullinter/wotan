export class C {
    /** @public */
    a = 1;
    /** @protected */
    b = 1;
    /** @private */
    c = 1;

    fn() {
        this['a'];
        this['b'];
        this['c'];
    }
}

new C()['a'];
new C()['b'];
new C()['c'];
