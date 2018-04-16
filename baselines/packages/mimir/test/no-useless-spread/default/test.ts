console.log('a', 'b', 1, 'c', ...arr, 'd');

console.log('a', 'b', 1, 'c', ...arr, 'd');

[a, b, , ...c] = arr;

let obj = {
  foo: 1,
  ...{ bar: 2, ...someObj },
  ~~~~~~~~~~~~~~~~~~~~~~~~~  [error no-useless-spread: Using the spread operator here is not necessary.]
  baz: 3,
  ...someOtherObject || { bas: 4 }
};

({foo, .../* comment */{bar, ...rest}} = obj);
       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~          [error no-useless-spread: Using the spread operator here is not necessary.]

obj = {
    ... // comment
    ~~~~~~~~~~~~~~
    {...obj}
~~~~~~~~~~~~ [error no-useless-spread: Using the spread operator here is not necessary.]
};

console.log();

// Need to ignore this case
let a = [...[,],];

// [,a] = [];
   [,a] = [];

// let a = [1,]
   let a = [1,];

// ({foo: 'foo',});
   ({...{foo: 'foo',},});
     ~~~~~~~~~~~~~~~~     [error no-useless-spread: Using the spread operator here is not necessary.]

// let a = [];
   let a = [];

// let a = [1, 2,];
   let a = [1, 2,];

// let a = [1, 2,];
   let a = [1, 2,];

// let a = [1, 2,];
   let a = [1, 2,];

// new Foo('foo',);
   new Foo('foo',);

// let a = [];
   let a = [];

// console.log();
   console.log();

const named = 'bar';
// don't fix object spread because of possible duplicate key errors
let myObj = {
    ...{foo: 1},
    ~~~~~~~~~~~  [error no-useless-spread: Using the spread operator here is not necessary.]
    bar: 1,
    ...{foo: 2, [named]: 2},
    ~~~~~~~~~~~~~~~~~~~~~~~  [error no-useless-spread: Using the spread operator here is not necessary.]
};
