# no-unsafe-finally

Disallows control flow statements `return`, `throw`, `break` and `continue` inside the `finally` block of a try statement.

## Rationale

`finally` is always executed, no matter how the `try` and `catch` block complete.

There are two types of completion:

* normal: by implicit return
* abrupt: by `return`, `throw`, `break` or `continue`

After executing the `try` and/or `catch` block but before returning the actual completion execution jumps to the `finally` block. After executing the `finally` block execution continues with returning the original completion value.

Now if you have any statement in your `finally` block, that changes the completion value, you have overridden the previous completion. This is confusing and unexpected to say the least.

## Examples

:thumbsdown: Examples of incorrect code

```ts
function foo() {
  try {
    return 1;
  } catch {
    return 2;
  } finally {
    // this return value overrides all other return values
    // the return value is always 3
    return 3;
  }
}

/**
 * This function is expected to execute `doStuff` for each element of `arr`
 * and stop at the first exception.
 * Instead it continues even after encountering an exception.
 */
function foo(arr: Array<any>) {
  for (const v of arr) {
    try {
      doStuff(v);
    } catch {
      // stop at the first failing element
      break;
    } finally {
      // overrides the completio from 'break' to 'continue'
      continue;
    }
  }
}
```

:thumbsup: Examples of correct code

```ts
function foo() {
  try {
    return mightThrow();
  } finally {
    while (true) {
      if (condition)
        break; // this only breaks out of the 'while' and not the 'finally'
    }
  }
}
```

## Further Reading

* MDN: [try...catch](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch)
* MDN: [Control flow](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling)
