# prefer-namespace-keyword

:wrench: fixable

Prefer `namespace foo {}` over `module foo {}` to avoid confusion with ECMAScript modules.

## Rationale

Before ES2015 specified ECMAScript modules, TypeScript had a concept called "internal modules" to organize your code in a modular fashion.
To avoid confusion with ECMAScript modules that feature was renamed to "namespaces". The old `module` keyword still works though to maintain backwards compatibility.

## Examples

:thumbsdown: Examples of incorrect code

```ts
module foo {}
```

:thumbsup: Examples of correct code

```ts
namespace foo {}
```

## Further Reading

* TypeScript Handbook: [Namespaces](https://www.typescriptlang.org/docs/handbook/namespaces.html)
* TypeScript Handbook: [Namespaces and Modules](https://www.typescriptlang.org/docs/handbook/namespaces-and-modules.html)
