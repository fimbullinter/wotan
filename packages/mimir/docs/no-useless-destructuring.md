# no-useless-destructuring

Detects array and object destructuring that doesn't assign to a variable.s

## Rationale

Destructuring can become very hard to read, especially when nesting comes into play. Sometimes a refactoring leaves a destructuring behind that no longer assigns a value and is therefore useless. This rule suggests to either remove or simplify certain redundant destructuring patterns.

## Examples

:thumbsdown: Examples of incorrect code

```ts
declare let obj: Record<string, any>;
declare let arr: any[];

// the following statements don't assign a variable
let {} = obj;
({} = obj);
({prop: {}} = obj);
let [] = arr;
[] = arr;
[, {}, []] = arr;

// the following could be simplified
let [first, , , ] = arr;
let [{}, ...[, ...rest]] = arr;
```

:thumbsup: Examples of correct code

```ts
declare let obj: Record<string, any>;
declare let arr: any[];

let {...clone} = obj;
let {a: {}, ...subset} = obj; // empty destructuring of 'a' is used to exclude that property
({b: {}, ...subset} = obj);

let [...clonedArr] = arr;
let [, , ...rest] = arr;
let [first] = arr;

// empty destructuring can be used to avoid giving unused parameters a name (only works for non-nullable parameters)
function fn({}: string, []: string[], param: boolean) {}
```

**Further Reading:**

* MDN: [Destructuring Assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment)

## Related Rules

* [`no-useless-initializer`](no-useless-initializer.md)
