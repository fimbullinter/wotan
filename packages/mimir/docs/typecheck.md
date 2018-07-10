# typecheck

:mag: requires type information
:x: not enabled in `recommended` preset

TypeScript's compile errors as lint errors.

## Rationale

There are several reasons this rule might be helpful for your setup:

* linting with different compiler options and ensuring the project still contains valid TypeScript with these options
* display errors in files that require a processor instead of executing the whole build toolchain
* single command to ensure your code has no type or lint errors

If you are executing the TypeScript compiler anyway, this rule is not necessary for you. It just adds additional overhead in this case.
