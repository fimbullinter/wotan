# no-useless-spread

:wrench: fixable

Disallows redundant array and object spread.

## Rationale

Spreading an object literal into another object is redundant. The properties can be added directly to the target object literal. The same goes for array spread.

TypeScript doesn't perform all possible checks on object literals containing spread. For example detecting duplicate keys is not possible. For that reason useless spreading should be avoided.

## Examples

:thumbsdown: Examples of incorrect code

```ts
let obj = {
  foo: 1,
  ...{
    bar: 2
  },
  baz: 3
};

let arr = [
  1,
  ...[2],
  3,
];

Math.max(...[1, 2]);
```

:thumbsup: Examples of correct code

```ts
let obj = {
  foo: 1,
  bar: 2,
  baz: 3
};
let clone = {
  ...obj;
}

let arr = [
  1,
  2,
  3,
  ...otherArray,
];

Math.max(1, ...arr, 2);
```

## Further Reading

* MDN: [Spread Syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax)
