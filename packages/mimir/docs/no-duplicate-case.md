# no-duplicate-case

:mag_right: works better with type information

Detects identical `case` clauses within a single `switch` statement.

Without type information the clauses are compared for syntactic equality.
With type information this rule additionally detects clauses that definitely have the same value at runtime.

## Rationale

Duplicate `case` clauses are dead code. Only the first matching clause is reachable.

## Examples

:thumbsdown: Examples of incorrect code

```ts
switch (v) {
  case 1:
  case +'1': // same as above
  case true:
  case !false: // same as above
  case 'foo':
  case "foo": // same as above
  case `foo`: // same as above
  case someVariable:
  case someVariable: // same as above
}
```

:thumbsup: Examples of correct code

```ts
switch (v) {
  case 1:
  case true:
  case false:
  case 'foo':
  case 'bar':
  case (condition ? 'bar' : 'baz'):
  case someVariable:
  case someOtherVariable:
}
```

## Related Rules

* [`no-case-declaration`](no-case-declaration.md)
* [`no-fallthrough`](no-fallthrough.md)
