# prefer-spread-arguments

:mag: requires type information and `strictBindCallApply` compiler option
:wrench: fixable

Prefer spread arguments over `Function.prototype.apply` to call variadic functions.

## Rationale

ECMAScript 2015 added a way to syntactically express variadic arguments in function calls. Before you had to use `Function.prototype.apply`.
Spread arguments provide additional safety as its behavior cannot be overridden, which is possible for `Fucntion.prototype.apply`. In addition there is no chance to accidentally call the function with the wrong `thisArg` (value of `this`).

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare const args: string[];

alert.apply(null, args);
alert.apply(undefined, args);
console.log.apply(console, args);
```

:thumbsup: Examples of correct code

```ts
declare const args: string[];

// fixed examples from above
alert(...args);
alert(...args);
console.log(...args);

// intentionally providing a different thisArg
declare const fn: (...args: any[]) => void;
fn.apply(global, args);

// calling a method named 'apply'
const obj = { apply(a: any, b: any) {}}
obj.apply(null, args);
```

## Further Reading

* MDN: [Spread syntax / Spread in function calls](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax#Spread_in_function_calls)

## Related Rules

* [`no-useless-spread`](no-useless-spread.md)
