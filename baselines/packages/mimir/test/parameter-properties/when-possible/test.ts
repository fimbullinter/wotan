export class Hello {
    constructor(private world: string) {}
}

export class Hello extends World {
    constructor(private world: string) {
        super();
    }
}

export class Welcome {
    constructor(private home: string = 'mom!') {}
}

export class Hello {
    
    constructor(public hello: string = 'mom!') {
        
    }
}

export class Hello extends World {
    
    constructor(public hello: string = 'mom!') {
        super();
        
    }
}

/* Tests for multiple access modifiers */
export class Hello extends World {
    
    constructor(private readonly hello: string = 'mom!') {
        super();
        
    }
}

export class Hello extends World {
    constructor(private readonly hello: string = 'mom!') {
        super();
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
    
    constructor(private bar: string, private fizz: boolean) {
        
    }
}

class Foo {
    private bar: string;
    constructor(bar: string, private fizz: boolean) {
        this.bar = bar + 'fizz';
        this.bar = bar;
    }
}

class Foo {
    private bar: string;
    constructor(bar: string, private fizz?: boolean) {
        this.bar = bar + 'fizz';
        this.bar = bar;
    }
}

/* Need to ignore directives */
class Foo extends Bar {
    private bar: string;
    constructor(bar: string, private fizz?: boolean) {
        'use strict';
        super();
        this.bar = bar + 'fizz';
        this.bar = bar;
    }
}

class Foo extends Bar {
    
    constructor(private bar: string, private fizz?: boolean) {
        'use strict';
        super();
        
    }
}

class Foo {
    
    constructor(private bar: string, private fizz?: boolean) {
        'use strict';
        
    }
}