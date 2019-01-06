# Change Log

## v0.18.0

:warning: **Breaking Changes:**

* configuration: patterns (`exclude` and `overrides[].files`) match dotfiles, e.g. `*.spec.ts` now matches `.foo.spec.ts`.
* disable comments: handling of nested ranges changed. `//wotan-enable-line` in a line disabled by `//wotan-disable-next-line` is ignored
* API: completely refactored `FileFilterFactory`, `FileFilter`, `LineSwitchFilterFactory`, `LineSwitchParser` and `DefaultLineSwitchParser`

**Features:**

* unchecked JS files (`//@ts-nocheck` or `checkJs: false`) are never linted with type information
* added `report-useless-directives` CLI option to report unused and redundant enable and disable comments

**Bugfixes:**

* `wotan`: added missing exports to the public API
* patterns in configuration files match dotfiles (see breaking changes)

## v0.17.0

:tada: This release introduces a plugin for TypeScript's LanguageService. This enables in-editor linting while you type. See the [docs](https://github.com/fimbullinter/wotan/blob/master/packages/mithotyn/README.md) for more details.

:warning: **Breaking Changes:**

* TypeScript 2.8 and 2.9 is no longer supported
* API:
  * `Failure` was renamed to `Finding` throughout the codebase
  * `Resolver` adds a new required method `getDefaultExtensions`
  * `Resolver#resolve` makes parameters `basedir` and `extensions` optional
  * `Runner` requires a new service `FileFilterFactory`
  * added severity `suggestion`

**Features:**

* new package `@fimbul/mithotyn` provides in-editor linting through a TypeScript LanguageService Plugin
* new severity: `suggestion`
* `--fix` can no longer introduce syntax errors
* `async-function-assignability`: checks methods and properties with computed names
* `async-function-assignability`: checks method overloads individually
* new service abstraction `FileFilterFactory` and `FileFilter` allow customizing which files are linted
* `@fimbul/ve` no longer includes the line break after the opening tag in the linted code
* `@fimbul/ve` correctly adjusts the column of findings in the first line if there is no line break after the opening tag
* `prefer-number-methods`: fixed finding location

**Bugfixes:**

* declaration files no longer contain `const enum`
* core services no longer rely on the existence of `require`
* YAML configuration can now contain YAML-specific types

## v0.16.0

**Features:**

* new rule: `async-function-assignability`
* handle `BigInt` types and literals
* `no-duplicate-case`: correctly handles BigInt and (bitwise) negation thereof
* `no-invalid-assertion`: adds an additional check for asserting BigInts
* `no-useless-predicage`: allows comparing `typeof v === "bigint"`
* `no-duplicate-spread-property`: handle spreading of type variables introduced in typescript@3.2

**Bugfixes:**

* `no-duplicate-case`: only use type information if `strictNullChecks` is enabled to avoid false positives
* CLI normalizes `..` and `.` in glob patterns and file names
* `no-duplicate-spread-property`: works with intersection types

## v0.15.0

**Features:**

* `wotan test` now validates test configurations
* Performance improvements using recently added Node.js file system features
* Improved caching of directory entries
* Work around breaking changes in TypeScript API regarding project references
* `--fix` now merges replacements of a single fix instead of throwing an error
* `no-useless-spread`: added check for JSX spread attributes

**Bugfixes:**

* `no-useless-initializer`: removed unreliable fix for object destructuring
* `no-useless-initializer`: fixed false positive in destructuring when property is a type parameter or conditional type

## v0.14.0

**Features:**

* Added support for [Project References](https://www.typescriptlang.org/docs/handbook/project-references.html) added in TypeScript 3.0.0
  * Correctly process `tsconfig.json` containing `references`
  * Log no warning on empty `files` array if there are `references`
  * Added `-r` or `--references` CLI option to recursively lint all `references`. This works similar to `tsc --build` but doesn't build a dependency graph. Instead it processes the projects depth-first in their specified order.
* Allow linting multiple projects in one run by specifiying `-p` or `--project` multiple times
* If a file was not found, report the projects it was searched in

**Bugfixes:**

* `typecheck`: correctly report declaration errors with `"composite": true`

## v0.13.0

:warning: **Breaking Changes:**

* Node.js v9 is no longer officially supported
* TypeScript v2.7 is no longer officially supported

**Features:**

* new rule: `no-restricted-property-access`
* new rule: `no-useless-strict`
* `no-useless-declare`: `declare` keyword is useless on `export`ed declarations in declaration files

**Bugfixes:**

* `no-duplicate-spread-property`: correctly handles computed names
* `no-duplicate-spread-property`: exclude class getters and setters like it's already done for class methods
* `no-duplicate-spread-property`: no error on getter and setter pair
* `no-invalid-assertion`: handle intersection types
* `prefer-for-of`: don't suggest `for-of` if implementation of iteration protocol contains `private` or `protected` members
* CLI: fixed handling of `--version`
* CLI: correctly handle absolute paths
* fixed corrupted internal state during autofixing with `--project` without typed rules

## v0.12.0

**Features:**

* `no-inferred-empty-object`: handle multiple JSDoc `@template` tags starting from TypeScript@3.0.0
* `no-unstable-api-use`: better error message for signatures
* `no-useless-initializer`: check computed names in destructuring

**Bugfixes:**

* `no-return-await`, `await-only-promise`, `no-useless-assertion`: fixer looks into tagged templates when parenthesizing
* `prefer-dot-notation`: fixer adds parens around numeric literals
* `type-assertion`: no longer emit invalid code when fixing to classic style

## v0.11.0

:warning: **Breaking Changes:**

* Dropped support for TypeScript@<2.7.0. The new backwards compatibility policy ensures support for the last 3 stable minor releases of TypeScript.
* `prefer-number-isnan` -> `prefer-number-methods` which checks `isFinite` in addition

**Features:**

* new rule: `no-octal-escape`
* new rule: `type-assertion`
* new rule: `delete-only-optional-property`
* Added support for `resolveJsonModule` compilerOption
* handle `unknown` type introduced in TypeScript@3.0.0
* `--fix` no longer autofixes files with syntax errors to prevent further destroying your code

**Bugfixes:**

* fixed crash in `no-inferred-empty-object` with TypeScript@3.0.0 and multiple JSDoc `@template` tags
* `no-useless-assertion`: better handling of contextual types
* `no-useless-predicate`: handle intersection types
* `prefer-for-of`: ensure iterated object implements iteration protocol
* `prefer-for-of`: ensure iterator yields the same type as index signature
* `no-unstable-api-use`: check element access with well-known symbols

## v0.10.0

This release fixes a few bugs related to the release process:

* packages are released in dependency order: a new version of a package will not be published before it's dependency
* fixed SemVer version mismatch by publishing packages that depend on other published packages

**Bugfixes:**

* `no-nan-compare`: also detects comparing with `Number.NaN`

## v0.9.0

**Features:**

* new rule: `parameter-properties` (contributed by @aervin)
* new rule: `no-duplicate-spread-property`
* new rule: `prefer-namespace-keyword`
* new rule: `no-useless-declare`
* new rule: `ban-dom-globals`
* `bifrost` added a function to wrap Fimbullinter rules for the use in TSLint
* many rules now have a detailed documentation page
* Node.js v10 is now officially supported

**Bugfixes:**

* `await-only-promise` now allows `for-await-of` with `Iterable<PromiseLike<any>>`, previously it only allowed `AsyncIterable<any>`
* `no-duplicate-case` added check for unions of literal types
* `no-inferred-empty-object` handles generic functions declared in JSDoc
* `no-useless-assertion` fixed detection if variable may be used before being assigned and thus the non-null assertion is actually necessary

## v0.8.0

**Features:**

* new rule: `no-invalid-assertion`
* `no-inferred-empty-object` checks JSX elements and tagged templates starting from typescript@2.9.0
* `no-useless-initializer` checks destructuring defaults

**Bugfixes:**

* `no-inferred-empty-object` correctly checks classes with constructor
* `no-inferred-empty-object` correctly checks classes from JavaScript files that have type parameters in JSDoc
* `no-useless-assertion` forbids definite assignment assertions on properties with computed name
* `no-return-await` wraps object literals returned from shorthand arrow functions in parentheses to avoid syntax errors
* `no-useless-spread` no longer autofixes object spread to avoid introducing duplicate key errors
* `--project` flag no longer causes a crash when referencing non-existent files
* `valtyr` correctly loads custom formatters

Thanks to @aervin for contributing.

## v0.7.0

**Features:**

* new rule: `no-unassigned-variable`
* new rule: `no-useless-spread` (contributed by @aervin)
* new rule: `return-never-call`

**Bugfixes:**

* `no-inferred-empty-object`: check generic JSX elements (starting from typescript@2.9)
* `no-useless-assertion`: correctly handle conditional types
* `no-useless-predicate`: checks comparing `typeof` with a variable that has a literal type: `const str = 'string'; typeof 1 === str;`

## v0.6.0

**Features:**

* new rule: `new-parens`
* new rule: `no-case-declaration`
* new rule: `no-duplicate-case`
* new rule: `no-misused-generics`
* new rule: `no-useless-jump-label`
* new rule: `prefer-for-of`
* optimized some of the existing rules for performance
* added decorators to `ymir` for commonly used rule predicates: `@excludeDeclarationFiles` and `@typescriptOnly`

**Bugfixes:**

* Errors in `tsconfig.json` are now reported as warnings instead of errors. That allows the use of older versions of TypeScript while using compiler options introduced in a later version.
* `no-useless-predicate` now also checks `case` clauses of `switch` statements

## v0.5.0

**Features:**

* new rule `prefer-const`
* new rule `no-useless-predicate`

**Bugfixes:**

* fixed dependency versions of nightly releases for packages that were published in a previous nightly release
* changes to tests and project setup no longer cause a package to be released

## v0.4.0

This release contains a lot of refactoring and structural changes:

* renamed `await-promise` to `await-only-promise`
* renamed `deprecation` to `no-unstable-api-use`

Two new packages were split from the `wotan` package:

* `ymir` contains all base types and classes. This package can be used by extension and rule authors to not depend on the full `wotan` runtime.
* `mimir` contains all rules, formatters and configuration presets. Together with `ymir` this package allows rules to be executed in a different runtime without depending on the whole `wotan` package

**Features:**

* Added recipes to Readme
* new rule `await-async-result`
* new rule `generator-require-yield`
* new rule `no-nan-compare`
* new rule `no-unreachable-code`
* new rule `prefer-dot-notation`
* new rule `prefer-number-isnan`
* new rule `prefer-object-spread`
* `no-unstable-api-use` (previously `deprecation`) also checks `@experimental` tag

**Bugfixes:**

`no-unused-label` no longer forbids labels on statements other than loops and switch


## v0.3.0

**Features:**

`valtyr` added support for processors via `.fimbullinter.yaml`

## v0.2.0

**Features:**

* Added some documentation on how to use the API
* `wotan`:
  * new rule `no-useless-initializer`
  * Renamed `--format` CLI argument to `--formatter`
  * Added support for a configuration file with CLI defaults called `.fimbullinter.yaml`
  * Added `wotan save` subcommand to write or update `.fimbullinter.yaml`
  * Some internal refactoring and breaking API changes for plugin modules
  * `wotan show` subcommand added optional `-c` option
  * Refactored failure filtering to allow custom services to filter by different criteria than line base comments with rule names.
* `valtyr`:
  * Added new package `@fimbul/valtyr` to enable TSLint-like behavior
  * Uses `tslint.json` files for configuration
  * Uses TSLint rules and formatters
  * Filters by `//tslint:disable` comments
  * Cannot be used together with `.wotanrc.yaml` or Wotan rules and formatters
  * The next release will include support for processors by using the new `.fimbullinter.yaml` file
* `bifrost`:
  * Enforce that rules add failures for the current SourceFile only
  * `wrapTslintRule`: `name` parameter is now optional

**Bugfixes:**

* `wotan`:
  * Really "Include missing declarations in bundled declaration files" which was documented as part of v0.1.0
  * Fixed logic to find and report unmatched files in processed projects
  * Fixed crash during directory scanning when using `--project` if a directory contains an invalid `.wotanrc.yaml` file

## v0.1.0

**Features:**

* Enabled nightly builds for all packages. These can be installed with `yarn add @fimbul/wotan@next @fimbul/ve@next ...` (or `npm install` if you prefer).
* `ve`: use SAX parser for performance and avoid false positive matches of `<script>` tags
* `wotan`:
  * New rule `typecheck`: type errors as lint rule failures (similar to `tslint --type-check`, but is correctly formatted and can be ignored like any other rule)
  * New rule `syntaxcheck`: syntax errors as lint rule failures
  * New rule `no-inferred-empty-object`: warns about uninferred type parameters that might cause unintended behavior
  * Introduced `LineSwitchParser` to allow overriding the default line switch handling
  * Introduced `ConfigurationProvider` to allow overriding the default config lookup and parsing
  * Removed implicit configuration lookup in home directory
  * Improved error reporting for errors in configuration files
  * Fail early for circular aliases or missing rulesDirectories in configuration files
  * Allow alias shorthands:
  ```yaml
  overrides:
    prefix:
      name: some-rule-name # same as `name: { rule: some-rule-name }`
  ```
* Added documentation for rule and package authors

**Bugfixes:**

* Include missing declarations in bundled declaration files
* `wotan`:
  * Rule `no-useless-type-assertion` now correctly handles class expressions and qualified type names
  * Detect MPEG TS files and show a warning. Such files are treated as if they were empty.
  * `stylish` formatter correctly displays `line:col` information for files with BOM

## v0.0.1 - Initial Release

**Packages:**

* `@fimbul/wotan`: The main linter runtime with a set of core rules and formatters
  * Available formatters: `json` and `stylish` (default)
  * Available rules:
    * `await-promise` warns about unnecessary await on non-Promise values
    * `deprecation` detects the use of deprecated APIs
    * `no-debugger` bans `debugger;` statements
    * `no-fallthrough` warns about unintentional fallthrough in switch cases
    * `no-return-await` warns about unnecessary `return await foo;` where you can just `return foo;`
    * `no-unsafe-finally` warns about control flow statements within the `finally` block
    * `no-unused-expression` warns about expressions without side-effects whose result is not used
    * `no-unused-label` does what the name suggests, really
    * `no-useless-assertion` detects assertions that don't change the type of the expression
    * `trailing-newline` enforces a line break on the last line of a file
    * `try-catch-return-await` enforces the use of `return await foo;` inside try-catch blocks
* `@fimbul/ve`: The official processor plugin for Vue Single File Components
* `@fimbul/heimdall`: Plugin to enable the use of TSLint rules and formatters within Wotan
* `@fimbul/bifrost`: Allows authors of TSLint rules and formatters to make them available for Wotan without refactoring.
