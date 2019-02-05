import mdefault, {m} from 'non-existent-module';
let foo: string;
foo = 1;
console.clog(foo);
console.log(mdefault);

let bar: Array<Map<number, [boolean, string]>>;
let baz = foo;

function fn(param: Array<Map<number, [number, string]>>): boolean {
    return param[0];
    fn
}

function fn2(param1: string, param2): string {
    fn(bar);
}

fn2();

export function usesPrivateName() {
    class Foo {}
    return new Foo();
}
