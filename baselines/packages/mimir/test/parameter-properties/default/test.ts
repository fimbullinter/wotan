export class Hello {
    private world: string;
constructor(world: string) {
this.world = world;}
}

export class Hello extends World {
    private world: string;
constructor(world: string) {
        super();
this.world = world;
    }
}

export class Welcome {
    private home: string;
constructor(home: string = 'mom!') {
this.home = home;}
}

export class Hello {
    public hello: string;
    constructor(hello: string = 'mom!') {
        this.hello = hello;
    }
}

export class Hello extends World {
    public hello: string;
    constructor(hello: string = 'mom!') {
        super();
        this.hello = hello;
    }
}

/* Tests for multiple access modifiers */
export class Hello extends World {
    private readonly hello: string;
    constructor(hello: string = 'mom!') {
        super();
        this.hello = hello;
    }
}

export class Hello extends World {
    private readonly hello: string;
constructor(hello: string = 'mom!') {
        super();
this.hello = hello;
    }
}

class Foo {
    fizz: string;
    constructor(fizz: string) {
        this.fizz = fizz + ' buzz';
    }
}

class Foo extends Bar {
    fizz: string;
    constructor(fizz: string) {
        super();
        this.fizz = fizz + ' buzz';
    }
}

/* when-possible config should ignore this case because param is not the first thing to be assigned to the prop */
class Foo {
    fizz: string;
    constructor(fizz: string) {
        this.fizz = 'buzz';
        this.fizz = fizz;
    }
}

class Foo {
    constructor() {}
}

class Foo {
    constructor() { 'use strict'; }
}

class Foo {
    private bar: string;
    private fizz: boolean;
constructor(bar: string,fizz: boolean) {
this.fizz = fizz;
        this.bar = bar;
    }
}

class Foo {
    private bar: string;
    private fizz: boolean;
constructor(bar: string,fizz: boolean) {
this.fizz = fizz;
        this.bar = bar + 'fizz';
        this.bar = bar;
    }
}

class Foo {
    private bar: string;
    private fizz?: boolean;
constructor(bar: string,fizz?: boolean) {
this.fizz = fizz;
        this.bar = bar + 'fizz';
        this.bar = bar;
    }
}

/* Need to ignore directives */
class Foo extends Bar {
    private bar: string;
    private fizz?: string;
constructor(bar: string,fizz?: string) {
        'use strict';
        super();
this.fizz = fizz;
        this.bar = bar + 'fizz';
        this.bar = bar;
    }
}

class Foo extends Bar {
    private bar: string;
    private fizz?: string;
constructor(bar,fizz?: string) {
        'use strict';
        super();
this.fizz = fizz;
        this.bar = bar;
    }
}

class Foo {
    private bar: string;
    private fizz?: boolean;
constructor(bar: string,fizz?: boolean) {
        'use strict';
this.fizz = fizz;
        this.bar = bar;
    }
}

/* When-possible ought to ignore this case */
export class AngularComponent {
    @Input() public data: any;
    constructor(data: any) {
        this.data = data;
    }
}

export class AngularComponent {
    @Input() public data: any;
    private foo: string;
constructor(data: any,foo: string) {
this.foo = foo;
        this.data = data;
    }
}

/* If rest params exist and mode is 'consistent,' all other params should be made into longhand props */
class RestParamClass {
    private a: string;
    public b: number;
constructor(a: string,b: number, ...c) {
this.b = b;
        this.a = a;
    }
}

/* never mode should leave the decorator but copy the rest of the param to the class body */
class Car {
    public engine: Engine;
constructor(@Inject("MyEngine") engine: Engine) {
this.engine = engine;}
}

class Car {
    public engine: Engine;
constructor(@Inject("MyEngine") engine: Engine = { engineType: 'V8' }) {
this.engine = engine;}
}

class Car {
    public engine: Engine;
    constructor(@Inject("MyEngine") engine: Engine = { engineType: 'V8' }) {
        this.engine = engine;
    }
}
