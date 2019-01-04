# The Fimbullinter project

Pluggable TypeScript and JavaScript linter

[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovateapp.com/)
[![CircleCI](https://circleci.com/gh/fimbullinter/wotan/tree/master.svg?style=shield)](https://circleci.com/gh/fimbullinter/wotan/tree/master)
[![Build status](https://ci.appveyor.com/api/projects/status/a28dpupxvjljibq3/branch/master?svg=true)](https://ci.appveyor.com/project/ajafff/wotan/branch/master)
[![codecov](https://codecov.io/gh/fimbullinter/wotan/branch/master/graph/badge.svg)](https://codecov.io/gh/fimbullinter/wotan)
[![Join the chat at https://gitter.im/fimbullinter/wotan](https://badges.gitter.im/fimbullinter/wotan.svg)](https://gitter.im/fimbullinter/wotan)

## Available Packages

### Wotan [![docs](https://img.shields.io/badge/%40fimbul%2Fwotan-docs-blue.svg)](https://github.com/fimbullinter/wotan/tree/master/packages/wotan/README.md)

The main linter runtime with a well-chosen set of builtin rules.
Customizable with your own rules, processors, formatters, shareable configurations and plugin modules.

Please refer to the [docs](https://github.com/fimbullinter/wotan/tree/master/packages/wotan/README.md) for a detailed explanation of available rules, configuration and usage.

### Vé [![docs](https://img.shields.io/badge/%40fimbul%2Fve-docs-blue.svg)](https://github.com/fimbullinter/wotan/tree/master/packages/ve/README.md)

Official processor for Vue Single File Components (SFC). Extracts the script content from your `*.vue` files for linting.

### Heimdall [![docs](https://img.shields.io/badge/%40fimbul%2Fheimdall-docs-blue.svg)](https://github.com/fimbullinter/wotan/tree/master/packages/heimdall/README.md)

Compatibility layer to allow the use of TSLint rules and formatters inside the Wotan runtime.

### Valtýr [![docs](https://img.shields.io/badge/%40fimbul%2Fvaltyr-docs-blue.svg)](https://github.com/fimbullinter/wotan/tree/master/packages/valtyr/README.md)

Make wotan behave almost like TSLint. Reuse your existing `tslint.json` without any change.

### Bifröst [![docs](https://img.shields.io/badge/%40fimbul%2Fbifrost-docs-blue.svg)](https://github.com/fimbullinter/wotan/tree/master/packages/bifrost/README.md)

Allows authors of TSLint rules and formatters to provide their package for the use inside Wotan. Rules and formatters that use Bifröst don't need Heimdall to function correctly.

### Ymir [![docs](https://img.shields.io/badge/%40fimbul%2Fymir-docs-blue.svg)](https://github.com/fimbullinter/wotan/tree/master/packages/ymir/README.md)

Provides core types for custom rules and plugin authors.

### Mímir [![docs](https://img.shields.io/badge/%40fimbul%2Fmimir-docs-blue.svg)](https://github.com/fimbullinter/wotan/tree/master/packages/mimir/README.md)

Contains all core rules, formatters and configuration presets.

### Mithotyn [![docs](https://img.shields.io/badge/%40fimbul%2Fmithotyn-docs-blue.svg)](https://github.com/fimbullinter/wotan/tree/master/packages/mithotyn/README.md)

LanguageService Plugin for TypeScript. Provides real-time in-editor linting while you type.

## Further Documentation

* [Understanding TypeScript's API](https://github.com/fimbullinter/wotan/blob/master/docs/understanding-typescript-api.md)
* [Writing Rules](https://github.com/fimbullinter/wotan/blob/master/docs/writing-rules.md)
* [Using local Rules](https://github.com/fimbullinter/wotan/blob/master/docs/local-rules.md)
* [Writing Shareable Configurations](https://github.com/fimbullinter/wotan/blob/master/docs/shareable-config.md)
* [Using the API](https://github.com/fimbullinter/wotan/blob/master/docs/api.md)

### Recipes

* [Linting Vue files with TSLint rules](https://github.com/fimbullinter/wotan/blob/master/docs/recipes/tslint-vue.md)
* [Replacement for `tslint --type-check`](https://github.com/fimbullinter/wotan/blob/master/docs/recipes/tslint-type-check.md)
* [Detect Unused Variables](https://github.com/fimbullinter/wotan/blob/master/docs/recipes/no-unused-locals.md)

## What is this all about?

### What's up with those names?

Norse mythology:

**Fimbullinter** comes from Fimbulwinter, the awful 3 years lasting winter that precedes the events of Ragnarök. 'fimbul' means 'the great', 'linter' is a tool that detects and warns about certain coding patterns.

**Wotan** is one of the many names of Odin, the All-Father. You may also know him by the name Woden, Wodan, Wensley, etc. Woden is a sacrificial god, bloodthirsty and cruel.
He is constantly striving for wisdom. From his throne he can see everything in the nine worlds happening.

**Vé** is the youngest of the three bothers Woden, Vili and Vé who together slew the giant Ymir and created the nine worlds from his body.

> To the first human couple, Ask and Embla, Odin gave soul and life; Vili gave wit (intelligence) and sense of touch; and Vé gave countenance (appearance, facial expression), speech, hearing, and sight.

**Heimdall** (also known as Heimdallr), located where the burning rainbow bridge Bifröst meets heaven, keeps watch for the onset of Ragnarök.

**Bifröst** is the burning rainbow bridge that connects the world of humans with the realm of gods.

**Valtýr**, from "valr" (the dead, slain in battle) and "týr" (god), means God of the Slain and is often used to refer to Odin.

**Ymir** is the giant of whose body the whole world was created. He is the ancestor of all jötnar.

**Mímir** ("The rememberer, the wise one") renowned for his knowledge and wisdom. The god Odin carries around Mímir's head and it recites secret knowledge and counsel to him.

**Mithotyn** (actually "Mitoðinn", meaning "dispenser of fate") introduces rules where there were none. Fills Odin's place during his travels to foreign lands.

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
- [x] The whole API is powered by a DI container. That makes it easy to inject a different service. You can even use plugins through the CLI to inject different services.
- [x] "Global" configuration file (besides `.wotanrc.yaml`) for CLI defaults and plugin configuration: `.fimbullinter.yaml`. This file can be used by editor plugins as well, so there's no need to duplicate common configuration.
  - ESLint doesn't have such a file and declined to add one in the future. Tools like `standard` or `xo` wouldn't need to exist if you just needed to create such a config file with CLI defaults.
  - TSLint startet to stuff it into their `tslint.json` which leads to confused users.

### Differences to TSLint

* To extend a plugin or shareable config, use `extends: plugin-name`. The name will be resolved according to node's module resolution algorithm relative to the config file.
* To use rules maintained inside your project, use `rulesDirectory: {"my-prefix": "./path/to/rules"}` and configure them as `my-prefix/rule-one: "error"`. The rules directory is a path relative to the config file.
* Overrides: You can override the main cofiguration by specifying one or more overrides. If the filename matches the glob pattern of the override, all settings provided by that override are applied. Overrides are processed in order, later overrides override settings from preceding overrides.
  * Patterns match relative to the configuration file they are specified in.
  * Patterns without a slash are only matched against the basename of each file.
  * To limit a match to the current directory, prefix the pattern with `./`.
  * Negated patterns can be used to subtract from the matches of preceding patterns.
* `linterOptions.exclude` -> `exclude`
  * Excludes are not overridden when extending a configuration.
  * Pattern matching follows the same rules as overrides (see above).
* JSON5 support for config files.
* Rule-independent settings that rules and processors can pick up.
* Processors, even supports `--project`.
* Aliases, see above
* A sane and safe approach to fixing:
  * Doesn't fix files with syntax errors.
  * Excludes overlapping replacements to prevent destroying your code.
  * Runs a configurable number of iterations per file to apply conflicting changes in the next iteration.
  * Stops if fixes would introduce syntax errors.
  * Fixing with `--project` does *not* create the whole program from scratch, which makes it blazingly fast.
* Testing
  * Tests are configured in JSON files that can configure everything you can specify though the CLI
  * Test files don't contain error markup. That avoids syntax errors and makes them easier to maintain. Lint results and fixed content are stored in separate baseline files.
  * The same code can be tested with different settings.
* Supports TypeScript project references.
* Loads default values for CLI options from `.fimbullinter.yaml`
* Doesn't use type information in unchecked JavaScript files (`// @ts-nocheck` or `"checkJs": false`).

## Supported Environments

This project runs on all actively supported versions of Node.js.

This project officially supports the latest 3 stable version of TypeScript. As of writing this is 3.0 - 3.2. It *should* work with TypeScript's nightly builds (`typescript@next`), but there is no guarantee.

Custom rules should at least use ES6 to have support for native classes. Otherwise you run into problems when trying to extend classes exported from any of the packages.

## Semantic Versioning (SemVer policy)

:warning: The following policy does only apply for the yet to come 1.x and following releases. Every release in the 0.x range is considered experimental. There can and will be breaking API changes without deprecation.

In theory every change to a rule can break users and could be considered a breaking change. To avoid releasing a new major version for every bug fix, we have slightly different guidelines as outlined below.

### Prereleases (nightly builds)

* are not guaranteed to be stable
* tagged as `next` on npm so you can install `@fimbul/wotan@next`
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
* rules can add new checks that may lead to new findings
* new rules and options are enabled in `wotan:latest`
* rules can change their finding messages
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
Minor releases are published every week or two if there are changes on master.
Major releases are published once enough breaking changes have piled up.

## License

Apache-2.0 © [Klaus Meinhardt](https://github.com/ajafff)
