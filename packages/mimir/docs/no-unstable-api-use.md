# no-unstable-api-use

:mag: requires type information

Disallows uses of `@deprecated` or `@experimental` variables, classes, properties, functions, signatures, ...

## Rationale

Experimental APIs may change or disappear in future versions without a heads up.

Deprecated APIs should no longer be used because they may be buggy, unmaintained, superseded by another API, marked for removal, etc. Depredated APIs are typically removed in a future major version.

## Examples

:thumbsdown: Examples of incorrect code

```ts
/** @deprecated */
var myVar = 1;

console.log(myVar); // use of deprecated variable

declare function doStuff(p: number): void;
/** @experimental */
declare function doStuff(): void;

doStuff(); // use of experimental call signature
```

:thumbsup: Examples of correct code

```ts
declare function doStuff(p: number): void;
/** @experimental */
declare function doStuff(): void;

doStuff(1); // this one is fine, only the signature without parameter is experimental
```

## Futher Reading

* [JSDoc `@deprecated`](http://usejsdoc.org/tags-deprecated.html)
* Wikipedia: [Deprecation](https://en.wikipedia.org/wiki/Deprecation)
