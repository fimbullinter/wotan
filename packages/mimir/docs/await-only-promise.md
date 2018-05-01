# await-only-promise

:mag: requires type information :wrench: fixable

Disallows `await`ing a non-Promise value. Also disallows `for-await-of` looping over an Iterable instead of AsyncIterable value.

## Rationale

In theory you can `await` everything. Awaiting a [Promise or Thenable](https://promisesaplus.com/#terminology) will pause the execution of the current function and continue later with the resolved value of the promise.
Awaiting a non-Promise value will simply delay the execution by one tick and continue with the awaited value as-is. This adds unnecessary overhead that can simply be avoided.

## Examples

:thumbsdown: Examples of incorrect code

```ts
async function test() {
  await 10; // awaiting non-Promise values
  await '42';

  for await (const e of []) {} // iterating non-AsyncIterable
}
```

:thumbsup: Examples of correct code

```ts
async function test(iterable: AsyncIterable<number>, promise?: Promise<number>) {
  if (promise) {
    await promise; // awaiting `Promise`
  }
  await promise; // awaiting `Promise | undefined`

  for await (const e of iterable) {} // iterating `AsyncIterable`
}
```
