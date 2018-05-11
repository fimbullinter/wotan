# no-useless-declare

:wrench: fixable

Disallows the `declare` keyword on statements without runtime value. That includes `type` aliases, `interface` declartions and `const enum` declarations (only outside of declaration files).

## Rationale

`declare` is used to tell the compiler about a value that will be available at runtime. Adding the `declare` keyword to type only declarations doesn't change their meaning. It can therefore safely be removed.

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare interface Foo {}
declare type T = Foo;
declare const enum E {}
```

:thumbsup: Examples of correct code

```ts
declare class C {}
declare enum E {}

interface Foo {}
type T = Foo;
const enum E2 {}
```
