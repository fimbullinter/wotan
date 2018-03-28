let someGlobal: string;
var someOtherGlobal: number;

{
    let local: string;
    let otherLocal = 1;
    let initializedLater: boolean;
    initializedLater = true;
}

declare module "foo" {
    let foo: number;
    let bar: string;
    export {foo};
}
