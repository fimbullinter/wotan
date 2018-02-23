# Vé

Wotan processor for Vue Single File Components (SFC)

[![npm version](https://img.shields.io/npm/v/@fimbul/ve.svg)](https://www.npmjs.com/package/@fimbul/ve)
[![npm downloads](https://img.shields.io/npm/dm/@fimbul/ve.svg)](https://www.npmjs.com/package/@fimbul/ve)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovateapp.com/)
[![CircleCI](https://circleci.com/gh/fimbullinter/wotan/tree/master.svg?style=shield)](https://circleci.com/gh/fimbullinter/wotan/tree/master)
[![Build status](https://ci.appveyor.com/api/projects/status/a28dpupxvjljibq3/branch/master?svg=true)](https://ci.appveyor.com/project/ajafff/wotan/branch/master)
[![codecov](https://codecov.io/gh/fimbullinter/wotan/branch/master/graph/badge.svg)](https://codecov.io/gh/fimbullinter/wotan)
[![Join the chat at https://gitter.im/fimbullinter/wotan](https://badges.gitter.im/fimbullinter/wotan.svg)](https://gitter.im/fimbullinter/wotan)

Make sure to also read the [full documentation of all available modules](https://github.com/fimbullinter/wotan#readme).

## Purpose

Enable `wotan` to lint `*.vue` files. This works by extracting the `<script>` content of a single file component and feeding that into TypeScript.
The `lang` attribute is respected and defaults to `js` if not present. You can use every language TypeScript supports (currently `js`, `jsx`, `ts`, `tsx`).
It even works with type checking.


## Installation

```sh
npm install --save-dev @fimbul/wotan @fimbul/ve
# or
yarn add -D @fimbul/wotan @fimbul/ve
```

## Usage

Use as processor in your config:

```yaml
---
overrides:
  - files: "*.vue"
    processor: "@fimbul/ve"
```

There's also a configuration preset you can extend. This preset comes without any enabled rules and just provides the processor for `*.vue` files as described above.

```yaml
---
extends:
  - "@fimbul/ve"
```

## License

Apache-2.0 © [Klaus Meinhardt](https://github.com/ajafff)
