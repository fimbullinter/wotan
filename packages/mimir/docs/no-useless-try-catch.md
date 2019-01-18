# no-useless-try-catch

:wrench: fixable

Detects `try` statements or parts thereof that can be removed.

## Rationale

There are several reasons you should avoid `try` statements that are not really necessary:

* `try` was considered an optimization-killer for a long time. Although they no longer prevent all optimizations, they are still not very optimizable.
* Pausing your debugger on uncaught exceptions doesn't always stop at the origin of the error, but instead at the location that error is (re)thrown the last time.
* Effects of control flow statements in `finally` clauses may be surprising, see [`no-unsafe-finally`](no-unsafe-finally.md).
* In an `async` function there's a difference between `return await foo;` and `return foo;` inside `try` statements, see [`try-catch-return-await`](try-catch-return-await.md).
* TypeScript's control flow analysis doesn't work very well with `try` statements.

Therefore this rule detects the following cases of unnecessary `try` statements:

* An empty `try` block causes only statements in the `finally` clause to be executed (if present).
* A `catch` clause that only rethrows the error can be removed.
* An empty `finally` clause can be removed.

## Examples

:thumbsdown: Examples of incorrect code

```ts
try {
  // empty 'try' block
} catch (e) {
  console.log(e);
}

try {
  mightThrow();
} catch (e) {
  throw e; // 'catch' clause only rethrows error
}

try {
  mightThrow();
} finally {
  // empty 'finally' clause
}
```

:thumbsup: Examples of correct code

```ts
try {
  mightThrow();
} catch {
  // empty 'catch' clause is used to ignore errors
}

try {
  mightThrow();
} catch (e) {
  console.log(e); // 'catch' clause does more than simply rethrowing the error
  throw e;
}

try {
  mightThrow();
} finally {
  console.log('done'); // 'finally' clause is not empty
}
```

## Further Reading

* MDN: [try...catch](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch)

## Related Rules

* [`no-unsafe-finally`](no-unsafe-finally.md)
* [`try-catch-return-await`](try-catch-return-await.md)
