# no-unassigned-variable

Disallows variables that are not initialized and never assigned a value.

## Rationale

Variables that never hold a value are useless. Unassigned variables have the value `undefined`. You don't need a variable that contains `undefined` for its entire existence, that's what the global `undefined` is for.

Unassigned variables are often a result of refactoring and most of the time this is a real bug. Eiter the assignment is missing or the variable and all of its uses can be removed.

TypeScript will not detect this if

* the variable is allowed to contain the value `undefined`
* the variable is only used in nested functions, callbacks, etc.

## :warning: Limitation

This rule cannot make sure that a variable is assigned to at runtime. It just detects if a variable **may** be initialized at runtime. For example a callback that assigns the variable may or may not be called.

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare function callMeLater(cb: () => void): void;

function foo() {
  let v: number;
  let v2: number | undefined;
  callMeLater(() => console.log(v));
  callMeLater(() => console.log(v2));
}
```

:thumbsup: Examples of correct code

```ts
declare function callMeLater(cb: () => void): void;

function foo() {
  let v: number; // assigned at the end of the function
  let v2: number | undefined = 2; // initialized
  let v3: number; // assigned in callback function
  callMeLater(() => console.log(v));
  callMeLater(() => console.log(v2));
  callMeLater(() => v3 = 3);
  v = 1;
}
```
