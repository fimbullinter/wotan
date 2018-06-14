declare var index: {[key: string]: string};
declare var nullableIndex: {[key: string]: string | undefined};

/* delete */ delete index.foo;
delete index['bar'];
delete nullableIndex.foo;
delete nullableIndex['bar'];
delete index.delete;

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
delete obj[];

const keyA = 'a';
delete obj[keyA];
const keyB = 'b';
delete obj[keyB];
const keyBC = Boolean() ? 'b' : 'c';
delete obj[keyBC];
const keyAB = Boolean() ? 'a' : 'b';
delete obj[keyAB];

delete obj[obj.c];
delete obj[obj.c.d];

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
    0: string;
    '1': string;
    [index: number]: string;
    [Symbol.iterator]?(): Iterator<number>;
};
delete myArrayLike[0];
delete myArrayLike['0'];
delete myArrayLike[1];
delete myArrayLike['1'];
delete myArrayLike[2];
delete myArrayLike[Symbol.iterator];
