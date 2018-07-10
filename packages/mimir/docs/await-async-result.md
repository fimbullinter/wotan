# await-async-result

:mag: requires type information

Disallows not using the result of a call to an async function from within another async function.

## Rationale

When calling an async function you most likely want to wait for it to finish before continuing the execution of the calling function. If you discard the returned promise of an async function you will never be able to wait until it resolves. In addition you are not able to catch rejections.

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare function asyncFn(): Promise<void>;

async function test() {
  asyncFn(); // not awaiting call to async function
}
```

:thumbsup: Examples of correct code

```ts
declare function asyncFn(): Promise<void>;
declare function syncFn(): void;

async function test() {
  syncFn(); // calling a sync function
  await asnycFn(); // awaiting the promise
  let asyncAction = asyncFn(); // assigning the returned promise
  void asyncFn(); // discarding the return value using `void`
  return asyncFn(); // returning or otherwise using the return value
}

function test2() {
  asyncFn(); // call is not inside an async function
}
```

## Related Rules

* [`try-catch-return-await`](try-catch-return-await.md)
