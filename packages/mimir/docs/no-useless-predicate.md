# no-useless-predicate

:mag: requires type information

Detects redundant conditions that are either always true or always false.

## Rationale

This rule consists of 3 distinct checks to detect conditions that are always truthy or always falsy:

1. Expressions used as condition are checked for being always truthy or always falsy. TypeScript doesn't even try to detect if a condition always results in the same branch being chosen. This check detects when you forget to call a method or await a Promise, for example `if (checkAuthentication) {}` instead of `if (checkAuthentication()) {}`. Not using `strictNullChecks` makes this check almost useless.
2. Comparing non-nullable values with `null` or `undefined`. TypeScript already detects invalid comparisons. However, it always allows comparing with `null` or `undefined` even if the type indicates that such a value can never occur. This check is disabled without `strictNullChecks`.
3. Comparing `typeof v` with a type that can never occur. TypeScript only ensures you compare with a valid type.

## :warning: Limitations

Types like `{}` or `{toString(): string}` could contain primitive values. Due to a lack of type relationship APIs this rule is currently unable to detect these cases and assumes such types to be always truthy and `typeof` to return `"object"`.

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare function returnTrue(): true;

while (returnTrue()) {} // condition is always truthy
!returnTrue() ? 'false' : 'true'; // condition is always falsy

declare function checkCondition(): boolean;

if (checkCondition) {} // condition is always truthy, forgot to call the function?

declare function isAuthenticated(): Promise<boolean>;

if (isAuthenticated()) {} // condition is always truthy, forgot to 'await' the Promise

declare var v: string | null;

v === undefined; // always falsy
typeof v === 'number'; // always falsy
```

:thumbsup: Examples of correct code

```ts
while (true) {} // infinite loops with 'true' as condition are always allowed

declare function checkCondition(): boolean;

if (checkCondition()) {} // can be truthy or falsy

declare function isAuthenticated(): Promise<boolean>;

async function fn() {
  if (await isAuthenticated()) {} // 'await' your Promises
}

declare var v: string | null;

v === null;
v == undefined; // '== undefined' also includes 'null'
typeof v === 'object'; // typeof null === 'object'
```

## Further Reading

* MDN: [typeof](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof)
* MDN: [truthy](https://developer.mozilla.org/en-US/docs/Glossary/Truthy) and [falsy](https://developer.mozilla.org/en-US/docs/Glossary/Falsy)

## Related Rules

* [`no-nan-compare`](no-nan-compare.md)
