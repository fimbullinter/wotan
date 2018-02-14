import * as m from 'non-existent-module';
let foo: string;
foo = 1;
console.clog(foo);

let bar: Array<Map<number, [boolean, string]>>;
let baz = foo;

function fn(param?: Array<Map<number, [number, string]>>): boolean {
    return param[0];
    return true;
}

function fn2(param1: string, param2): string {
    fn(bar);
}

fn2();
