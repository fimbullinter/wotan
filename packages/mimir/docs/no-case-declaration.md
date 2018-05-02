# no-case-declaration

Requires adding a block when a `case` or `default` clause contains a `let`, `class` or `enum` declaration.

## Rationale

Block scoped variables are not only visible inside the declaring clause but also in all other clauses. But the declared value is not usable in all other clauses as these are part of the [temporal dead zone](http://jsrocks.org/2015/01/temporal-dead-zone-tdz-demystified).

The TypeScript compiler does not reliably generate errors for all invalid uses:

* Variables declared with `let` can be assigned which results in a ReferenceError at runtime.
* `class` declartions have no restrictions at all which results in a ReferenceError at runtime.
* `enum` declarations have no restrictions at all. `enum`s are transpiled as function scoped variables. Therefore you may or may not be initialized depending on the order of statement execution.
* `var` is always function scoped and has no temporal dead zone.
* `const` is already handled correctly with an error `Variable 'xxx' is used before being assigned.`

You should always use a block to restrict the scope of the declarations to avoid accidental use in the temporal dead zone.

## Examples

:thumbsdown: Examples of incorrect code

```ts
switch (v) {
  case 1:
    let foo = v;
    break;
  default:
    class C {}
}
```

:thumbsup: Examples of correct code

```ts
let foo: number;
switch (v) {
  case 1:
    foo = v; // variable declared outside of switch
    break;
  case 2: {
    class C {} // declaraton inside a block
    break;
  }
  case 3:
    for (let v of []) {} // declaration nested in another block scope
  default:
    // the following declarations are always allowed
    const bar = v;
    var baz = v;
    interface I {}
    type T = I;
    function bas() {}
}
```
