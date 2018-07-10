# trailing-newline

:wrench: fixable

Enforces a line break at the end of each file.

## Rationale

Many tools, especially Unix tools, rely on files having a final newline. Some require it for correct display while others need it to function correctly.
In fact the POSIX standard defines a "line" as follows:

> A sequence of zero or more non- <newline> characters plus a terminating <newline> character.

## Further Reading

* StackOverflow: [Why should text files end with a newline?](https://stackoverflow.com/questions/729692/why-should-text-files-end-with-a-newline)
