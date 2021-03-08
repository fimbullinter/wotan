# Valtýr

Wotan module to lint according to your existing `tslint.json` and `tslint:disable` comments.

[![npm version](https://img.shields.io/npm/v/@fimbul/valtyr.svg)](https://www.npmjs.com/package/@fimbul/valtyr)
[![npm downloads](https://img.shields.io/npm/dm/@fimbul/valtyr.svg)](https://www.npmjs.com/package/@fimbul/valtyr)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovateapp.com/)
[![CircleCI](https://circleci.com/gh/fimbullinter/wotan/tree/master.svg?style=shield)](https://circleci.com/gh/fimbullinter/wotan/tree/master)
[![Build status](https://ci.appveyor.com/api/projects/status/a28dpupxvjljibq3/branch/master?svg=true)](https://ci.appveyor.com/project/ajafff/wotan/branch/master)
[![codecov](https://codecov.io/gh/fimbullinter/wotan/branch/master/graph/badge.svg)](https://codecov.io/gh/fimbullinter/wotan)
[![Join the chat at https://gitter.im/fimbullinter/wotan](https://badges.gitter.im/fimbullinter/wotan.svg)](https://gitter.im/fimbullinter/wotan)

Make sure to also read the [full documentation of all available modules](https://github.com/fimbullinter/wotan#readme).

## Purpose

Drop-in replacement for TSLint. Uses your existing `tslint.json` files, loads TSLint rules and formatters and honors `tslint:disable` comments.

## Installation

```sh
npm install --save-dev @fimbul/wotan @fimbul/valtyr
# or
yarn add -D @fimbul/wotan @fimbul/valtyr
```

## Usage

```sh
wotan -m @fimbul/valtyr
```

The `-m @fimbul/valtyr` argument enables this package. It searches `tslint.json` (or `tslint.yaml`) files for configuration like TSLint does. It loads TSLint core rules as well as custom rules with the same rules as TSLint. It uses TSLint formatters to format the result.

There are only minor differences:

* CLI arguments are still those of the Wotan executable
* exception messages are a bit different
* `stylish` formatter is used by default
* files of external modules are always excluded while `*.d.ts` in your project are included by default

### Using Processors

Because `tslint.json` has no field to configure processors, you need to configure them in a separate file.
Create a file named `.fimbullinter.yaml`. If it already exists, simply add the new cofiguration under the `valtyr` key.

The following example shows how to enable a processor for `.vue` files:

```yaml
valtyr:
  overrides:
    - files: "*.vue"
      processor: "@fimbul/ve"
```

Note that the configuration for `valtyr` can only contain `overrides`, `settings` and `processor`. Everything else is not supported and will result in an error.

## Why!?

Why should you use Wotan to execute TSLint rules?

* Allows you to use your existing configuration, rules and formatters without modification.
* Avoids using two different lint tool during migration to Wotan.
* Blazingly fast autofixing, especially when linting the whole project with the `-p` flag.
* Smart handling of overlapping fixes avoids destroying your code.
* Allows the use of builtin configurations and shareable configs as CLI argument for `-c`, e.g. `-c tslint:latest` or `-c tslint-config-airbnb`.
* Debug output to diagnose crashes.
* Configuration caching avoids unnecessary work when linting many directories with the same config.
* Optimized line switch parser finds `tslint:disable` comments faster with less overhead, especially in big files.
* Reports unused and redundant `tslint:disable` comments with `--report-useless-directives` CLI option.
* [Processor support for TSLint rules](https://github.com/palantir/tslint/issues/2099)
* Consistently excludes external files and JSON files from linting.
* Supports project `references`.
* Doesn't execute typed rules on unchecked JavaScript files.
* Caching of lint results

## Caveats

* Additional startup time by loading Wotan and TSLint.
* Wrapping rules and formatters comes with additional runtime and memory overhead.
* For most projects there will be no noticeable difference in performance, smaller projects usually take longer to lint while bigger ones get faster.
* Minor differences in handling disable comments:
  * Disabling a previously disabled rule for a single line doesn't automatically enable the rule after that line.
  * Having a disable comment in a line that is affected by a singleline disable comment might work differently: `/* tslint:disable-line */ // tslint:disable`. Since this pattern doesn't make sense most cases this shouldn't be noticeable.

## Difference to [Heimdall](https://github.com/fimbullinter/wotan/blob/master/packages/heimdall/README.md)

This package allows you to use your existing TSLint configuration.
On the other hand you cannot use any of the builtin rules of Wotan or all those other useful configuration features like overrides, aliases, etc.
If you want to lint with your existing TSLint config *and* your new Wotan config, you need to run Wotan twice, which adds a lot of overhead.

Heimdall requires you to rewrite your linter configuration and switch to `.wotanrc.yaml` (or `.wotanrc.json` if you like that better).
In return you can use Wotans fully optimized builtin rules as well as all the other cool features.
Heimdall allows you to execute Wotan and TSLint rules in one single run.

## License

Apache-2.0 © [Klaus Meinhardt](https://github.com/ajafff)
