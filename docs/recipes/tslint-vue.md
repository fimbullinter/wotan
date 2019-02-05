# Linting Vue files with TSLint

This recipe explains how to configure Wotan to use your existing `tslint.json` configuration and lint Vue files.

## The Problem

TSLint does not support processors. That means you [cannot lint Vue Single File Components](https://github.com/palantir/tslint/issues/2099) with plain TSlint.
Linting Vue files with a combination of Webpack, vue-loader, ts-loader and tslint-loader might work, but is pretty slow and cumbersome.

## The Solution

1. Install
    ```sh
    yarn add -D @fimbul/wotan @fimbul/ve @fimbul/valtyr
    # or
    npm install --save-dev @fimbul/wotan @fimbul/ve @fimbul/valtyr
    ```
2. Configure
    Add a new file `.fimbullinter.yaml` in the root directory of your project and add the following content:
    ```yaml
    modules: "@fimbul/valtyr"
    valtyr:
      overrides:
        - files: "*.vue"
          processor: "@fimbul/ve"
    ```
3. Run
    See examples below and adapt for your own use. Read the docs for more information about available CLI arguments.
    ```sh
    wotan # finds tsconfig.json and lints the whole project with type information according to your tslint.json
    wotan 'src/**/*.vue' -f verbose # lint all Vue files, use TSLint's verbose formatter
    wotan -p tsconfig.json -c tslint.json --fix # lint the whole project with tslint.json and fix findings
    ```
4. Further Reading

    [Wotan](../../packages/wotan#readme) - CLI and configuration

    [Valtýr](../../packages/valtyr#readme) - plugin for TSLint rules and formatters - "the TSLint runtime that's better than TSLint"

    [Vé](../../packages/ve#readme) - processor for Vue single file components

Note that the above configuration will load the `@fimbul/valtyr` plugin module everytime you execute `wotan`.
With that plugin enabled you cannot use Wotan's default functionality like `.wotanrc.yaml` for configuration or builtin rules and formatters.
If you want both, you should remove the `modules: "@fimbul/valtyr"` configuration from `.fimbullinter.yaml` and instead add `-m @fimbul/valtyr` as CLI argument everytime you want to use the TSLint functionality.
