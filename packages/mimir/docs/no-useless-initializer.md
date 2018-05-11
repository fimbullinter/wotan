# no-useless-initializer

:mag_right: checking destructuring defaults requires type information
:wrench: fixable

Disallows unnecessary initialization with `undefined` and useless destructuring defaults.

## Rationale

Variables have the value `undefined` even without being explicitly initialized to `undefined`. The initializer is therefore useless.

Parameter defaults are only applied if the parameter's value is `undefined`, for example if it was not provided at all. Defaulting a parameter to `undefined` in case it is `undefined` is just redundant.

Destructuring defaults are only applied if the destructured property's value is `undefined`. If the property cannot be `undefined` the default value is never used.

## Examples

:thumbsdown: Examples of incorrect code

```ts
let v: string | undefined = undefined;

function foo(param: string | undefined = undefined) {}

declare let obj: {
  prop: string;
};

let {prop = 'default'} = obj; // prop will never be undefined
```

:thumbsup: Examples of correct code

```ts
let v: string | undefined;

function foo(param: string | undefined) {}

declare let obj: {
  prop?: string;
};

let {prop = 'default'} = obj; // prop is optional
```

## Further Reading

* MDN: [Default parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters)
* MDN: [Destructuring assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment)
