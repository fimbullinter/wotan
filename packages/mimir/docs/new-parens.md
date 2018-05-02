# new-parens

:wrench: fixable

Requires parentheses when invoking costructors.

## Rationale

When invoking constructors without arguments you can omit the parentheses. In addition TypeScript requires parentheses when passing type arguments.
In order to make constructor calls more explicit and easier to recognise you should always use parentheses.

## Examples

:thumbsdown: Examples of incorrect code

```ts
new Set;
new Set<number>; // this is already a compiler error
```

:thumbsup: Examples of correct code

```ts
new Set();
new Set<number>();
```
