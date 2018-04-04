console.log(...['a', ...['b', 1], 'c', ...arr], 'd');

console.log(...     ['a', ...  ['b', 1], 'c', ...arr], 'd');

[a, ...[b, , ...c]] = arr;

let obj = {
  foo: 1,
  ...{ bar: 2, ...someObj },
  baz: 3,
  ...someOtherObject || { bas: 4 }
};

({foo, ...{bar, ...rest}} = obj);
