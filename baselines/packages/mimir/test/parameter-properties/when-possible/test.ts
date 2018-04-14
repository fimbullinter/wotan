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
