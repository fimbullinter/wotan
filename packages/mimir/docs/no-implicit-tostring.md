# no-implicit-tostring

:mag: requires type information
:nut_and_bolt: configurable

Disallows implicit conversion of non-string values to string.

## Rationale

Values are implicitly converted to string when they are concatenated with a string or used as interpolations of a template string. In both cases every type except `symbol` is allowed.
This rule helps you detect cases where potentially unwanted string represenations like `null`, `undefined` or `[object Object]` could end up in your strings.
If you intend to stringify a certain value, consider making it explicit by using `v.toString()` or `String(v)`.

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare const v: object;
console.log('config: ' + v); // stringifying objects most likely gives '[object OBject]'. to print the contents, consider using '.toJSON()'
console.log(`config: ${v}`); // same as above just with different syntax

'foo' + console.log(); // concatenating a string with 'void' is most likely a mistake
console.log('random: ' + Math.random); // forgot to call the function
console.log('async result:' + Promise.resolve('foo')); // forgot to await Promise
```

:thumbsup: Examples of correct code

```ts
declare const v: object;
declare function tag(...args: any[]): any;
tag`${v}`; // tagged template literals are always allowed by this rule

'foo' + 'bar'; // concatenating strings is always allowed
'foo' + String(v); // explicit coercion is allowed
'foo' + v.toString();
```

## Configuration

This rule's configuration can be used to allow implicit coercion of certain non-string types. `any` and `never` are always allowed. `symbol` is not checked, because the compiler already does that.

### allowBoolean: boolean = false

Allows boolean values to be converted to string.

```yaml
rules:
  no-unused-expression:
    options:
      allowBoolean: true
```

:thumbsup: Examples of correct code with this option enabled

```ts
console.log('true: ' + true);
console.log('false: ' + false);
```

### allowBigInt: boolean = false

Allows bigint values to be converted to string.

```yaml
rules:
  no-unused-expression:
    options:
      allowBigInt: true
```

:thumbsup: Examples of correct code with this option enabled

```ts
console.log('value: ' + 1n);
```

### allowNull: boolean = false

Allows null values to be converted to string.

```yaml
rules:
  no-unused-expression:
    options:
      allowNull: true
```

:thumbsup: Examples of correct code with this option enabled

```ts
declare const v: string | null;
console.log('value: ' + v);
```

### allowNumber: boolean = false

Allows number values to be converted to string.

```yaml
rules:
  no-unused-expression:
    options:
      allowNumber: true
```

:thumbsup: Examples of correct code with this option enabled

```ts
declare const v: string | number;
console.log('value: ' + v);
console.log('value: ' + 1);
```

### allowUndefined: boolean = false

Allows undefined values to be converted to string.

```yaml
rules:
  no-unused-expression:
    options:
      allowUndefined: true
```

:thumbsup: Examples of correct code with this option enabled

```ts
declare const v: string | undefined;
console.log('value: ' + v);
```

### allowPrimitive: boolean = false

This option includes all of the other options above, so it allows number, bigint, boolean, null and undefined.

```yaml
rules:
  no-unused-expression:
    options:
      allowPrimitive: true
```

:thumbsup: Examples of correct code with this option enabled

```ts
declare const v: string | null | undefined | bigint | number | boolean;
console.log('value: ' + v);
```
