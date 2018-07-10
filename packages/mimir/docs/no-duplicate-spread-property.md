# no-duplicate-spread-property

:mag: requires type information

Detects properties that are always overridden in object literals containing object spread.

## Requirements

This rule requires the compiler option `strictNullChecks` to be enabled and TypeScript 2.5 or newer.

## Rationale

If you override the property anyway you don't need to declare it in the first place.
As of writing the compiler doesn't detect this at all.

## :warning: Limitations

Object spread only copies **own enumerable** properties of an object. TypeScript doesn't know about [enumerability and ownership of properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Enumerability_and_ownership_of_properties). Therefore this rule may give some false-positives, for example when prototype methods are involved.

To avoid a common false-positive with class methods, this rule
treats all class methods as nonexistent. This is what TypeScript does internally during inference of object spread.

## Examples

:thumbsdown: Examples of incorrect code

```ts
let obj = {
  foo: 'foo', // is always overridden
  ...{foo: 'bar', bar: 'bar'},
};

obj = {
  ...{foo: 'foo', bar: 'bar'}, // all properties of this object are overridden
  foo: 0,
  bar: 1,
}
```

:thumbsup: Examples of correct code

```ts
let obj = {
  foo: 'foo',
  ...{boo: 'bar', bar: 'bar'},
};

obj = {
  ...{foo: 'foo', bar: 'bar'}, // 'bar' is not overridden
  foo: 0,
  baz: 1,
}
```

## Related Rules

* [`prefer-object-spread`](prefer-object-spread.md)
* [`no-useless-spread`](no-useless-spread.md)
