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

const v = 1;
/** @class */
function Legacy() {
    /** @private @type {number}*/
    this.a;
    /** @protected */
    this.b = 1;
}
/** @private */
Legacy.static = 1;
Legacy.prototype = {
    /** @private */
    fn() {
        /** @private */
        this.other = 1;
        /** @private */
        this['yetAnother'] = 1;
    },
    /** @private */
    prop: 1,
    /** @private */
    v,
}

Legacy['static'];
new Legacy()[Boolean() ? 'a' : 'b'];
new Legacy()['fn']();
new Legacy()['prop'];
new Legacy()['v'];
new Legacy()['other'];
new Legacy()['yetAnother'];

class D {
    method() {
        /** @private */
        this.x = 1;
    }
    constructor() {
        /** @private @type {number} */
        this.a;
        /** @protected */
        this.b = 2;
        /** @protected */
        this['c'] = 3;
        /** @private */
        Object.defineProperty(this, 'd', {value: 4});
    }
}

/** @private */
D.prototype.fn = function() {};
/** @private */
D['prototype']['otherFn'] = function() {};
/** @private */
Object.defineProperty(D.prototype, 'other', {get: () => 1});
/** @private */
Object.defineProperty(D, 'other', {get: () => 1});

D['other'];
new D()['fn']();
new D()['otherFn']();
new D()['a'];
new D()['b'];
new D()['c'];
new D()['d'];
new D()['x'];
new D()['other'];
