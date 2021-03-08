# Heimdall

Wotan module to use TSLint rules and formatters.

[![npm version](https://img.shields.io/npm/v/@fimbul/heimdall.svg)](https://www.npmjs.com/package/@fimbul/heimdall)
[![npm downloads](https://img.shields.io/npm/dm/@fimbul/heimdall.svg)](https://www.npmjs.com/package/@fimbul/heimdall)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovateapp.com/)
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
Note that findings with severity `suggestion` are reported as `warning` through TSLint formatters.

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
  tcc: ./node_modules/tslint-consistent-codestyle/rules # enables custom TSLint rules provided by the package 'tslint-consistent-codestyle'. the path may be different for each package
rules:
  no-unused-expression: error # without prefix this is a Wotan core rule
  tslint/no-unused-expression: error # with prefix this refers to the TSLint core rule
  tslint/semicolon: # TSLint core rule 'semicolon' with option 'always'
    options: always
  tcc/no-unused: error # 'no-unused' from tslint-consistent-codestyle
```

Since all paths in `rulesDirectories` are treated as relative paths (i.e. not resolved using node module resolution), you need to provide the relative paths for node modules as shown above.
As an alternative you can resolve the module using `require.resolve`. For this to work, you need to rename `.wotanrc.yaml` to `.wotanrc.js` and change the content as follows:

```js
const path = require('path');
module.exports = {
  rulesDirectories: {
    tslint: '.' // enables TSLint core rules
    tcc: path.dirname(require.resolve('tslint-consistent-codestyle')) // enables custom TSLint rules provided by the package 'tslint-consistent-codestyle'. the path may be different for each package
  }
  rules: {
    'no-unused-expression': 'error' // without prefix this is a Wotan core rule
    'tslint/no-unused-expression': 'error' // with prefix this refers to the TSLint core rule
    'tslint/semicolon': { // TSLint core rule 'semicolon' with option 'always'
      options: 'always'
    }
    'tcc/no-unused': 'error' // 'no-unused' from tslint-consistent-codestyle
  }
}
```


## Enable this Plugin Module in Configuration

If you want to always use this plugin module and don't want to add `-m @fimbul/heimdall` to the CLI every time, you can add it to your `.fimbullinter.yaml` file which contains default values for CLI arguments.

Use `wotan save -m @fimbul/heimdall` to create of update `.fimbullinter.yaml`. From now on Heimdall will always be loaded unless you override it with another `-m` argument.

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
* Caching
* ... and many more

## License

Apache-2.0 © [Klaus Meinhardt](https://github.com/ajafff)
