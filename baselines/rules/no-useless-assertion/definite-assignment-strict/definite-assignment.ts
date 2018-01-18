export {};

let initialized!: boolean = true;

let foo!: number;
foo;

let uninitialized: boolean;
uninitialized!;

let bar: number | undefined;

const key = 'prop';
const key2 = 'prop2'
abstract class Foo {
    initialized!: boolean = true;
    foo!: number;
    bar: number | undefined;
    abstract baz!: number;
    'bas': number;
    ['foobar']!: number;
    ['foobaz']: number | undefined;
    [key]!: number;
    [key2]: number | undefined;
    uninitialized: number;

    constructor() {
        this.initialized;
        this.foo;
        this.uninitialized;
    }
}
