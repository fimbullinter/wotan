# no-debugger

:wrench: fixable

Bans `debugger;` statements from your code.

## Rationale

`debugger;` statements are often used to debug during development. In production code these statements annoy users with devtools open or disturb debugging some other program that uses your library.

## Examples

:thumbsdown: Examples of incorrect code

```ts
debugger;

if (process.env.NODE_ENV === 'development') {
  debugger;
}
```
