# parameter-properties

:wrench: fixable
:nut_and_bolt: configurable
:x: not enabled in `recommended` preset

Enforces a single type assertion style: "classic" `<T>obj` or "as" `obj as T`.

## Rationale

Type assertions in TypeScript files come in two flavours. Whichever you choose, you should enforce consistency within your project.

### "classic" `<T>obj`

The classic type assertion has less characters, but may be more difficult to type on your keyboard because of the angle brackets.
It doesn't require parentheses in most cases.
It doesn't work in `.tsx` files.
Sometimes TypeScript's autocomplete cannot know you want completions for a type assertion if you only typed the opening `<`.

### "as" `obj as T`.

The `as` type assertion was introduced to disambiguate type assertions from JSX tags. It can therefore be used `.tsx` files.
It sometimes requires parentheses around the assertion because otherwise is asserts the type of the whole preceding expression:

```ts
foo + bar as number;
// is parsed as
(foo + bar) as number;
// so you need to write instead
foo + (bar as number);
```

## Configuration

This rule allows you to configure which `style` of assertion you prefer: `"as"`(default) or `"classic"`

### style: as (default)

Requires all type assertions to be in the form of `obj as T`.

```yaml
rules:
  type-assertion: error
```

Or

```yaml
rules:
  type-assertion:
    options:
      style: as
```

:thumbsdown: Examples of incorrect code with this mode

```ts
<string>'';
```

:thumbsup: Examples of correct code with this mode

```ts
'' as string;
```

### style: classic

Requires all type assertions to use the classic syntax `<T>obj`. This syntax cannot be used in `.tsx` files. Therefore this rule does not apply to these files.

```yaml
rules:
  type-assertion:
    options:
      style: classic
```

:thumbsdown: Examples of incorrect code with this mode

```ts
'' as string;
```

:thumbsup: Examples of correct code with this mode

```ts
<string>'';
```

## Further Reading

* TypeScript Deep Dive: [Type Assertion](https://basarat.gitbooks.io/typescript/content/docs/types/type-assertion.html)
