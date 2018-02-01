# The Fimbullinter project - Wotan

Pluggable TypeScript and JavaScript linter

[![Greenkeeper badge](https://badges.greenkeeper.io/fimbullinter/wotan.svg)](https://greenkeeper.io/)
[![CircleCI](https://circleci.com/gh/fimbullinter/wotan/tree/master.svg?style=shield)](https://circleci.com/gh/fimbullinter/wotan/tree/master)
[![Build status](https://ci.appveyor.com/api/projects/status/a28dpupxvjljibq3/branch/master?svg=true)](https://ci.appveyor.com/project/ajafff/wotan/branch/master)
[![codecov](https://codecov.io/gh/fimbullinter/wotan/branch/master/graph/badge.svg)](https://codecov.io/gh/fimbullinter/wotan)
[![Join the chat at https://gitter.im/fimbullinter/wotan](https://badges.gitter.im/fimbullinter/wotan.svg)](https://gitter.im/fimbullinter/wotan)

## Available Packages

### Wotan [![docs](https://img.shields.io/badge/%40fimbul%2Fwotan-docs-blue.svg)](https://github.com/fimbullinter/wotan/tree/master/packages/wotan#readme)

The main linter runtime with a well-chosen set of builtin rules.
Customizable with your own rules, processors, formatters, shareable configurations and plugin modules.

Please refer to the [docs](https://github.com/fimbullinter/wotan/tree/master/packages/wotan#readme) for a detailed explanation of available rules, configuration and usage.

### Vé [![docs](https://img.shields.io/badge/%40fimbul%2Fve-docs-blue.svg)](https://github.com/fimbullinter/wotan/tree/master/packages/ve#readme)

Official processor for Vue Single File Components (SFC). Extracts the script content from your `*.vue` files for linting.

### Heimdall [![docs](https://img.shields.io/badge/%40fimbul%2Fheimdall-docs-blue.svg)](https://github.com/fimbullinter/wotan/tree/master/packages/heimdall#readme)

Compatibility layer to allow the use of TSLint rules and formatters inside the Wotan runtime.

### Bifröst [![docs](https://img.shields.io/badge/%40fimbul%2Fbifrost-docs-blue.svg)](https://github.com/fimbullinter/wotan/tree/master/packages/bifrost#readme)

Allows TSLint rule or formatter authors to provide their rules for the use inside Wotan. Rules and formatters that use Bifröst don't need Heimdall to function correctly.

## What is this all about?

### What's up with those names?

Norse mythology:

Wotan is one of the many names of Odin, the All-Father. You may also know him by the name Woden, Wodan, Wensley, etc. Woden is a sacrificial god, bloodthirsty and cruel.
He is constantly striving for wisdom. From his throne he can see everything in the nine worlds happening.

Vé is the youngest of the three bothers Woden, Vili and Vé who sley the giant Ymir and created the nine worlds from his body.

> To the first human couple, Ask and Embla, Odin gave soul and life; Vili gave wit (intelligence) and sense of touch; and Vé gave countenance (appearance, facial expression), speech, hearing, and sight.

Heimdall (also known as Heimdallr) located where the burning rainbow bridge Bifröst meets heaven keeps watch for the onset of Ragnarök.

Bifröst is the burning rainbow bridge that connects the world of humans with the realm of gods.

### Why yet another linter?

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
- [x] Lazy loading of rules to reduce startup time.
  - TSLint already does that
  - ESLint expects plugins to provide the rules as already loaded objects. That causes a lot of overhead if you only use a few rules of a big package.
- [x] Caching of file system access and configuration. As the Cache is a DI service, API users can clear the cache when needed.
- [x] Support for processors from the beginning. Enabling linting of *.vue files and many more.
- [x] Aliases for rules with configuration. Can be used to treat rules like ESLint's `no-resticted-syntax` as distinct named rules for each config option.
- [x] The whole API is powered by a DI container. That makes it easy to inject a different service. Rules have access to a limited set of DI bindings.

### Differences to TSLint

* To extend a plugin or shareable config, use `extends: plugin-name`. The name will be resolved according to node's module resolution algorithm relative to the config file.
* To use rules maintained inside your project, use `rulesDirectory: {"my-prefix": "./path/to/rules"}` and configure them as `my-prefix/rule-one: "error"`. The rules directory is a path relative to the config file.
* Overrides: You can override the main cofiguration by specifying one or more overrides. If the filename matches the glob pattern of the override, all settings provided by that override are applied. Overrides are processed in order, later overrides override settings from preceding overrides.
  * patterns match relative to the configuration file they are specified in
  * patterns without a slash are only matched against the basename of each file
  * to limit a match to the current directory, prefix the pattern with `./`
  * a negated pattern resets any prior matches
* `linterOptions.exclude` -> `exclude`
  * excludes are not overridden when extending a configuration
  * pattern matching follows the same rules as overrides (see above)
* JSON5 support for config files
* Global settings that rules can pick up
* Processors, even supports `--project`
* Aliases, see above
* Fixing excludes overlapping replacements and runs a configurable number of iterations per file
* Fixing with `--project` does not create the whole program from scratch, which makes it blazingly fast.
* Testing
  * Tests are configured in JSON files that can configure everything you can specify though the CLI
  * Test files don't contain error markup. That avoids syntax errors and makes them easier to maintain. Lint results and fixed content are stored in separate baseline files.

## Supported Environments

This module runs on all actively supported versions of node.js starting from v6.12.3. Since node.js v4.x will be dumped in the first half of 2018 I didn't bother to support it.

This package officially supports the latest stable version of TypeScript. We try to make it compatible all the way back to v2.4.1 although some rules might behave differently due to changes in the type system.
We try to support TypeScript's nightly builds (`typescript@next`), but there is no guarantee.

Custom rules should at least use ES6 to have support for native classes. Otherwise you run into problems when trying to extend classes exported from this module.

## Semantic Versioning (SemVer policy)

:warning: The following policy does only apply for the yet to come 1.x and following releases. Every release in the 0.x range is considered experimental. There can and will be breaking API changes without deprecation.

In theory every change to a rule can break users and could be considered a breaking change. To avoid releasing a new major version for every bug fix, we have slightly different guidelines as outlined below.

### Prereleases (nightly builds)

* are not guaranteed to be stable
* contains the latest changes intended for the next release
  * `x.0.0-dev*` contains all changes including breaking ones for the next major version
  * `x.y.0-dev*` contains all changes for the next minor version
  * there are no prereleases for patch versions

### Patch Releases

* fixes crashes
* fixes regressions
* refactorings of internal functionality that don't change user facing behavior

### Minor Releases

* adds new rules, rule options, formatters, processors, APIs
* rules can add new checks that may lead to new failures
* new rules and options are enabled in `wotan:latest`
* rules can change their failure messages
* formatters intended for human consumtion (e.g. `stylish`) can change their output
* rules, rule options, formatters, processors and APIs can be deprecated
* new configuration options can be added to configuration files

### Major Releases

* contains breaking API changes
* removes previously deprecated rules, options, formatters, etc.
* formatters intended for machine consumption (e.g. `json` or `tap`) can change their output
* `wotan:recommended` is updated to the content of `wotan:latest`

## Release Schedule

Currently there is no fixed release schedule.
Nightly builds are published every night if there are changes on master.
Patch releases are published as soon as bugs are identified and fixed.
Minor releases are published every week or two if there changes on master.
Major releases are published once enough breaking changes have piled up.

## License

Apache-2.0 © [Klaus Meinhardt](https://github.com/ajafff)
