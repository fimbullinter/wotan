# prefer-number-methods

:mag: requires type information
:wrench: fixable

Prefer ES2015's `Number.isNaN` and `Number.isFinite` over the global `isNaN` and `isFinite`.

## Rationale

ECMAScript 2015 introduced `Number.isNaN` and `Number.isFinite` as replacement for their global counterparts. Those new methods don't do any implicit conversion and expect their argument to be of type number. Implicit conversion is considered a bad practice.
In addition eliminating the conversion allows for better performance.

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare var n: Number;

isNaN(n);
isFinite(n);
```

:thumbsup: Examples of correct code

```ts
declare var n: Number;

Number.isNaN(n);
Number.isFinite(n);

isNaN('foo'); // argument is not of type number
```

## Further Reading

* MDN: [Number.isFinite](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite)
* MDN: [Number.isNaN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN)
