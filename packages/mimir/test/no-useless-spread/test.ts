console.log(...['a', ...['b', 1], 'c', ...arr], 'd');

console.log(...     ['a', ...  ['b', 1], 'c', ...arr], 'd');

[a, ...[b, , ...c]] = arr;

let obj = {
  foo: 1,
  ...{ bar: 2, ...someObj },
  baz: 3,
  ...someOtherObject || { bas: 4 }
};

({foo, .../* comment */{bar, ...rest}} = obj);

obj = {
    ... // comment
    {...obj}
};

console.log(/*.../*/...[]);

// Need to ignore this case
let a = [...[,],];

// [,a] = [];
   [...[,a]] = [];

// let a = [1,]
   let a = [...[1,],];

// ({foo: 'foo',});
   ({...{foo: 'foo',},});

// let a = [];
   let a = [...[],];

// let a = [1, 2,];
   let a = [1, ...[], 2,];

// let a = [1, 2,];
   let a = [1, 2, ...[]];

// let a = [1, 2,];
   let a = [1, 2, ...[],];

// new Foo('foo',);
   new Foo('foo', ...[],);

// let a = [];
   let a = [...[],];

// console.log();
   console.log(...[],);

const named = 'bar';
// don't fix object spread because of possible duplicate key errors
let myObj = {
    ...{foo: 1},
    bar: 1,
    ...{foo: 2, [named]: 2},
};
