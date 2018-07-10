# return-never-call

:mag: requires type information

Enforces `return`ing or `throw`ing the result of a function of method call that returns `never`.

## Rationale

Functions that return `never`, or in other words never return to the control flow of the caller, make the following statements unreachable. TypeScript cannot use type information for control flow analysis and reachability checks. Therefore you need to help TypeScript by explicitly using `return` or `throw`. That won't change runtime behavior, but allows for better control flow and type checking.

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare function neverReturns(): never;

function fn() {
  neverReturns(); // use 'return' or 'throw' here
  console.log('impossible'); // statement is unreachable but no tool complains
}

neverReturns(); // no 'return' possible here, use 'throw' instead
```

:thumbsup: Examples of correct code

```ts
declare function neverReturns(): never;

function fn() {
  return neverReturns();
}

throw neverReturns();
```

## Further Reading

* TypeScript Deep Dive: [Never](https://basarat.gitbooks.io/typescript/content/docs/types/never.html)

## Related Rules

* [`no-unreachable-code`](no-unreachable-code.md)
