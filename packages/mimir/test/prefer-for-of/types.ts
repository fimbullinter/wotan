export {};

declare let array: Array<any>;

for (let i = 0; i < array.length; ++i) {
    array[i]
}

declare let readonlyArray: ReadonlyArray<any>;

for (let i = 0; i < readonlyArray.length; ++i) {
    readonlyArray[i]
}

interface MyArray<T = any> extends Array<T> {
    prop: T;
}
declare let myArray: MyArray;

for (let i = 0; i < myArray.length; ++i) {
    myArray[i]
}

declare let myArray2: MyArray<string>;

for (let i = 0; i < myArray2.length; ++i) {
    myArray2[i]
}

interface ArrayLike {
    [index: number]: number;
    length: number;
}

declare let arrayLike: ArrayLike;

for (let i = 0; i < arrayLike.length; ++i) {
    arrayLike[i]
}

declare let typedArray: Uint16Array;

for (let i = 0; i < typedArray.length; ++i) {
    typedArray[i]
}

declare let anyValue: any;

for (let i = 0; i < anyValue.length; ++i) {
    anyValue[i]
}

function test<T extends any[]>(param: T) {
    for (let i = 0; i < param.length; ++i) {
        param[i]
    }
}

for (let i = 0; i < "foo".length; ++i) {
    "foo"[i]
}
