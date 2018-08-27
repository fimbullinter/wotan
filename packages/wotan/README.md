# Wotan

Pluggable TypeScript and JavaScript linter

[![npm version](https://img.shields.io/npm/v/@fimbul/wotan.svg)](https://www.npmjs.com/package/@fimbul/wotan)
[![npm downloads](https://img.shields.io/npm/dm/@fimbul/wotan.svg)](https://www.npmjs.com/package/@fimbul/wotan)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovateapp.com/)
[![CircleCI](https://circleci.com/gh/fimbullinter/wotan/tree/master.svg?style=shield)](https://circleci.com/gh/fimbullinter/wotan/tree/master)
[![Build status](https://ci.appveyor.com/api/projects/status/a28dpupxvjljibq3/branch/master?svg=true)](https://ci.appveyor.com/project/ajafff/wotan/branch/master)
[![codecov](https://codecov.io/gh/fimbullinter/wotan/branch/master/graph/badge.svg)](https://codecov.io/gh/fimbullinter/wotan)
[![Join the chat at https://gitter.im/fimbullinter/wotan](https://badges.gitter.im/fimbullinter/wotan.svg)](https://gitter.im/fimbullinter/wotan)

Make sure to also read the [full documentation of all available modules](https://github.com/fimbullinter/wotan#readme).

## Quick Start

Install Wotan as a local dependency:

```sh
npm install --save-dev @fimbul/wotan
# or
yarn add -D @fimbul/wotan
```

Add a `.wotanrc.yaml` file to the root of your project with the following content:

```yaml
extends: wotan:recommended
```

That enables all recommended builtin rules. See the below for a list of [available rules](#available-rules) and [how the configuration works](#configuration).

Now you can run the linter with one of the following commands depending on your use case:

```sh
wotan -p <path/to/tsconfig.json> # lint the whole project
wotan 'src/**/*.ts' -e '**/*.d.ts' # lint all typescript files excluding declaration files
wotan --fix # lint the whole project and fix all fixable errors
```

## Available Rules

For a list of available rules, see the [documentation of the `@fimbul/mimir` package](https://github.com/fimbullinter/wotan/blob/master/packages/mimir/README.md#rules).

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
        "await-only-promise": "warn"
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
      await-only-promise: warn
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

### Display Configuration

If the linter behaves somehow unexpected, it's probably because you configured it that way.
You're lucky because there's a builtin command to diagnose this, so you don't need to know how the configuration file lookup and the handling of overrides, excludes and aliases works in detail.

Just use `wotan show <filename>` to display the configuration file and the exact rule config used to lint this file. If there is no file found or the file is excluded, you will see that too.

## Enable or disable rules with comments

Sometimes you need to enable or disable a specific rule or all rules for a section of a file. This can be done using comments. It doesn't matter if you use `//` or `/* */`. Multiple rule names are separated by comma.

* `// wotan-disable` disables all rules from the start of the comment until the end of the file (or until it is enabled again)
* `// wotan-enable` enables all rules from the start of the comment until the end of the file. Enable comments have the same mechanics as disable comments.
* `// wotan-disable-line` disables all rules in the current line (also works with enable)
* `// wotan-disable-next-line` disables all rules in the next line (also works with enable)
* `// wotan-enable-line foo` enables the rule `foo` in the current line
* `// wotan-enable-next-line bar, local/baz` enables the rules `bar` and `local/baz` in the next line

## CLI Options

* `-m --module <name>` specifies one or more packages with DI modules to load before starting the actual linter. These modules can be used to override the default behavior.
* `-c --config <name>` specifies the configuration to use for all files instead of looking for configuration files in parent directories. This can either be a file name, the name of a node module containing a shareable config, or the name of a builtin config like `wotan:recommended`
* `-e --exclude <glob>` excludes all files that match the given glob pattern from linting. This option can be used multiple times to specify multiple patterns. For example `-e '**/*.js' -e '**/*.d.ts'`. It is recommended to wrap the glob patterns in single quotes to prevent the shell from expanding them.
* `-f --formatter <name>` the name or path of a formatter. This can either be a file name, the name of a node module contianing a formatter, or the name of a builtin formatter. Currently available builtin formatters are `json` and `stylish` (default).
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

### Adding CLI defaults to `.fimbullinter.yaml`

If you find yourself using Wotan with the same CLI arguments over and over again, you can simply save them as defaults to a file called `.fimbullinter.yaml`. By default Wotan uses this file for CLI defaults if it's present in your current working directory.

There's a subcommand to create and update this file, so you don't need to know any implementation details to guess the file structure.

Let's assume you always use the following CLI arguments:

```sh
wotan -p tsconfig.build.json -c config/.wotanrc.yaml -e '**/*.d.ts'
```

To save these as defaults, simply use the `save` subcommand:

```sh
wotan save -p tsconfig.build.json -c config/.wotanrc.yaml -e '**/*.d.ts'
```

You just created a `.fimbullinter.yaml` file with the following contents:

```yaml
config: config/.wotanrc.yaml
exclude:
  - "**/*.d.ts"
project: tsconfig.build.json
```

The next time you execute `wotan` in that directory, this default configuration is automatically picked up.

Defaults can be overridden or cleared by explicitly specifying them as CLI arguments, for example:

```sh
wotan -p tsconfig.json -e '' # overrides 'project' and clears 'exclude'

wotan save -c '' # clear 'config' option and update .fimbullinter.yaml
```

Note that `.fimbullinter.yaml` can also be used to store configuration for plugin modules. See the documentation of the plugins you use if this applies to you. In that case you need to edit the file manually. Using `wotan save` will not alter third party configuration.

## Diagnosing Misbehavior

Catching bugs by just looking at an exception is hard. That's why Wotan produces debug output for certain events. You only need to enable it via environment variable `DEBUG=wotan:*` and run the previous command again.
See the [detailed documentation](https://github.com/visionmedia/debug#wildcards) on how to use the wildcards.

## License

Apache-2.0 © [Klaus Meinhardt](https://github.com/ajafff)
