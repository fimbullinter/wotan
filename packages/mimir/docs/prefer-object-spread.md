# prefer-object-spread

:mag: requires type information
:wrench: fixable

Prefer object spread over `Object.assign` for copying properties to a new object.

## Rationale

ECMAScript 2018 added a way to syntactically express shallow copying of object properties. Before you would typically use `Object.assign` or a handwritten alternative.
TypeScript can check calls to `Object.assign` only for a limited number of arguments and cannot infer the correct return value. For object spread on the other hand it can infer (almost) the correct type and even check for duplicate properties.

Object spread provides additional safety as its behavior cannot be overridden, which is possible for `Object.assign`. Furthermore it avoids unintentionally modifying the first argument of `Object.assign` caused by some sort of refactoring.

Some JavaScript VMs may be able to further optimize object spread.

In addition the rule [`no-duplicate-spread-property`](no-duplciate-spread-property.md) provides additional checks to avoid duplicate properties or object spread whose properties are overridden by later properties or spread.

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare const someObj: Record<string, string>;

Object.assign({}, someObj);
Object.assign({}, {prop: 1});
Object.assign({prop: 1}, someObj);
```

:thumbsup: Examples of correct code

```ts
declare const someObj: Record<string, string>;

// fixed examples from above
({...someObj});
({prop: 1});
({prop: 1, ...someObj});

declare const someArr: Array<typeof someObj>;

Object.assign({}, ...someArr); // array spread cannot be expressed in object spread

Object.assign(someObj, {prop: 1}); // modifies the first argument

function copy<T>(obj: T) {
  return Object.assign({}, obj); // TypeScript currently doesn't support spreading type parameters
}
```

## Further Reading

* MDN: [Spread syntax / Spread in object literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax#Spread_in_object_literals)

## Related Rules

* [`no-duplicate-spread-property`](no-duplciate-spread-property.md)
* [`no-useless-spread`](no-useless-spread.md)
