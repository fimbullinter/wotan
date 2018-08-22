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
abstract class A {
  abstract prop: string;
  other = this['prop']; // accessing abstract property during initialization of the class
  abstract method(): void;
}
abstract class B extends A {
  other = this['prop']; // accessing abstract property during initialization of a subclass if there is no implementation for that property
  method() {
    super['method'](); // accessing abstract method of superclass
    super['prop']; // accessing non-method properties via 'super'
  }
}

class C {
  private priv = 1;
  protected prot = 1;
}
new C()['priv']; // accessing private member outside of class body
new C()['prot']; // accessing protected member outside of class body

class D extends C {
  doStuff(other: C) {
    this['priv']; // accessing private member outside of the declaring class' body
    other['prot']; // accessing a protected member declared in a base class on an instance that is not instanceof the containing class
  }
}

class Public {
  public prop = 1;
}
class Private {
  private prop = 1;
}
function doStuff(instance: Public & Private) {
  instance['prop']; // property has conflicting visibility modifiers
  const {['prop']: prop} = instance; // all of the above checks also apply to destructuring
}
```

:thumbsup: Examples of correct code

```ts
abstract class A {
  abstract prop: string;
  other = () => this['prop']; // property is not accessed immediately
}
class B extends A {
  prop = '';
  other = this['prop']; // class contains an implementation for 'prop'
}

class C {
  protected prop = 1;
}
class D extends C {}
function explicitThis(this: C) {
  new C()['prop']; // functions with explicit 'this' are treated as they were in the class body when checking protected member access
  new D()['prop']; // accessing protected member on an object that is instanceof the containing class
}
```

## Further Reading

* TypeScript Handbook: [Classes](https://www.typescriptlang.org/docs/handbook/classes.html)
