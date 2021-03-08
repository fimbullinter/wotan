# return-never-call

:mag: requires type information

Enforces `return`ing or `throw`ing the result of a function or method call that returns `never`.

## Rationale

Functions that return `never`, or in other words never return to the control flow of the caller, make the following statements unreachable. TypeScript as of v3.7 can detect some explicitly typed `never`-returning calls and use them for control flow analysis. However, this is very limited to avoid circularities of type information affecting control flow and control flow affecting type information. Therefore you need to help TypeScript by explicitly using `return` or `throw` in some cases. That won't change runtime behavior, but allows for better control flow and type checking.

## Examples

:thumbsdown: Examples of incorrect code

```ts
const neverReturns = () => { throw new Error() }; // this syntax is not recognized by TypeScript's control flow analysis

function fn() {
  neverReturns(); // use 'return' or 'throw' here
  console.log('impossible'); // statement is unreachable but no tool complains
}

neverReturns(); // no 'return' possible here, use 'throw' instead
```

:thumbsup: Examples of correct code

```ts
const neverReturns = () => { throw new Error() };

function fn() {
  return neverReturns();
}

throw neverReturns();

function returnNever(): never { throw new Error(); }
returnNever(); // TypeScript correctly handles this
```

## Further Reading

* TypeScript Deep Dive: [Never](https://basarat.gitbooks.io/typescript/content/docs/types/never.html)
* TypeScript Pull Request: [Assertions in control flow analysis](https://github.com/microsoft/TypeScript/pull/32695) describes the limitations

## Related Rules

* [`no-unreachable-code`](no-unreachable-code.md)
* [`no-fallthrough`](no-fallthrough.md)
