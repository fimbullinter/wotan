# no-unused-expression

:nut_and_bolt: configurable

Disallows side-effect free expressions whose value is not used.

## Rationale

Even though expressions without any effect on program state are totally valid, they are likely the result of a programming mistake like forgetting to call a function or assigning a variable.

## :warning: Limitations

"Side-effect free" means there are no obvious side effects like calling a function or assigning a variable.

Property access might have side effects if the property is a get accessor.

```ts
const obj = {
  get prop() {
    console.log('I have side effects!');
  }
};

obj.prop; // lint error here
```

In the above example the rule cannot detect that `obj.prop` actually has side effects. It will show a lint error like this was a regular property.

## Examples

:thumbsdown: Examples of incorrect code

```ts
class C {}
function fn() {
  new C(); // class instance is not used, this one is configurable as it may have side effects
  'use strict'; // directives need to precede other statements
};
let v = 1;

v + 1; // did you mean 'v += 1'?
fn; // did you mean 'fn()'?

for (let i = 0; i < 10; +i) {} // did you mean '++i'?

switch (v) {
  case 1, 2: // 1 is unused, you need to write 'case 1: case 2:' instead
}
```

:thumbsup: Examples of correct code

```ts
class C {}
function fn() {
  'use strict';
  return new C();
};
let v = 1;

v += 1;
fn();

for (let i = 0; i < 10; ++i) {} // did you mean '++i'?

switch (v) {
  case 1:
  case 2:
}
```

## Configuration

### allowNew: boolean = false

Consider every constructor call to have side effects.

```yaml
rules:
  no-unused-expression:
    options:
      allowNew: true
```

:thumbsup: Examples of correct code with this option enabled

```ts
declare class C {};

// not using the class instance is now allowed, because the constructor might have side effects
new C();
```

### allowShortCircuit: boolean = false

Allow short circuiting logical operators.

```yaml
rules:
  no-unused-expression:
    options:
      allowShortCircuit: true
```

:thumbsup: Examples of correct code with this option enabled

```ts
declare var maybeFn: (() => void) | undefined;

maybeFn && maybeFn();

maybeFn || (maybeFn = () => {});
```

### allowTaggedTemplate: boolean = false

Consider every tagged template to have side effects.

```yaml
rules:
  no-unused-expression:
    options:
      allowTaggedTemplate: true
```

:thumbsup: Examples of correct code with this option enabled

```ts
declare function tag(parts: TemplateStringsArray, ...values: any[]): void;

// 'tag' might have side effects
tag``;
tag`${1}`;
```

### allowTernary: boolean = false

Allows ternary (conditional) expressions whose result is unused.

```yaml
rules:
  no-unused-expression:
    options:
      allowTernary: true
```

:thumbsup: Examples of correct code with this option enabled

```ts
declare let condition: boolean;
declare function toStuff(p: any): any;

condition ? doStuff('foo') : doStuff('bar');
```
