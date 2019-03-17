# try-catch-return-await

:mag: requires type information
:wrench: fixable

Enforces the use of `return await foo;` inside `try-catch` in async functions where `foo` is a `Promise`-like value.

## Rationale

In `try-catch` blocks returned promises should be `await`ed to correctly enter the `catch` clause on rejection and/or the `finally` block on completion of the promise.
By simply returning the promise, the `catch` clause is never executed and the `finally` block is executed immediately on `return` instead of on promise completion.

The rule [no-return-await](no-return-await.md) reports all cases where `return await` is not necessary.

## Examples

:thumbsdown: Examples of incorrect code

```ts
async function foo(bar: Promise<any>) {
  try {
    return bar;
  } catch (e) {
    console.log(e); // will never be executed
  }
}

async function foo(bar: Promise<any>) {
  try {
    return bar;
  } finally {
    console.log('done'); // is executed before promise completion
  }
}

async function foo(bar: Promise<any>) {
  try {
    throw new Error();
  } catch {
    return bar;
  } finally {
    console.log('done'); // is executed before promise completion
  }
}
```

:thumbsup: Examples of correct code

```ts
async function foo(bar: Promise<any>) {
  try {
    return await bar;
  } catch (e) {
    console.log(e);
    return bar; // this is valid because there is no 'finally' block
  }
}

async function foo(bar: Promise<any>) {
  try {
    return await  bar;
  } finally {
    console.log('done');
  }
}

async function foo(bar: Promise<any>) {
  try {
    throw new Error();
  } catch {
    return await bar; // necessary because there is a 'finally' block
  } finally {
    console.log('done');
  }
}
```

## Further Reading

* MDN: [async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)
* StackOverflow: [Difference between `return await promise` and `return promise`](https://stackoverflow.com/questions/38708550/difference-between-return-await-promise-and-return-promise)

## Related Rules

* [`async-function-assignability`](async-function-assignability.md)
* [`await-async-result`](await-async-result.md)
* [`await-only-promise`](await-only-promise.md)
* [`no-return-await`](no-return-await.md)
