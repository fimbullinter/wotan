# no-return-await

:wrench: fixable

Disallows unnecesary `return await foo;` when you can simply `return foo;`.

## Rationale

In async functions the return value is wrapped in a `Promise` object if it's not already a `Promise`. By `await`ing the returned `Promise` it is unwrapped just to be wrapped in a new `Promise` object immediately.

Not only does this waste CPU cycles, it also adds a delay as the  execution of the `Promise`' callbacks is scheduled on a task queue.

## :warning: Edge Case

Inside `try-catch` statements you might actually want to `await` returned `Promise`s. If you don't `await` a rejected `Promise`, there is no exception that could be handled by the `catch` and/or `finally` clause.

This rule therefore leaves the following cases alone:

```ts
async function foo(bar: Promise<any>) {
  try {
    return await bar; // await may be necessary
  } catch {
    return await bar; // await may be necessary if there is a finally clause
  } finally {
    return await bar; // await is not necessary
  }
}
```

The rule [try-catch-return-await](try-catch-return-await.md) can be used to enforce `return await` for `Promise`-like values in the relevant position of a `try-catch`.

## Examples

:thumbsdown: Examples of incorrect code

```ts
async function foo(bar: Promise<any>) {
  return await bar;
}

async function foo(bar?: Promise<any>) {
  return bar && await bar;
}
```

:thumbsup: Examples of correct code

```ts
async function foo(bar: Promise<any>) {
  return bar;
}

async function foo(bar: Promise<any>) {
  await bar;
  return;
}

async function foo(bar: Promise<any>) {
  const result = await bar;
  return result;
}

async function foo(bar: Promise<any>) {
  try {
    await bar;
  } catch { }
}
```

## Further Reading

* MDN: [async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)
* StackOverflow: [Difference between `return await promise` and `return promise`](https://stackoverflow.com/questions/38708550/difference-between-return-await-promise-and-return-promise)

## Related Rules

* [await-only-promise](await-only-promise.md)
* [try-catch-return-await](try-catch-return-await.md)
