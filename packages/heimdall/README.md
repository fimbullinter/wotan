# Heimdall

Wotan module to use TSLint rules and formatters.

[![npm version](https://img.shields.io/npm/v/@fimbul/heimdall.svg)](https://www.npmjs.com/package/@fimbul/heimdall)
[![npm downloads](https://img.shields.io/npm/dm/@fimbul/heimdall.svg)](https://www.npmjs.com/package/@fimbul/heimdall)
[![Greenkeeper badge](https://badges.greenkeeper.io/fimbullinter/wotan.svg)](https://greenkeeper.io/)
[![CircleCI](https://circleci.com/gh/fimbullinter/wotan/tree/master.svg?style=shield)](https://circleci.com/gh/fimbullinter/wotan/tree/master)
[![Build status](https://ci.appveyor.com/api/projects/status/a28dpupxvjljibq3/branch/master?svg=true)](https://ci.appveyor.com/project/ajafff/wotan/branch/master)
[![codecov](https://codecov.io/gh/fimbullinter/wotan/branch/master/graph/badge.svg)](https://codecov.io/gh/fimbullinter/wotan)
[![Join the chat at https://gitter.im/fimbullinter/wotan](https://badges.gitter.im/fimbullinter/wotan.svg)](https://gitter.im/fimbullinter/wotan)

Make sure to also read the [full documentation of all available modules](https://github.com/fimbullinter/wotan#readme).

## Purpose

Enable the use of TSLint rules and formatters.

## Installation

```sh
npm install --save-dev @fimbul/wotan @fimbul/heimdall
# or
yarn add -D @fimbul/wotan @fimbul/heimdall
```

## Using TSLint Formatters

```sh
wotan -m @fimbul/heimdall -f code-frame
```

`-f code-frame` refers to the TSLint core CodeFrameFormatter.

The `-m @fimbul/heimdall` argument enables a hook that loads TSLint formatters if no Wotan formatter is found.
That means you cannot use a TSLint formatter when a builtin Wotan formatter with the same name exists.

## Using TSLint Rules

To enable Heimdall, add the `-m @fimbul/heimdall` argument when running `wotan` from CLI.

```sh
wotan -m @fimbul/heimdall
```

Specifying TSLint rules in your `.wotanrc.yaml` works as follows. Note that you need to specify a prefix for TSLint rules (`tslint/` in this example)

```yaml
---
rulesDirectories:
  tslint: . # enables TSLint core rules
  tcc: tslint-consistent-codestyle/rules # enables custom TSLint rules provided by the package 'tslint-consistent-codestyle'. the path may be different for each package
rules:
  no-unused-expression: error # without prefix this is a Wotan core rule
  tslint/no-unused-expression: error # with prefix this refers to the TSLint core rule
  tslint/semicolon: # TSLint core rule 'semicolon' with option 'always'
    options: always
  tcc/no-unused: error # 'no-unused' from tslint-consistent-codestyle
```

## Why!?

Why should you use Wotan to execute TSLint rules?

* Allows you to reuse existing rules and rules packages without any modification.
* Enables the use of processors, to lint for example Vue Single File Components (see [`@fimbul/ve`](https://github.com/fimbullinter/wotan/blob/master/packages/ve/README.md)), that are currently not supported by TSLint.
* Configuration goodness provided by Wotan:
  * Overrides to change the config by matching glob patterns.
  * You can use a rule with the same name from different packages. Because you need to specify a prefix for every package, rules won't get overidden by other packages.
  * Aliases
  * JSON5 support
* Blazingly fast autofixing, especially when linting the whole project with the `-p` flag.
* Smart handling of overlapping fixes avoids destroying your code.

## License

Apache-2.0 © [Klaus Meinhardt](https://github.com/ajafff)
