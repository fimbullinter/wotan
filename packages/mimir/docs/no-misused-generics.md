# no-misused-generics

Detects type parameters without inference site and type parameters that don't add type safety to the declaration. This rule checks all callable signatures (functions, methods, constructors, function types, etc.).

## Rationale

Adding type parameters to a signature adds a lot of complexity. It increases the cognitive load of API users as well as the work needed for TypeScript to infer and check these signatures.

Type parameters that are only used in the return type are actually type assertions in disguise and should be written as such.

Type parameters, that are only used once in the entire signature and don't have a constraint that contains another type parameter, are useless. They don't add type safety to the signature and can simply be replaced by their constraint or `any` if there is none.

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare function get<T>(): T; // disguised type assertion
type MyFunction = <T>(param: T) => number; // T is only used once
declare class MyClass<T> {
  method<U extends T>(param: U): number; // U is not constrained by a type parameter from the same signature
}
```

:thumbsup: Examples of correct code

```ts
type MyType<T> = any; // T is not used, but that's not the business of this rule

declare function get(): {} | null | undefined; // enforce type assertion at call site:
get() as string;

type Identity = <T>(param: T) => T; // T is used in more than one position
type Compare = <T>(param: T, param2: T) => boolean; // T is used in more than one position
declare class MyClass {
  method(param: T): number; // replaced type parameter with its constraint
  otherMethod<T, U extends T>(param: T, param2: U): number; // T is used more than once, U is constrained by T
}
```
