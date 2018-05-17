# no-octal-escape

:wrench: fixable

Disallows octal escape sequences in strings and template strings.

## Rationale

ES5 deprecated octal escapes. They should be replaced with hex or unicode escape sequences.

## Examples

:thumbsdown: Examples of incorrect code

```ts
'\40';
'\040';
'\1';
'\00';
'abc\100def';
```

:thumbsup: Examples of correct code

```ts
'\0'; // \0 is considered a character escape
'\x20';
'\u0020';
```

## Further Reading

* [Octal escape sequences](https://mathiasbynens.be/notes/javascript-escapes#octal)

