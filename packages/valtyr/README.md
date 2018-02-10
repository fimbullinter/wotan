# Valtýr

Wotan module to lint according to your existing `tslint.json` and `tslint:disable` comments.

[![npm version](https://img.shields.io/npm/v/@fimbul/valtyr.svg)](https://www.npmjs.com/package/@fimbul/valtyr)
[![npm downloads](https://img.shields.io/npm/dm/@fimbul/valtyr.svg)](https://www.npmjs.com/package/@fimbul/valtyr)
[![Greenkeeper badge](https://badges.greenkeeper.io/fimbullinter/wotan.svg)](https://greenkeeper.io/)
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

`-f code-frame` refers to the TSLint core CodeFrameFormatter.

The `-m @fimbul/valtyr` argument enables this package. It searches `tslint.json` (or `tslint.yaml`) files for configuration like TSLint does. It loads TSLint core rules as well as custom rules with the same rules as TSLint. It uses TSLint formatters to format the result.

There are only minor differences:

* CLI arguments are still those of the Wotan executable
* error messages are a bit different
* `stylish` formatter is used by default

## Why!?

Why should you use Wotan to execute TSLint rules?

* Allows you to use your existing configuration, rules and formatters without modification.
* Avoids using two different lint tool during migration to Wotan.
* Blazingly fast autofixing, especially when linting the whole project with the `-p` flag.
* Smart handling of overlapping fixes avoids destroying your code.
* Allows the use of builtin configurations and shareable configs as CLI argument for `-c`, e.g. `-c tslint:latest` or `-c tslint-config-airbnb`.
* Debug output to diagnose crashes.

## Difference to Heimdall

This package allows you to use your existing TSLint configuration.
On the other hand you cannot use any of the builtin rules of Wotan or all those other useful features like processors, overrides, aliases, etc.
If you want to lint with your existing TSLint config *and* your new Wotan config, you need to run Wotan twice, which adds a lot of overhead.

Heimdall requires you to rewrite your linter configuration and switch to `.wotanrc.yaml` (or `.wotanrc.json` if you like that better).
In return you can use Wotans fully optimized builtin rules as well as all the other cool features.
Heimdall allows you to execute Wotan and TSLint rules in one single run.

## License

Apache-2.0 © [Klaus Meinhardt](https://github.com/ajafff)
