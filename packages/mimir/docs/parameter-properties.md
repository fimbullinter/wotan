# parameter-properties

:wrench: fixable
:nut_and_bolt: configurable
:x: not enabled in `recommended` preset

Enforces or disallows the use of parameter properties.

## Rationale

Parameter properties avoid boilerplate code by combining the parameter declartion and the property declaration in just one declartion. The assignment is implicitly added by the compiler. This avoid redundant code and possibly mismatching types of property and parameter. It does, however, make the properties difficult to spot. In addition this is not an official JavaScript feature but purely syntax sugar provided by the TypeScript compiler.

For above reasons most developers either love or hate parameter properties. Either way you should enforce consistency within your project.

## Configuration

This rule comes in 3 flavours that can be configured using the `mode` option:

* `never`: completely ban parameter properties
* `consistent`: if all parameters of a given constructor can be parameter properties, enforce that they are, otherwise ban parameter properties from that constructor
* `when-possible` (default): enforces the use of parameter properties where it's possible without changing the semantics of the code

### mode: never

Completely ban parameter properties.

```yaml
rules:
  parameter-properties:
    options:
      mode: never
```

:thumbsdown: Examples of incorrect code with this mode

```ts
class C {
  constructor(public prop: string) {}
}
```

:thumbsup: Examples of correct code with this mode

```ts
class C {
  public prop: string;
  constructor(prop: string) {
    this.prop = prop;
  }
}
```

### mode: consistent

If all parameters of a given constructor can be parameter properties, enforce that they are, otherwise ban parameter properties from that constructor.

```yaml
rules:
  parameter-properties:
    options:
      mode: consistent
```

:thumbsdown: Examples of incorrect code with this mode

```ts
class C {
  constructor(public prop: string, param: boolean) {} // parameter properties are forbidden, because only one parameter can be a parameter property
}

class D {
  public prop: string;
  constructor(prop: string, private param: boolean) { // parameter 'prop' can be converted to parameter property
    this.prop = string;
  }
}
```

:thumbsup: Examples of correct code with this mode

```ts
class C {
  public prop: string;
  constructor(prop: string, param: boolean) {
    this.prop = prop;
  }
}

class D {
  constructor(public prop: string, private param: boolean) {}
}
```

### mode: when-possible (default)

Enforces the use of parameter properties where it's possible without changing the semantics of the code.

```yaml
rules:
  parameter-properties: error
```

Or

```yaml
rules:
  parameter-properties:
    options:
      mode: when-possible
```

:thumbsdown: Examples of incorrect code with this mode

```ts
class C {
  public prop: string;
  constructor(prop: string) {
    this.prop = prop;
  }
}
```

:thumbsup: Examples of correct code with this mode

```ts
class C {
  constructor(public prop: string) {}
}

// the following cases cannot simply be converted to parameter property
class D {
  public prop: string;
  constructor(prop: 'foo' | 'bar') { // types don't match
    this.prop = prop;
  }
}

class E {
  public prop: string;
  constructor(prop?: string) { // parameter is optional, but property is not
    this.prop = prop;
  }
}

class F extends Something {
  public prop: string;
  constructor(prop: string) {
    console.log(prop);
    super(); // 'super()' needs to be the first statement in the constructor
    this.prop = prop;
  }
}

class G {
  public prop: string = '1'; // property is initialized first
  constructor(prop: string) {
    this.prop = prop;
  }
}

class H {
  public prop: string;
  constructor({prop}: {prop: string}) { // destructuring is not supported for parameter properties, yet
    this.prop = prop;
  }
}

class I {
  public prop: string;
  constructor(prop: string) {
    prop = 'foo'; // parameter is modified before being assigned to property
    this.prop = prop;
  }
}
```

## Further Reading

* TypeScript Handbook: [Classes](https://www.typescriptlang.org/docs/handbook/classes.html) (scroll down to `Parameter properties`)
