# no-useless-assertion

:mag: requires type information
:wrench: fixable

Disallows type assertions that don't change the type or are not necessary in the first place.

Note that this rule marks all non-null assertions and definite assignment assertions as useless unless `strictNullChecks` (and `strictPropertyInitialization` for definite assignment assertion class properties) is enabled.

## Rationale

If a type assertion doesn't change the type of an expression, it just adds visual clutter. Even worse: type assertions hinder type inference.

In general you should try to infer types instead of asserting them.

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare function takeString(param: string): void;
declare function takeStringOrUndefined(param?: string): void;
declare let str: string;
declare let optionalStr: string | undefined;

takeString(<string>str); // 'str' is already of type 'string'
takeString(str!); // non-null assertion is useless because 'str' is not nullable

takeStringOrUndefined(optionalStr!); // non-null assertion is unnecessary because the function accepts 'string | undefined'
takeStringOrUndefined(optionalStr as string); // same as above with type assertion syntax

let foo!: number | undefined; // definite assignment assertion is unnecessary as the type includes 'undefined'

let bar!: number;
bar!; // non-null assertion is unnecessary as 'bar' is definitely assigned

class C {
  'prop'!: number; // definite assignment assertion is unnecessary as TypeScript doesn't check quoted property names
}

let tuple = [1 as const] as const; // inner 'const' assertion is redundant
```

:thumbsup: Examples of correct code

```ts
declare function takeString(param: string): void;
declare let optionalStr: string | undefined;

takeString(<string>optionalStr);
takeString(optionalStr!);

let foo!: number;

let bar: number;
console.log(bar!); // non-null assertion suppresses 'Variable "bar" is used before being assigned.' error

class C {
  prop!: number;
}
```

## Related Rules

* [`no-invalid-assertion`](no-invalid-assertion.md)
* [`type-assertion`](type-assertion.md)
