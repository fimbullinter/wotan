# async-function-assignability

:mag: requires type information

Diallows assinging a `Promise`-returning function to a `void`-returning type.

## Rationale

TypeScript allows functions with any return type to be assigned to a function type with a `void` return type.
That's especially a problem with `Promise`-returning functions as the caller of the function doesn't expect a returned value and therefore doesn't await the Promise.
Depending on the runtime there might be an error if a rejected promise is not handled or there may be some hard to debug race condition.

## Examples

:thumbsdown: Examples of incorrect code

```ts
// these functions don't care about the return value of the callbacks
[1, 2, 3].forEach(async (v) => doStuff(v));
setTimeout(async () => doStuff(), 100);

class C {
  foo() {}
}
class D extends C {
  async foo() {} // overriding 'void'-returning method with 'Promise'-returning method
}
```

## Related Rules

* [`await-async-result`](await-async-result.md)
* [`await-only-promise`](await-only-promise.md)
* [`no-return-await`](no-return-await.md)
* [`try-catch-return-await`](try-catch-return-await.md)
