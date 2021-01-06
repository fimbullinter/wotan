# no-fallthrough

:mag_right: works better with type information

Prevents unintentional fallthough in `switch` statements from one clause to another. If the fallthrough is intended, add a comment that matches `/^\s*falls? ?through\b/i`.

## Rationale

In JavaScript `switch` statements a clause (`case` or `default`) that doesn't end the control flow falls through to the next clause without matching it's condition.

This is useful to mimic logical OR (`||`) in switch statements:

```ts
switch (v) {
  case 1:
  case 2:
    console.log('few');
}
// same as
if (v === 1 || v === 2) {
  console.log('few');
}
```

The confusing part are clauses that actually contain statements where you wouldn't expect a fallthrough:

```ts
switch (v) {
  default:
    console.log('default');
  case 1: {
    console.log('one');
  }
  case 2:
    console.log('two');
}
```

In the above code snippet if `v === 2` it logs `'two'`; if `v === 1` it logs `'one'` **and** `'two'`, because there is no `break;` at the end of the clause; for every other value it logs `'default'`, `'one'` **and** `'two'` because of missing `break;` statements.

## Examples

:thumbsdown: Examples of incorrect code

```ts
switch (v) {
  default:
    console.log('default');
    // missing 'break;' here
  case 1: {
    console.log('one');
    // missing 'break;' here
  }
  case 2:
    if (condition) {
      console.log('two');
      break;
    } else {
      console.log('two and a half');
      // missing 'break;' in this branch
    }
  case 3:
    console.log('three');
}
```

:thumbsup: Examples of correct code

```ts
switch (v) {
  default:
    console.log('default'); // valid because of the comment below
    // falls through
  case 0:
    console.log('zero'):
    break; // 'break' ends thr control flow
  case 1: {
    console.log('one');
    return; // 'return' ends the control flow
  }
  case 2:
    if (condition) {
      console.log('two');
      break;
    } else {
      throw new Error(); // 'throw' ends control flow
    }
  case 3: // this is valid because it has no statements
  case 4:
    console.log('other');
    // there is no following clause so 'break;' is not necessary here
}

// when linting with type information the following patterns are also recognized
declare function fail(): never;

function fn(p: {kind: 'a', nested: boolean} | {kind: 'b' | 'c'}) {
  switch (p.kind) {
    case 'a':
      switch (p.nested) {
        case true:
          return 1;
        case false:
          return 2;
      }
      // switch statement is exhaustive (handles every possible value), so there's no possibility to fall through
    case 'b':
      fail();
      // ends control flow by returning 'never'
    case 'c':
      return 3;
  }
}
```

## Related Rules

* [`no-case-declaration`](no-case-declaration.md)
* [`no-duplicate-case`](no-duplicate-case.md)
* [`return-never-call`](return-never-call.md)
