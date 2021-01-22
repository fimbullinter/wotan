# no-useless-spread

:wrench: fixable

Disallows redundant array and object spread.

## Rationale

Spreading an object literal into another object is redundant. The properties can be added directly to the target object literal. The same goes for array spread.

TypeScript doesn't perform all possible checks on object literals containing spread. For example detecting duplicate keys is not possible. For that reason useless spreading should be avoided.

## Examples

:thumbsdown: Examples of incorrect code

```tsx
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

<div {...{id: 'foo'}}></div>
```

:thumbsup: Examples of correct code

```tsx
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

<div
  id="foo"
  {...{[computedKey]: 1}}
  {...{'not a valid jsx property name': true}}
></div>
```

## Further Reading

* MDN: [Spread Syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax)

## Related Rules

* [`no-duplicate-spread-property`](no-duplicate-spread-property.md)
* [`no-object-spread-of-iterable`](no-object-spread-of-iterable.md)
* [`prefer-object-spread`](prefer-object-spread.md)
