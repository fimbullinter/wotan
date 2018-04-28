# Change Log

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
