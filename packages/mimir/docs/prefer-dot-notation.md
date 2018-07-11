# prefer-dot-notation

:wrench: fixable

Enforces the use of `obj.foo` instead of `obj['foo']` where possible.

## Rationale

Property access (dot notation) for statically known properties is easier to read and write. TypeScript has stricter checks for property access. Minifiers can mangle names of properties more efficiently when they are only accessed using dot notation.

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare let obj: Record<string, string>;

obj['prop'];
obj['foo_bar'];

1['toString']();
```

:thumbsup: Examples of correct code

```ts
declare let obj: Record<string, string>;

obj.prop;
obj.foo_bar;

(1).toString();
1..toString(); // double dot is intentional to avoid parsing ambiguity
1.0.toString();

// dynamic element access
obj['prop' + Math.random()];
for (const key of obj) {
  console.log(obj[key]);
}

// names that are not allowed as property access, list is not exhaustive
obj[0];
obj['0']
obj['.'];
obj[''];
obj[','];
obj['a-b'];
```

## Further Reading

* MDN: [Property accessors](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Property_Accessors)
