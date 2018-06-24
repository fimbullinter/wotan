# no-useless-initializer

:wrench: fixable

Disallows `continue label;` and `break label;` where the label is not necessary.

## Rationale

Jump labels are typically used to jump to or out of a control flow statement other than the enclosing one.
It may cause confusion ff the target of the jump is the same with and without the label.
Often times this is a leftover from refactoring.

## Examples

:thumbsdown: Examples of incorrect code

```ts
foo: bar: while (true) {
  if (condition)
    continue foo;
  break bar;
}
```

:thumbsup: Examples of correct code

```ts
while (true) {
  if (condition)
    continue;
  break;
}

outer: while (true) {
  switch (v) {
    case true:
      break outer;
  }
}

blockLabel: {
  if (condition)
    break blockLabel;
}
```

## Further Reading

* MDN: [Labeled Statement](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/label)
* MDN: [Destructuring assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment)
