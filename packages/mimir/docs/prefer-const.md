# prefer-const

:wrench: fixable
:nut_and_bolt: configurable

Enforces the use of `const` for variables that are never reassigned.

## Rationale

Using `const` can significantly improve type inference and type checking by TypeScript. JavaScript runtimes are able to optimize and potentially inline constants.

## Examples

:thumbsdown: Examples of incorrect code

```ts
function fn() {
  let foo = 1, bar = 2; // error on 'foo' even though 'bar' is reassigned
  var baz = 3; // error on 'baz' as it's never reassigned

  bar = 4;
}

for (let element of []) { // 'element' is never reassigned
}
```

:thumbsup: Examples of correct code

```ts
// global script, variables could be changed from everywhere
let foo = 1;
var bar = 2;
```

```ts
export {}; // make this as ES2015 module
const foo = 1;
const bar = 2;
let baz = 3; // reassigned later
baz = 4;
let bas: number; // no initializer

for (let i = 0, max = 10; i < max; ++i) { // special handling of for-loops: because 'i' is reassigned 'max' has no error
  console.log(i);
}
```

## Configuration

This rule allows configuration on how it treats destructuring where one variable can be `const` while at least one other variable of the same destructuring is not a constant.

```ts
let {a, b} = {a: 1, b: 2}; // 'a' is never reassigned, 'b' is reassigned
b = 3;
```

Because splitting destructuring into multiple declarations is not always possible the default configuration is the more permissive `all` option.

### destructuring: all (default)

Ignore destructuring where at least one variable is not a constant.

```yaml
rules:
  prefer-const: error
```

Or

```yaml
rules:
  prefer-const:
    options:
      destructuring: all
```

:thumbsdown: Examples of incorrect code with this option enabled

```ts
let {a, b} = {a: 1, b: 2}; // 'a' and 'b' are never reassigned
```

:thumbsup: Examples of correct code with this option enabled

```ts
let {a, b} = {a: 1, b: 2}; // 'b' is reassigned, therefore 'a' is ignored
b = 3;
```

### destructuring: any

Add failures for any destructuring variable that can be `const` even if other variables are reassigned.

```yaml
rules:
  prefer-const:
    options:
      destructuring: any
```

:thumbsdown: Examples of incorrect code with this option enabled

```ts
let {a, b} = {a: 1, b: 2}; // 'a' and 'b' are never reassigned
var {c, d} = {c: 3, d: 4}; // 'c' is never reassigned
d = 5;
```

:thumbsup: Examples of correct code with this option enabled

```ts
const {a, b} = {a: 1, b: 2}; // 'a' and 'b' are never reassigned
```

## Further Reading

* MDN: [const](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const)
* Mozilla Hacks: [Destructuring](https://hacks.mozilla.org/2015/05/es6-in-depth-destructuring/)
