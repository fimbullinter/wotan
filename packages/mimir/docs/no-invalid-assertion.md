# no-invalid-assertion

:mag: requires type information

Disallows asserting a literal to a different literal of the same widened type. This is also called "sidecasting".

## Rationale

Sidecasting can be the result of a typo or refactoring. Such cases can cause bugs that are not detected by TypeScript.

```ts
let v = 'foo' as 'boo'; // TypeScript doesn't detect this typo
```

It can also be the result of overly clever code that's hard to understand and maintain.

```ts
// allows TypeScript to infer the return type of 'someFunction' without actually executing it
let v = false as true && someFunction('foo');
```

As of TypeScript 3.4.0 the recommended way to disable widening is using `as const`.

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare let condition: boolean;

'foo' as 'boo';
(condition ? 'foo' : 'bar') as 'baz';
<true>false;
```

:thumbsup: Examples of correct code

```ts
declare let condition: boolean;

'foo' as string;
String() as 'foo';
'foo' as 'foo';
'foo' as 'foo' | 'bar';
'foo' as 'foo' | 1;
(condition ? 'foo' : 'bar') as 'foo';
<false>false;
false as boolean;

// the following examples are already type errors
1 as 'foo';
<{foo: 'foo'}>{foo: 'bar'};
```

## Related Rules

* [`no-useless-assertion`](no-useless-assertion.md)
