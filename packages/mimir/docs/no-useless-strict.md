# no-useless-strict

:mag_right: checks `--alwaysStrict` compilerOption when type information is available
:wrench: fixable

Disallows redundant `'use strict';` directives. | TSLint had a rule to enforce `'use strict'` everywhere.

## Rationale

Strict mode affects the current scope as well as all nested code. Code inside ES6 modules and classes is always in strict mode. That means nested `'use strict';` directives are redundant.

## Examples

:thumbsdown: Examples of incorrect code

```ts
export {};
'use strict'; // ES6 modules are always strict
```

```ts
class Foo {
  method() {
    'use strict'; // classes are always strict
  }
}

function foo() {
  'use strict';
  return () => {
    'use strict'; // parent scope is already strict
  }
}

function bar() {
  'use strict';
  "use strict"; // there's already a 'use strict' directive
}
```

:thumbsup: Examples of correct code

```ts
'use\u0020strict'; // not a 'use strict' directive, escape sequences are not allowed
'foo';
'use strict';
console.log('use strict');
'use strict'; // this is not a prologue directive
```

## Further Reading

* MDN: [Strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode)

## Related Rules

* [`no-unused-expression`](no-unused-expression.md)
