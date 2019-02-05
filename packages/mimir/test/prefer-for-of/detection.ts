export {};

declare let arr: Array<any>;
declare let other: any[][];
declare let j: number;

for (var index = 0; index < arr.length; ++index) {
    arr[index];
}
arr[index]; // used outside loop body

for (let i = 0; i < arr.length; ++i) {
    arr[i]
}

for (let i = 0; i < arr.length; ++i)
    arr[i]

for (let i = 0; arr.length > i; i++) {
    arr[i]
}

for (let i = 0; i < arr.length; i += 1) {
    arr[i]
}

for (let i = 0; i < arr.length; i = i + 1) {
    arr[i]
}

for (let i = 0; i < arr.length; i = 1 + i) {
    arr[i]
}

for (let i = 0; i < other[0].length; ++i) {
    other[0][i]
}

// more than one variable declared
for (let i = 0, len = arr.length; i < len; ++i) {
    arr[i]
}

// wrong condition
for (let i = 0; i < arr[0]; ++i) {
    arr[i]
}

// index variable not used in condition
for (let i = 0; j < arr.length; ++i) {
    arr[i]
}

// step is 2 instead of 1
for (let i = 0; i < arr.length; i += 2) {
    arr[i]
}

// iteration doesn't start at 0
for (let i = 1; i < arr.length; ++i) {
    arr[i]
}

// index variable is not declared in loop header
for (j = 0; j < arr.length; ++j) {
    arr[j]
}

// wrong element access
for (let i = 0; i < arr.length; ++i) {
    arr[i]
    i['toString']
}

// accesses another array
for (let i = 0; i < arr.length; ++i) {
    arr[i]
    other[i]
}

// index variable used in differently
for (let i = 0; i < arr.length; ++i) {
    console.log(i);
    arr[i]
}

// no array access at all
for (let i = 0; i < arr.length; ++i) {
}

// array is modified
for (let i = 0; i < arr.length; ++i) {
    arr[i] = 0
}

// array is modified
for (let i = 0; i < arr.length; ++i) {
    delete arr[i]
}

// array is modified
for (let i = 0; i < arr.length; ++i) {
    for (arr[i] of other) ;
}

// no condition
for (let i = 0; ; ++i) {
    arr[i];
    break;
}

// no initializer
for (; j < arr.length; ++j) {
    arr[j];
}

// no incrementor
for (let i = 0; i < arr.length;) {
    arr[i]
    ++i;
}

declare function condition(i: number, len: number): boolean
// some other condition
for (let i = 0; condition(i, arr.length); ++i) {
    arr[i]
    ++i;
}

// other comparison
for (let i = 0; i != arr.length; ++i) {
    arr[i]
    ++i;
}

// wrong incrementor
for (let i = 0; i < arr.length; arr.shift()) {
    arr[i]
    ++i;
}

// wrong incrementor
for (let i = 0; i < arr.length; i <<= 1) {
    arr[i]
    ++i;
}
