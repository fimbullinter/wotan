# no-uninferred-type-parameter

:mag: requires type information

Detects type parameters that are inferred as `{}` (empty object type) because the compiler cannot infer a type.

## Rationale

If TypeScript is not able to infer a type parameter, that's often because the declartion is wrong or the type parameter is not necessary at all (see [no-misused-generics](no-misused-generics.md)).

Sometimes the TypeScript cannot infer the correct base type due to its inference rules. In that case you need to help by providing type arguments. Otherwise you lose type information and safety.

## :warning: Limitations

The rule is not able to differentiate between type parameters with failed inference and type parameters that are really inferred as `{}`. You can see that in the examples below.

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare function optionalParam<T>(param?: T): T | undefined;
declare function restParam<T>(...args: T[]): T[];

optionalParam(); // T is inferred as {} if no argument is provided
restParam(1, 'foo'); // no base type found, T is inferred as {}

declare let v: {};
optionalParam(v); // T is inferred as {}, but that's expected behavior
```

:thumbsup: Examples of correct code

```ts
declare function optionalParam<T>(param?: T): T | undefined;
declare function restParam<T>(...args: T[]): T[];

optionalParam<never>(); // providing type arguments
optionalParam('foo'); // providing argument enables correct inference, T is inferred as string

restParam<number | string>(1, 'foo'); // providing type arguments
restParam(1, 10); // arguments have compatible types, T is inferred as number

declare let v: {};
optionalParam<{}>(v); // type argument need to be provided to satisfy the rule, because T would be inferred as {}
```

## Further Reading

* TypeScript Handbook: [Generics](https://www.typescriptlang.org/docs/handbook/generics.html)

## Related Rules

* [`no-misused-generics`](no-misused-generics.md)
