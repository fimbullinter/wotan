# delete-only-optional-property

:mag: requires type information and `strictNullChecks` compiler option

Disallows `delete` of required properties.

## Rationale

TypeScript enforces required properties to be present when checking assignability.
However it allows `delete` on required properties, which will alter the object so that it no longer matches the declared type.
This mismatch will likely cause errors at runtime that cannot be detected at compile time.

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare var myObj: {prop: string, prop2?: string, prop3: string | undefined};
delete myObj.prop;
delete myObj['prop'];
delete myObj[Math.random() < 0.5 ? 'prop' : 'prop2']; // error because 'prop' is required
delete myObj.prop3; // error because 'prop3' is required even though it's nullable
```

:thumbsup: Examples of correct code

```ts
declare var myObj: {prop: string, prop2?: string, prop3?: string};
delete myObj.prop2;
delete myObj['prop2'];
delete myObj[Math.random() < 0.5 ? 'prop2' : 'prop3']; // both properties are optional

declare var myDict: Record<string, string>;
delete myDict.prop; // deleting properties on dictionary objects (index signatures) is allowed
```
