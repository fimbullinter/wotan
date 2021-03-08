# no-nan-compare

Disallows comparing any value with `NaN`. You should use `isNaN(value)` or `Number.isNaN(value)` depending on your use case.

## Rationale

In JavaScript `NaN` is the only value that is not equal to itself:

```js
NaN === NaN; // false
NaN !== NaN; // true
```

Therefore you cannot detect if a variable has the value `NaN` by comparing with `NaN`. As seen before this will always be false.

The only (non-magic) way to test for `NaN` is the global function `isNaN`, which will convert its only argument to a number if necessary and then test for `NaN`.
ECMAScript 2015 added another method `Number.isNaN` that also tests for `NaN` but doesn't perform any conversion.

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare let v: number;

v === NaN;
NaN == v;
v != Number.NaN;

switch (v) {
  case NaN:
}
```

:thumbsup: Examples of correct code

```ts
declare let v: number;

isNaN(v);
!Number.isNaN(v);
```

## Further Reading

* MDN: [NaN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/NaN)

## Related Rules

* [`no-useless-predicate`](no-useless-predicate.md)
* [`prefer-number-methods`](prefer-number-methods.md)
