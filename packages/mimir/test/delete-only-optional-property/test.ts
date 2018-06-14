declare var index: {[key: string]: string};
declare var nullableIndex: {[key: string]: string | undefined};

delete index.foo;
delete index['bar'];
delete nullableIndex.foo;
delete nullableIndex['bar'];

declare var obj: {
    a?: string;
    b: string | undefined;
    c: any;
    d: unknown;
};

delete obj.a;
delete obj['a'];
delete obj.b;
delete obj['b'];
delete obj.c;
delete obj.d;

const keyA = 'a';
delete obj[keyA];
const keyB = 'b';
delete obj[keyB];
const keyBC = Boolean() ? 'b' : 'c';
delete obj[keyBC];
const keyAB = Boolean() ? 'a' : 'b';
delete obj[keyAB];

declare var any: any;
delete any.foo;

declare var optional: Partial<typeof obj>;

delete optional.a;
delete optional.b;
delete optional.c;
delete optional.d;

delete [].length;
delete [][Symbol.iterator];

declare var myArrayLike: {
    [index: number]: string;
    [Symbol.iterator]?(): Iterator<number>;
};
delete myArrayLike[Symbol.iterator];
