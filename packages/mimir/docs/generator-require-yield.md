# generator-require-yield

Requires generator function to contain at least one `yield`.

## Rationale

The body of a generator function is not executed until the first call to the `next` method of it's iterator. A generator function without `yield` can be converted to a regular function to avoid this unnecessary complexity.

## Examples

:thumbsdown: Examples of incorrect code

```ts
function *generator() {
  doStuff();
}
```

:thumbsup: Examples of correct code

```ts
function *generator() {
  yield doStuff();
}

// no generator function
function regular() {
  doStuff();
}
```
