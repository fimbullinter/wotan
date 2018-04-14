export class Hello {
   private world: string;
 constructor( world: string) {
this.world = world;}
}

export class Hello extends World {
   private world: string;
 constructor( world: string) {
        super();
this.world = world;
    }
}

export class Welcome {
   private home: string;
 constructor( home: string = 'mom!') {
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
