# no-writeonly-property-read

:mag: requires type information

Disallows read access to properties that only have a `set` accessor.

## Rationale

TypeScript only distinguishes between readonly and read-writeable properties. Properties that only have a `get` accessor are correctly recognized as being readonly. Properties that only have a `set` accessor are considered read- and writeable. Reading such a property is not a compile-time or runtime error. Instead this simply gives `undefined`, which might cause issues later on.
There are certain cases where it's useful to only declare a `set` accessor to execute some side-effect. For example some Angular components use `@Input()` on `set` accessors to execute some code when a property binding changes. Reading the value of that property within the component is certainly an error.

## Examples

:thumbsdown: Examples of incorrect code

```ts
class C {
  set prop(v: number) {
    console.log(v);
  }

  method() {
    console.log(this.prop); // accessing 'this.prop' always gives 'undefined'
    ++this.prop; // '++' first reads the value of the property before assigning the incremented value
  }
}

const {prop} = new C(); // destructuring reads the value of the property, which is always 'undefined'

const obj = {set prop(v: number) {}};
console.log(obj.prop); // the same applies to regular objects
```

:eyes: Limitations

```ts
function useProp(param: {prop: string}) {
  console.log(param.prop);
}

// 'useProp' expects an object with a readable 'prop' member
// this rule cannot detect that the object contains a writeonly property
useProp({set prop(v: number) {}});
```

:thumbsup: Examples of correct code

```ts
class C {
  set prop(v: number) {
    console.log(v);
  }

  constructor() {
    this.prop = 1; // assigning to a writeonly property is valid
  }
}
```

## Further Reading

* MDN: [setter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/set)

## Related Rules

* [`no-restricted-property-access`](no-restricted-property-access.md)
