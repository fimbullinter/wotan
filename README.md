# wotan

Pluggable TypeScript and JavaScript linter

[![Greenkeeper badge](https://badges.greenkeeper.io/fimbullinter/wotan.svg)](https://greenkeeper.io/)
[![CircleCI](https://circleci.com/gh/fimbullinter/wotan/tree/master.svg?style=shield)](https://circleci.com/gh/fimbullinter/wotan/tree/master)
[![Build status](https://ci.appveyor.com/api/projects/status/a28dpupxvjljibq3/branch/master?svg=true)](https://ci.appveyor.com/project/ajafff/wotan/branch/master)
[![codecov](https://codecov.io/gh/fimbullinter/wotan/branch/master/graph/badge.svg)](https://codecov.io/gh/fimbullinter/wotan)
[![Join the chat at https://gitter.im/fimbullinter/wotan](https://badges.gitter.im/fimbullinter/wotan.svg)](https://gitter.im/fimbullinter/wotan)

## What is this all about?

Seriously, you don't have to read through this. If you think "Shut up and show me what you got!", go ahead to [Available Rules](#available-rules), [Configuration](#configuration) and [CLI Options](#cli-options).

### What does "wotan" mean?

Wotan is one of the many names of Odin, the All-Father. You may also know him by the name Woden, Wodan, Wensley, etc. Woden is a sacrificial god, bloodthirsty and cruel.
He is constantly striving for wisdom. From his throne he can see everything in the nine worlds happening.

### Why yet another linter?

This one tries to avoid design decisions of other linters that turned out to be problematic:

- [x] Avoid name conflicts by prefixing rule names depending on the package they come from.
  - TSLint puts all rules in a global namespace and searches them in all available rules directories. That the order of the directories matters while core rules override take precedence.
  - ESLint allows a local rules directory as CLI flag. Rules in that directory can override core rules.
- [x] Dependencies of config files are resolved relative to that file.
  - TSLint already does that.
  - ESLint does not support that.
- [x] No distinction between shareable configs and plugins. In fact both are just extendable configs that can optionally provide rules directories, settings, rules and processors.
  - TSLint allows you to choose between `extends` and `rulesDirectory`. The rules directory of a package is an implementation detail and should not be part of the user's config.
  - ESLint handles configs and plugins quite different. In fact they tried to deprecate shareable configs in favor of plugins.
- [x] Lazy loading of rules to reduct startup time.
  - TSLint already does that
  - ESLint expects plugins to provide the rules as already loaded objects. That causes a lot of overhead if you only use a few rules of a big package.
- [x] Caching of file system access and configuration. As the Cache is a DI service, API users can clear the cache when needed.
- [x] Support for processors from the beginning. Enabling linting of *.vue files and many more.
- [x] Aliases for rules with configuration. Can be used to treat rules like ESLint's `no-resticted-syntax` as distinct named rules for each config option.
- [x] The whole API is powered by a DI container. That makes it easy to inject a different service. Rules have access to a limited set of DI bindings.

### Differences to TSLint

* To extend a plugin or shareable config, use `extends: plugin-name`. The name will be resolved according to node's module resolution algorithm relative to the config file.
* To use rules maintained inside your project, use `rulesDirectory: {"my-prefix": "./path/to/rules"}` and configure them as `my-prefix/rule-one: "error"`. The rules directory is a path relative to the config file.
* Overrides: You can override the main cofiguration by specifying one or more overrides. If the filename matches the glob pattern of the override, all settings provided by that override are applied. Overrides are processed in order, later overrides override settings from preceding overrides.
  * patterns match relative to the configuration file they are specified in
  * patterns without a slash are only matched against the basename of each file
  * to limit a match to the current directory, prefix the pattern with `./`
  * a negated pattern resets any prior matches
* `linterOptions.exclude` -> `exclude`
  * excludes are not overridden when extending a configuration
  * pattern matching follows the same rules as overrides (see above)
* JSON5 support for config files
* Global settings that rules can pick up
* Processors, even supports `--project`
* Aliases, see above
* Fixing excludes overlapping replacements and runs a configurable number of iterations per file
* Fixing with `--project` does not create the whole program from scratch, which makes it blazingly fast.
* Testing
  * Tests are configured in JSON files that can configure everything you can specify though the CLI
  * Test files don't contain error markup. That avoids syntax errors and makes them easier to maintain. Lint results and fixed content are stored in separate baseline files.

## Available Rules

Rule | Description | Difference to TSLint rule / Why you should use it
---- | ---- | ----
`await-promise` | Finds uses of `await` on non-Promise values. Also checks `for await` loops. *requires type information* | Works for all `PromiseLike` and `Thenable` types out of the box without any configuration.
`deprecation` | Finds uses of deprecated variables, classes, properties, functions, signatures, ... *requires type information* | This rule checks element accesses (`foo[bar]`), JSX elements, chained function calls (`getFn()()`) in addition to what the TSLint rule does and has more useful error reporting.
`no-fallthrough` | Prevents unintentional fallthough in `switch` statements from one case to another. If the fallthrough is intended, add a comment that matches `/^\s*falls? ?through\b/i`. | Allows more comment variants such as `fallthrough` or `fall through`.
`no-debugger` | Ban `debugger;` statements from your production code. | Performance!
`no-return-await` | Warns for unnecesary `return await foo;` when you can simply `return foo;` | The same as TSLint's rule. I wrote both, but this one is faster.
`no-unsafe-finally` | Forbids control flow statements `return`, `throw`, `break` and `continue` inside the `finally` block of a try statement. | Performance!
`no-unused-expression` | Warns about side-effect free expressions whose value is not used | This one is a bit stricter than TSLint's `no-unused-expression` and checks `for` loops in addition.
`no-unused-label` | Warns about labels that are never used or at the wrong position. | TSLint only has `label-position` which doesn't check for unused labels.
`no-useless-assertion` | Detects type assertions that don't change the type or are not necessary in the first place. *requires type information* | TSLint's `no-unnecessary-type-assertion` does not detect assertions needed to silence the compiler warning `Variable ... is used before being assigned.` This one also checks if the assertion is necessary at all.
`trailing-newline` | Requires a line break at the end of each file. | Nothing fancy here :(
`try-catch-return-await` | Companion of `no-return-await` because inside a try-catch block you should await returned promises to correctly enter the catch on rejection and/or the finally block after completion. | TSLint has no similar rule.

## Configuration

Wotan is configured with a YAML, JSON5 or JSON file named `.wotanrc.yaml`, `.wotanrc.json5` or `.wotanrc.json`. By default the configuration file from the closes parent folder is used to lint each file.

You can use different configurations for different directories. Consider the following setup:

`.wotanrc.yaml` describes the rules that apply to every file and subdirectory (unless they contain a cofiguration file themselves):

```yaml
---
extends: wotan:recommended # use all recommended rules
```

`test/.wotanrc.json` extends the base configuration and disables some rules that are not needed for tests:

```json
{
    "extends": "../.wotanrc.yaml",
    "rules": {
        "no-useless-assertion": "off",
        "await-promise": "warn"
    }
}
```

### Overrides

If you are more into having a single place for configuration, here's an alternative solution for the example above. The `.wotanrc.yaml` could look like this:

```yaml
---
extends: wotan:recommended # use all recommended rules, could be an array to extend multiple configs
rules: # could override some rules for all files here
overrides:
  - files: "test/**" # override the following rules for all files in the `test` folder
    rules:
      no-useless-assertion: off
      await-promise: warn
  - files: "*.spec.ts" # override the following rules for all *.spec.ts files in all directories
    rules:
      no-debugger: off
```

Overrides are processed in order and applied in order. The latter one overrides all prior overrides.

Note that in the example above `*.spec.ts` matches in all directories. Normally patterns are matched relative to the configuration file they are specified in. Patterns without any slash are treated special. These will only be matched against the basename of every file in every directory.
If you want to limit the pattern to the current directory, you can prefix it with `./` resulting in `./*.spec.ts`.

### Configuring Rules

Rules can have one of 3 different severities: `error`, `warning` (or `warn`) and `off`.
`error` is reported and causes the process to end with an exit code of 2. This is the default if not specified
`warning` is only reported.
`off` turns the rule off, of course.

Configurable rules get their options through an object. The content of the `"options"` property varies based on the rule.

```js
{
    "rules": {
        "some-rule": {
            "severity": "error",
            "options": {
                "some-option": "some-option-value"
            }
        }
    }
}
```

`severity` and `options` are both optional. That allows you to extend a configuration and only change the severity of a rule without altering the options. Or you can change the rule's options without changing the severity inherited by the base config.

## CLI Options

* `-c --config <name>` specifies the configuration to use for all files instead of looking for configuration files in parent directories. This can either be a file name, the name of a node module containing a shareable config, or the name of a builtin config like `wotan:recommended`
* `-e --exclude <glob>` excludes all files that match the given glob pattern from linting. This option can be used multiple times to specify multiple patterns. For example `-e '**/*.js' -e '**/*.d.ts'`. It is recommended to wrap the glob patterns in single quotes to prevent the shell from expanding them.
* `-f --format <name>` the name or path of a formatter. This can either be a file name, the name of a node module contianing a formatter, or the name of a builtin formatter. Currently available builtin formatters are `json` and `stylish` (default).
* `--fix [true|false]` automatically fixes all fixable failures in your code and writes the result back to disk. There are some precautions to prevent overlapping fixes from destroying you code. You should however commit your changes before using this feature.
* `-p --project <name>` specifies the path to the `tsconfig.json` file to use. This option is used to find all files contained in your project. It also enables rules that require type information.
* `[...FILES]` specifies the files to lint. You can specify paths and glob patterns here.

### Examples

The following examples are intended to be used as npm scripts. If you want to execute it directly on the command line, you need to use `./node_modules/.bin/wotan` instead of just `wotan`.

```sh
wotan # search the closest tsconfig.json and lint the whole project with type information
wotan -c wotan:recommended # same as above, but uses the specified configuration for all files in the project
wotan -c wotan:recommended --fix # same as above with automatic fixing
wotan '**/*.ts' -e '**/*.d.ts' -e 'node_modules/**' # lint all typescript files excluding declaration files, also excludes node_modules just to be sure
wotan -p . # lint the whole project configured by ./tsconfig.json, with type information, excludes node_modules by default
wotan -p . 'src/**' # lint all files in src directory that are included in the project with type information
```

## Supported Environments

This module runs on all actively supported versions of node.js starting from v6.12.3. Since node.js v4.x will be dumped in the first half of 2018 I didn't bother to support it.

This package officially supports the latest stable version of TypeScript. We try to make it compatible all the way back to v2.4.1 although some rules might behave differently due to changes in the type system.
We try to support TypeScript's nightly builds (`typescript@next`), but there is no guarantee.

Custom rules should at least use ES6 to have support for native classes. Otherwise you run into problems when trying to extend classes exported from this module.

## Semantic Versioning (SemVer policy)

:warning: The following policy does only apply for the yet to come 1.x and following releases. Every release in the 0.x range is considered experimental. There can and will be breaking API changes without deprecation.

In theory every change to a rule can break users and could be considered a breaking change. To avoid releasing a new major version for every bug fix, we have slightly different guidelines as outlined below.

### Prereleases (nightly builds)

* are not guaranteed to be stable
* contains the latest changes intended for the next release
  * `x.0.0-dev*` contains all changes including breaking ones for the next major version
  * `x.y.0-dev*` contains all changes for the next minor version
  * there are no prereleases for patch versions

### Patch Releases

* fixes crashes
* fixes regressions
* refactorings of internal functionality that don't change user facing behavior

### Minor Releases

* adds new rules, rule options, formatters, processors, APIs
* rules can add new checks that may lead to new failures
* new rules and options are enabled in `wotan:latest`
* rules can change their failure messages
* formatters intended for human consumtion (e.g. `stylish`) can change their output
* rules, rule options, formatters, processors and APIs can be deprecated
* new configuration options can be added to configuration files

### Major Releases

* contains breaking API changes
* removes previously deprecated rules, options, formatters, etc.
* formatters intended for machine consumption (e.g. `json` or `tap`) can change their output
* `wotan:recommended` is updated to the content of `wotan:latest`

## Release Schedule

Currently there is no fixed release schedule.
Nightly builds are published every night if there are changes on master.
Patch releases are published as soon as bugs are identified and fixed.
Minor releases are published every week or two if there changes on master.
Major releases are published once enough breaking changes have piled up.

## License

Apache-2.0 © [Klaus Meinhardt](https://github.com/ajafff)
