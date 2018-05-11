# no-unused-label

:wrench: fixable

Disallows labels that are never used.

## Rationale

Unused labels are likely the result of some refactoring that made these labels unnecessary.

## Examples

:thumbsdown: Examples of incorrect code

```ts
// label 'outer' is never used
outer: while (true) {
  // label 'inner' is never used
  inner: for (;;) {
    break;
  }
  break;
}
```

:thumbsup: Examples of correct code

```ts
outer: while (true) {
  for (;;) {
    if (condition) {
      break outer;
    }
  }
}
```
