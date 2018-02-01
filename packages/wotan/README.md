# wotan

Pluggable TypeScript and JavaScript linter

[![npm version](https://img.shields.io/npm/v/@fimbul/wotan.svg)](https://www.npmjs.com/package/@fimbul/wotan)
[![npm downloads](https://img.shields.io/npm/dm/@fimbul/wotan.svg)](https://www.npmjs.com/package/@fimbul/wotan)
[![Greenkeeper badge](https://badges.greenkeeper.io/fimbullinter/wotan.svg)](https://greenkeeper.io/)
[![CircleCI](https://circleci.com/gh/fimbullinter/wotan/tree/master.svg?style=shield)](https://circleci.com/gh/fimbullinter/wotan/tree/master)
[![Build status](https://ci.appveyor.com/api/projects/status/a28dpupxvjljibq3/branch/master?svg=true)](https://ci.appveyor.com/project/ajafff/wotan/branch/master)
[![codecov](https://codecov.io/gh/fimbullinter/wotan/branch/master/graph/badge.svg)](https://codecov.io/gh/fimbullinter/wotan)
[![Join the chat at https://gitter.im/fimbullinter/wotan](https://badges.gitter.im/fimbullinter/wotan.svg)](https://gitter.im/fimbullinter/wotan)

Make sure to also read the [full documentation of all available modules](https://github.com/fimbullinter/wotan#readme).

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

* `-m --module <name>` specifies one or more packages with DI modules to load before starting the actual linter. These modules can be used to override the default behavior.
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
wotan -m @fimbul/heimdall # enables TSLint rules and formatters to be used. for more information, see @fimbul/heimdall
```

## License

Apache-2.0 © [Klaus Meinhardt](https://github.com/ajafff)
