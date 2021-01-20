# no-object-spread-of-iterable

:mag: requires type information

Disallows spreading iterable types into an object.

## Rationale

Spreading an iterable type like `Array` via object spread gives an object with the same numeric properties as the original array, but it no longer behaves like an array. There's no `length` property and all methods are not available. Unfortunately TypeScript cannot correctly represent that. So it tells you that object spread of an array gives you an array.

Most of the time this is a typo, as you need to use array spread to copy an array (square brackets instead of curly brackets): `[...arr]` instead of `{...arr}`.

Another possible mistake is a naive attempt to copy complex types like `Map` or `Set` via object spread. This gives you an empty object at runtime, but once again TypeScript doesn't warn you about that.

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare const arr: Array<number>;
declare const set: Set<number>;
declare const map: Map<number>;

console.log({...arr}.reverse()); // will throw at runtime, because 'reverse' does not exist on the resulting object
console.log({...set}); // this is not how you copy Set
console.log({...map}); // this is not how you copy Map
```

:thumbsup: Examples of correct code

```ts
declare const arr: Array<number>;
declare const set: Set<number>;
declare const map: Map<number>;

console.log([...arr].reverse()); // works as expected with square brackets
console.log(new Set(set)); // this is how you copy Set
console.log([...set]); // creates a new Array from the values in the Set
console.log(new Map(map)); // this is not how you copy Map
console.log([...map]); // creates a new Array with tuples representing the Map's entries
```

## Further Reading

* MDN: [Spread Syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax)

## Related Rules

* [`no-duplicate-spread-property`](no-duplicate-spread-property.md)
* [`no-useless-spread`](no-useless-spread.md)
* [`prefer-object-spread`](prefer-object-spread.md)

