# no-restricted-property-access

:mag: requires type information :wrench: fixable

Disallows accessing properties via computed name that would not be accessible using a static name.

## Rationale

TypeScript comes with a lot of checks to determine whether a property is accessible. You can for example limit the visibility of a property using `private` and `protected`. TypeScript will then only allow accessing that property inside the class body (`private`) or in any subclass (`protected`). Unfortunately this only works for property access (`obj.prop`). It does not check element access using computed names (`obj['prop']`) as an escape hatch from the strict type system.

Some properties require element access because their name is not a valid identifier (`obj['my-key']`). In this case TypeScript will not warn you about accessing a property you might not be allowed to access.
This rule implements the same checks as TypeScript but only for computed names which are intentionally excluded by TypeScript.

The following errors are detected:

* accessing members with multiple declarations of conflicting visibility
* accessing properties using `super`
* accessing `abstract` methods using `super`
* accessing `abstract` properties during initialization of a class with no implementation for that property
* accessing `private` and `protected` members outside of their visibility
* accessing `protected` members on an instance of a super-class within a derived class

All of these checks are related to classes, so you won't need this rule if you don't use classes at all.

## Examples

:thumbsdown: Examples of incorrect code

```ts
```

:thumbsup: Examples of correct code

```ts
```

## Further Reading

* TypeScript Handbook: [Classes](https://www.typescriptlang.org/docs/handbook/classes.html)
