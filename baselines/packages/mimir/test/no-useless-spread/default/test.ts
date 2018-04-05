console.log('a', 'b', 1, 'c', ...arr, 'd');

console.log('a', 'b', 1, 'c', ...arr, 'd');

[a, b, , ...c] = arr;

let obj = {
  foo: 1,
   bar: 2, ...someObj ,
  baz: 3,
  ...someOtherObject || { bas: 4 }
};

({foo, bar, ...rest} = obj);

obj = {
    ...obj
};

console.log(/*.../*/);

// Need to ignore this case
let a = [...[,],];

// But not this one. Should fix to [,a] = []
[,a] = [];

// Should fix to [1,]
let a = [1,];

// Should fix to ({foo: 'foo',})
({foo: 'foo',});

// Should fix to []
let a = []

// Should fix to [1, 2,]
let a = [1, 2,]

// Should fix to [1, 2,]
let a = [1, 2,]

// Should fix to [1, 2,]
let a = [1, 2,]
