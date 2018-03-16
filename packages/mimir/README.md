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

This library contains all core rules, formatters and configuration presets of the Fimbullinter project. It's used internally by Wotan.

## Rules

Rule | Description | Difference to TSLint rule / Why you should use it
---- | ---- | ----
`await-async-result` | Warns about not using the result of a call to an async function inside async functions. *requires type information* | TSLint's `no-floating-promises` requires you to specify a list of Promise names, it checks outside of async functions and only requires you to register the `onrejected` callback.
`await-only-promise` | Finds uses of `await` on non-Promise values. Also checks `for await` loops. *requires type information* | Works for all `PromiseLike` and `Thenable` types out of the box without any configuration.
`generator-require-yield` | Require at least one `yield` inside generator functions. | There's no similar TSLint rule.
`no-debugger` | Ban `debugger;` statements from your production code. | Performance!
`no-fallthrough` | Prevents unintentional fallthough in `switch` statements from one case to another. If the fallthrough is intended, add a comment that matches `/^\s*falls? ?through\b/i`. | Allows more comment variants such as `fallthrough` or `fall through`.
`no-inferred-empty-object` | Warns if a type parameter is inferred as `{}` because the compiler cannot find any inference site. | Really checks every type parameter of function, method and constructor calls. Correctly handles type parameters from JSDoc comments. Recognises type parameter defaults on all merged declarations.
`no-return-await` | Warns for unnecesary `return await foo;` when you can simply `return foo;` | The same as TSLint's rule. I wrote both, but this one is faster.
`no-unreachable-code` | Warns about statements that will never be executed. Works like TypeScript's dead code detection but doesn't fail compilation because it's a lint error. | TSLint removed their `no-unreachable` rule in v4.0.0.
`no-unsafe-finally` | Forbids control flow statements `return`, `throw`, `break` and `continue` inside the `finally` block of a try statement. | Performance!
`no-unstable-api-use` | Finds uses of deprecated and experimental variables, classes, properties, functions, signatures, ... *requires type information* | This rule checks element accesses (`foo[bar]`), JSX elements, chained function calls (`getFn()()`) in addition to what TSLint's `deprecation` rule does and has more useful error reporting.
`no-unused-expression` | Warns about side-effect free expressions whose value is not used | This one is a bit stricter than TSLint's `no-unused-expression` and checks `for` loops in addition.
`no-unused-label` | Warns about labels that are never used or at the wrong position. | TSLint only has `label-position` which doesn't check for unused labels.
`no-nan-compare` | Don't compare with `NaN`, use `isNaN(number)` or `Number.isNaN(number)` instead. | Performance!
`no-useless-assertion` | Detects type assertions that don't change the type or are not necessary in the first place. *requires type information* | TSLint's `no-unnecessary-type-assertion` does not detect assertions needed to silence the compiler warning `Variable ... is used before being assigned.` The Wotan builtin rule also checks whether the assertion is necessary at all or the receiver accepts the original type.
`no-useless-initializer` | Detects unnecessary initialization with `undefined`. | TSLint's rule `no-unnecessary-initializer` doesn't fix all parameter initializers and gives false positives for destructuring.
`no-useless-predicate` | Detects redundant conditions that are either always true or always false. *requires type information* | Combination of TSLint's `strict-type-predicates`, `typeof-compare` and parts of `strict-boolean-expressions`.
`prefer-const` | Prefer `const` for variables that are never reassigned. Use option `{destructuring: "any"}` if you want to see failures for each identifier of a destructuring, even if not all of them can be constants. The default is `{destructuring: "all"}`. | TSLint's `prefer-const` rule gives some false positives for merged declarations and variables used in before being declared which results in a compiler error after fixing.
`prefer-dot-notation` | Prefer `obj.foo` over `obj['foo']` where possible. | Same as TSLint's `no-string-literal` rule, but more performant.
`prefer-for-of` | Prefer `for-of` loops over regular `for` loops where possible. | Avoids the false positives of TSLint's `prefer-for-of` rule.
`prefer-number-isnan` | Prefer ES2015's `Number.isNaN` over the global `isNaN` mainly for performance. *requires type information* | No similar rule in TSLint.
`prefer-object-spread` | Prefer object spread over `Object.assign` for copying properties to a new object. *requires type information* | Performance, and better handling of parens in fixer and avoids false positives that would cause a compile error when fixed.
`syntaxcheck` | Reports syntax errors as lint errors. This rule is **not** enabled in `wotan:recommended`. *requires type information* | Used to be part of the deprecated `tslint --type-check`
`trailing-newline` | Requires a line break at the end of each file. | Nothing fancy here :(
`try-catch-return-await` | Companion of `no-return-await` because inside a try-catch block you should await returned promises to correctly enter the catch on rejection and/or the finally block after completion. | TSLint has no similar rule.
`typecheck` | TypeScript's compiler errors as lint errors. This rule is **not** enabled in `wotan:recommended`. *requires type information* | Like the deprecated `tslint --type-check` but formatted and can be disabled like any other rule.

## Formatters

* `stylish`
* `json`

## Configuration Presets

* `wotan:recommended` contains recommended builtin rules. This configuration only adds new rules in major versions.
* `wotan:latest` contains recommended builtin rules and is updated in minor versions. Be aware that this might cause your build to break.

## License

Apache-2.0 © [Klaus Meinhardt](https://github.com/ajafff)
