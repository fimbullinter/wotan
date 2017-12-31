# wotan

Pluggable TypeScript and JavaScript linter

[![Greenkeeper badge](https://badges.greenkeeper.io/ajafff/wotan.svg)](https://greenkeeper.io/)

## What does "wotan" mean?

Wotan is one of the many names of Odin, the All-Father. You may also know him by the name Woden, Wodan, Wensley, etc. Woden is a sacrificial god, bloodthirsty and cruel.
He is constantly striving for wisdom. From his throne he can see everything in the nine worlds happening.

## Why yet another linter?

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
- [ ] Configurable caching of intermediate computation results.
  - Configuration per directory, scope and usage analysis, flattened AST structures, ...
  - Caching everything globally prevents tools like editor plugins to reload configuration when it might have changed.
- [ ] Support for processors from the beginning. Enabling linting of *.vue files and many more.

## Differences to TSLint

* To extend a plugin, use `extends: plugin-name`. The name will be resolved according to node's module resolution algorithm relative to the config file.
* To use rules maintained inside your project, use `rulesDirectory: {"my-prefix": "./path/to/rules"}` and configure them as `my-prefix/rule-one: "error"`. The rules directory is a path relative to the config file.
* Configuration cascading: starting from the directory of the file to lint all configuration files are picked up until one of them contains `root: true` or the root directory is reached. The nearer config overrides settings from configs further up the directory tree.
* Overrides: You can override the main cofiguration by specifying one or more overrides. If the filename matches the glob pattern of the override, all settings provided by that override are applied. Overrides are processed in order, later overrides override settings from preceding overrides.
* JSON5 support for config files
* Global settings that rules can pick up
* Processors (WIP)
