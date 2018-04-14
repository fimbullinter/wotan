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
