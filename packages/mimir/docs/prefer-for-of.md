# prefer-for-of

:mag: requires type information

Prefer `for...of` loops over regular `for` loops where possible.

## Rationale

Using `for (const x of y) {}` more concise than the overly verbose `for (let i = 0; i < y.length: ++i) {const x = y[i]}`.
It avoids many mistakes like not incrementing the counter variable, modifying the counter within the loop body or accidentally writing to the array instead of reading.

Using the iteration protocol introduced in ES2015 `for...of` can iterate over all kinds of collections. It abstracts away the implementation details to access the next element and check if the end is reached. When done right, iterating over a linked list looks exactly the same as iterating over an array.

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare let arr: string[];

for (let i = 0; i < arr.length; ++i) {
  arr[i]
}
```

:thumbsup: Examples of correct code

```ts
declare let arr: number[];

for (let i = 0; i < arr.length; ++i) {} // iterating over an array without accessing an element is allowed

for (let i = arr.length - 1; i >= 0; --i) { // iterating in reverse order is not possible using for...of
  arr[i];
}

for (let i = 0; i < arr.length; ++i) {
  console.log(i, arr[i]); // counter variable is used for something else than accessing array element
}

for (let i = 0; i < arr.length; ++i) {
  arr[i]++; // array element is reassigned
}

let j = 0;
for (; j < arr.length; ++j) {} // counter is declared outside of the loop
```

## Further Reading

* MDN: [for...of](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of)
* MDN: [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols)
