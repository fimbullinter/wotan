# Mímir

Core rules, formatters and configurations of the Fimbullinter project.

[![npm version](https://img.shields.io/npm/v/@fimbul/mimir.svg)](https://www.npmjs.com/package/@fimbul/mimir)
[![npm downloads](https://img.shields.io/npm/dm/@fimbul/mimir.svg)](https://www.npmjs.com/package/@fimbul/mimir)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovateapp.com/)
[![CircleCI](https://circleci.com/gh/fimbullinter/wotan/tree/master.svg?style=shield)](https://circleci.com/gh/fimbullinter/wotan/tree/master)
[![Build status](https://ci.appveyor.com/api/projects/status/a28dpupxvjljibq3/branch/master?svg=true)](https://ci.appveyor.com/project/ajafff/wotan/branch/master)
[![codecov](https://codecov.io/gh/fimbullinter/wotan/branch/master/graph/badge.svg)](https://codecov.io/gh/fimbullinter/wotan)
[![Join the chat at https://gitter.im/fimbullinter/wotan](https://badges.gitter.im/fimbullinter/wotan.svg)](https://gitter.im/fimbullinter/wotan)

Make sure to also read the [full documentation of all available modules](https://github.com/fimbullinter/wotan#readme).

## Purpose

This library contains all core rules, formatters and configuration presets of the Fimbullinter project. As a typical user you don't need to explicitly install this package. It's already installed as a dependency of Wotan.

## Rules

:mag: requires type information
:mag_right: works better with type information
:wrench: fixable
:nut_and_bolt: configurable
:x: not enabled in `recommended` preset

Rule | Description | Difference to TSLint rule / Why you should use it
---- | ---- | ----
[`await-async-result`](docs/await-async-result.md) | :mag: Warns about not using the result of a call to an async function inside async functions. | TSLint's `no-floating-promises` requires you to specify a list of Promise names, it checks outside of async functions and only requires you to register the `onrejected` callback.
[`await-only-promise`](docs/await-only-promise.md) | :mag: :wrench: Finds uses of `await` on non-Promise values. Also checks `for await` loops. | Works for all `PromiseLike` and `Thenable` types out of the box without any configuration.
[`ban-dom-globals`](docs/ban-dom-globals.md) | :mag: Disallows uses of global variables like `name` or `event`. Using these variables is most likely not intended. | There's an open PR to add a similar rule to TSLint.
[`delete-only-optional-property`](docs/delete-only-optional-property.md) | :mag: Disallows `delete` of required properties. | There's no similar TSLint rule.
[`generator-require-yield`](docs/generator-require-yield.md) | Requires at least one `yield` inside generator functions. | There's no similar TSLint rule.
[`new-parens`](docs/new-parens.md) | :wrench: Requires parentheses when invoking constructors. | Performance!
[`no-case-declaration`](docs/no-case-declaration.md) | Disallows `let`, `class` and `enum` in case blocks. | TSLint has no similar rule, ESLint has `no-case-declarations` which forbids function declarations as well.
[`no-debugger`](docs/no-debugger.md) | :wrench: Bans `debugger;` statements from your production code. | Performance!
[`no-duplicate-case`](docs/no-duplicate-case.md) | :mag_right: Detects `switch` statements where multiple `case` clauses check for the same value. | This implementation tries to infer the value instead of just comparing the source code.
[`no-duplicate-spread-property`](docs/no-duplicate-spread-property.md) | :mag: Detects properties in object literals with object spread that are always overridden. | TSLint has no such rule.
[`no-fallthrough`](docs/no-fallthrough.md) | Prevents unintentional fallthough in `switch` statements from one case to another. | Allows more comment variants such as `fallthrough` or `fall through`.
[`no-inferred-empty-object`](docs/no-inferred-empty-object.md) | :mag: Detects type parameters that are inferred as `{}` because the compiler cannot infer a type. | Really checks every type parameter of function, method and constructor calls. Correctly handles type parameters from JSDoc comments. Recognises type parameter defaults on all merged declarations.
[`no-invalid-assertion`](docs/no-invalid-assertion.md) | :mag: Disallows asserting a literal type to a different literal type of the same widened type, e.g. `'foo' as 'bar'`.| TSLint has no similar rule.
[`no-misused-generics`](docs/no-misused-generics.md) | Detects generic type parameters that cannot be inferred from the functions parameters. It also detects generics that don't enforce any constraint between types. | There's no similar TSLint rule.
[`no-nan-compare`](docs/no-nan-compare.md) | Disallows comparing with `NaN`, use `isNaN(number)` or `Number.isNaN(number)` instead. | Performance!
[`no-octal-escape`](docs/no-octal-escape.md) | :wrench: Disallows octal escape sequences in strings and template strings. | No such rule in TSLint.
[`no-return-await`](docs/no-return-await.md) | :wrench: Disallows unnecesary `return await foo;` when you can simply `return foo;` | The same as TSLint's rule. I wrote both, but this one is faster.
[`no-unassigned-variable`](docs/no-unassigned-variable.md) | Detects variables that are not initialized and never assigned a value. | There's no similar TSLint rule.
[`no-unreachable-code`](docs/no-unreachable-code.md) | Disallows statements that will never be executed. | TSLint removed their `no-unreachable` rule in v4.0.0.
[`no-unsafe-finally`](docs/no-unsafe-finally.md) | Disallows control flow statements `return`, `throw`, `break` and `continue` inside the `finally` block of a try statement. | Performance!
[`no-unstable-api-use`](docs/no-unstable-api-use.md) | :mag: Disallows uses of deprecated or experimental APIs. | This rule checks element accesses (`foo[bar]`), JSX elements, chained function calls (`getFn()()`) in addition to what TSLint's `deprecation` rule does and has more useful error reporting.
[`no-unused-expression`](docs/no-unused-expression.md) | :nut_and_bolt: Disallows side-effect free expressions whose value is not used. | This one is a bit stricter than TSLint's `no-unused-expression` and checks `for` loops in addition.
[`no-unused-label`](docs/no-unused-label.md) | :wrench: Disallows labels that are never used. | TSLint only has `label-position` which doesn't check for unused labels.
[`no-useless-assertion`](docs/no-useless-assertion.md) | :mag: :wrench: Disallows type assertions that don't change the type or are not necessary in the first place. | TSLint's `no-unnecessary-type-assertion` does not detect assertions needed to silence the compiler warning `Variable ... is used before being assigned.` The Wotan builtin rule also checks whether the assertion is necessary at all or the receiver accepts the original type.
[`no-useless-declare`](docs/no-useless-declare.md) | :wrench: Disallows the `declare` keyword on statements without runtime value, e.g. `declare type T = any;`. | TSLint has no such rule.
[`no-useless-initializer`](docs/no-useless-initializer.md) | :mag_right: :wrench: Disallows unnecessary initialization with `undefined` and useless destructuring defaults. | TSLint's rule `no-unnecessary-initializer` doesn't fix all parameter initializers and gives false positives for destructuring.
[`no-useless-jump-label`](docs/no-useless-jump-label.md) | :wrench: Disallows `continue label;` and `break label;` where the label is not necessary. | There's no similar TSLint rule.
`no-useless-predicate` | Detects redundant conditions that are either always true or always false. *requires type information* | Combination of TSLint's `strict-type-predicates`, `typeof-compare` and parts of `strict-boolean-expressions`.
[`no-useless-spread`](docs/no-useless-spread.md) | :wrench: Disallows redundant array and object spread. | There's no similar TSLint rule.
[`parameter-properties`](docs/parameter-properties.md) | :wrench: :nut_and_bolt: :x: Enforces or disallows the use of parameter properties. | TSlint only has `no-parameter-properties` to disallow all parameter properties and has no autofixer.
[`prefer-const`](docs/prefer-const.md) | :wrench: :nut_and_bolt: Enforces the use of `const` for variables that are never reassigned. | TSLint's `prefer-const` rule gives some false positives for merged declarations and variables used before being declared which results in a compiler or runtime error after fixing.
[`prefer-dot-notation`](docs/prefer-dot-notation.md) | :wrench: Enforces the use of `obj.foo` instead of `obj['foo']` where possible. | Same as TSLint's `no-string-literal` rule, but more performant.
`prefer-for-of` | Prefer `for-of` loops over regular `for` loops where possible. *requires type information* | Avoids the false positives of TSLint's `prefer-for-of` rule.
`prefer-namespace-keyword` | Prefer `namespace foo {}` over `module foo {}` to avoid confusion with ECMAScript modules. | Same as TSLint's `no-internal-module`.
`prefer-number-methods` | Prefer ES2015's `Number.isNaN` and `Number.isFinite` over the global `isNaN` and `isFinite` mainly for performance. *requires type information* | No similar rule in TSLint.
`prefer-object-spread` | Prefer object spread over `Object.assign` for copying properties to a new object. *requires type information* | Performance, and better handling of parens in fixer and avoids false positives that would cause a compile error when fixed.
[`return-never-call`](docs/return-never-call.md) | :mag: Enforces `return`ing or `throw`ing the result of a function of method call that returns `never`. | TSLint has no similar rule.
[`syntaxcheck`](docs/syntaxcheck.md) | :mag: :x: Reports syntax errors as lint errors.| Used to be part of the deprecated `tslint --type-check`
[`trailing-newline`](docs/trailing-newline.md) | :wrench: Enforces a line break at the end of each file. | Nothing fancy here :(
[`try-catch-return-await`](docs/try-catch-return-await.md) | :mag: :wrench: Enforces the use of `return await foo;` inside `try-catch` in async functions where `foo` is a `Promise`-like value. | TSLint has no similar rule.
]`type-assertion`](docs/type-assertion.md) | :wrench: :nut_and_bolt: :x: Enforces a single type assertion style: "classic" `<T>obj` or "as" `obj as T`. | TSLint has only `no-angle-bracket-type-assertion` which always enforces `as` and forgets to add parens when autofixing some cases.
[`typecheck`](docs/typecheck.md) | :mag: :x: TypeScript's compile errors as lint errors. | Like the deprecated `tslint --type-check` but formatted and can be disabled like any other rule.

## Formatters

* `stylish`
* `json`

## Configuration Presets

* `wotan:recommended` contains recommended builtin rules. This configuration only adds new rules in major versions.
* `wotan:latest` contains recommended builtin rules and is updated in minor versions. Be aware that this might cause your build to break.

## License

Apache-2.0 © [Klaus Meinhardt](https://github.com/ajafff)
