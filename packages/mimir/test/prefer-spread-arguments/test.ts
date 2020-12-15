export {};

declare const args: any[];

alert.apply(null, args);
alert.apply(undefined, args);
alert.apply(alert, args);
alert.apply(null, ...[args] as const);
alert.apply(...[null, args] as const);

declare const fn: ((...args: any[]) => void) | undefined;
fn!.apply(null, args);
fn?.apply(null, args);
(fn as (...args: any[]) => void).apply(null, args);

declare const obj: {apply(a: any, b: any): any};
obj.apply(null, args);

const nested = {obj};
nested.obj.apply(nested, args);

console.log.apply(null, args);
console.log.apply(console, args);
console.log.apply(console.log, args);
console.log.apply(obj, args);
console['log'].apply(console, args);
(console['log'])!.apply(console, args);
window.console.log.apply(window.console, args);
window.console.log.apply(window.console!, args);
window.console.log.apply(window['console'], args);
window['console'].log.apply(window.console, args);
window['console'].log.apply(window['console'], args);

declare let objArr: {fn: (...args: any[]) => void}[];
declare let i: number;
objArr[0].fn.apply(objArr[0], args);
objArr[0].fn.apply(objArr['0'], args);
objArr[0].fn.apply(objArr[1], args);
objArr[i].fn.apply(objArr[i], args);
objArr[objArr.length].fn.apply(objArr[objArr.length], args);
objArr[objArr.length].fn.apply(objArr[objArr['length']], args);
objArr[objArr.length - 1].fn.apply(objArr[objArr.length - 1], args);

objArr[Symbol.iterator].apply(objArr, args);

class C {
    #fn!: (...args: any[]) => void;
    #obj: {fn: (...args: any[]) => void};
    [key: string]: {fn: (...args: any[]) => void};
    constructor() {
        this.#fn.apply(this, args);
        this.#fn.apply(new C(), args);
        this.#fn.apply(null, args);
        this.#obj.fn.apply(this.#obj, args);
        this.#obj.fn.apply(this, args);

        this.#obj.fn.apply(this['#obj'], args);
        this.#obj.fn.apply(this['obj'], args);
        this['#obj'].fn.apply(this.#obj, args);
        this['#obj'].fn.apply(this['#obj'], args);
    }
}

class Base {
    fn(...args: any[]) {};
}

class Derived extends Base {
    fn() {
        super.fn.apply(this, args);
    }
}

fn.apply /* .apply() */(null /* .apply() */, args);
fn. //
  apply
(null, args);

fn.apply //
    (null, args);

fn.apply //
