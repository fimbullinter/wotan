# await-async-result

:mag: requires type information

Disallows uses of global DOM variables that are actually properties of the `window` global object.

## Rationale

It's a common mistake to reference the global variable `name` or `event` when there is a local variable with a similar name.
Referencing these globals is most likely not intended. It may even result in a runtime error because not every JS environment (e.g. Node.js) defines these variables.

## Examples

:thumbsdown: Examples of incorrect code

```ts
addEventListener('click', (evt) => { // this is actually `window.addEventListener`
  console.log(event); // references the global variable instead of the parameter
});
console.log(name); // references the global variable `name`
```

:thumbsup: Examples of correct code

```ts
window.addEventListener('click', (evt) => {
  console.log(evt);
});
console.log(window.name);
```
