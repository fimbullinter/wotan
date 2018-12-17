# Mithotyn

TypeScript LanguageService Plugin that provides real-time in-editor linting while you type.

[![npm version](https://img.shields.io/npm/v/@fimbul/mithotyn.svg)](https://www.npmjs.com/package/@fimbul/mithotyn)
[![npm downloads](https://img.shields.io/npm/dm/@fimbul/mithotyn.svg)](https://www.npmjs.com/package/@fimbul/mithotyn)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovateapp.com/)
[![CircleCI](https://circleci.com/gh/fimbullinter/wotan/tree/master.svg?style=shield)](https://circleci.com/gh/fimbullinter/wotan/tree/master)
[![Build status](https://ci.appveyor.com/api/projects/status/a28dpupxvjljibq3/branch/master?svg=true)](https://ci.appveyor.com/project/ajafff/wotan/branch/master)
[![codecov](https://codecov.io/gh/fimbullinter/wotan/branch/master/graph/badge.svg)](https://codecov.io/gh/fimbullinter/wotan)
[![Join the chat at https://gitter.im/fimbullinter/wotan](https://badges.gitter.im/fimbullinter/wotan.svg)](https://gitter.im/fimbullinter/wotan)

Make sure to also read the [full documentation of all available modules](https://github.com/fimbullinter/wotan#readme).

## Installation

```sh
npm install --save-dev @fimbul/wotan @fimbul/mithotyn
# or
yarn add -D @fimbul/wotan @fimbul/mithotyn
```

## Usage

To enable this plugin, you need to add `@fimbul/mithotyn` as plugin in your `tsconfig.json`. For example:

```js
{
  "compilerOptions": {
    "plugins": [
      { "name": "@fimbul/mithotyn" }
    ],
    // your existing compilerOptions
    "strict": true,
  }
}
```

Make sure you have `@fimbul/wotan` installed in the project directory or a parent directory.

### Configuration Options

To customize your in-editor linting experience you can use the following configuration options:

* `displayErrorsAsWarnings: boolean`: Report failures with severity `error` as warning to make them distinguishable from real type errors (e.g. green instead of red squiggles in VS Code)

Example:

```js
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@fimbul/mithotyn",
        "displayErrorsAsWarnings": true
      }
    ],
    // your existing compilerOptions
    "strict": true,
  }
}
```

### Usage in VS Code

In Visual Studio Code you can choose between the version of TypeScript that comes bundled with the editor or the local one installed in the workspace.
Due to technical limitations you need to choose the workspace version to correctly pick up the plugin configured in the previous section.

* open command palette while a TypeScript or JavaScript file is opened
* select `TypeScript: Select TypeScript Version.`
* select `Use Workspace Version`

Other editors might work the same as VS Code.

To work around this limitation there will be an editor plugin that automatically loads this LanguageService plugin. Stay tuned.

## Limitations

There are some limitations of the current implementation. These are subject to change in future releases.

* Currently only works with TypeScript installed in your workspace, see [Usage in VS Code](#usage-in-vs-code)
* doesn't use global options from `.fimbullinter.yaml`
  * no plugin modules
  * no fixed `config` option
  * no `files` matching
  * no `exclude` option
* doesn't provide code fixes for rule failures
* doesn't validate `.wotanrc.yaml` and `.fimbullinter.yaml` files

## License

Apache-2.0 © [Klaus Meinhardt](https://github.com/ajafff)
