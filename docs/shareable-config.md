# Writing Shareable Configurations

If you want to reuse the same configuration in multiple projects or just share your preferences with others, you can publish your configuration as package on npm (or any other registry).

Start by creating a new project and adding a `index.yaml`. You can use any other supported format if you want.
You can also use a different name or directory, in which case you need to add the correct path to the `main` field in the `package.json` of your package.
Resolving the correct file works by using [node's module resolution algorithm](https://nodejs.org/api/modules.html#modules_all_together).

Write the `index.yaml` like you would write your local `.wotanrc.yaml`. Keep in mind that all paths and modules are resolved relative to the configuration file.

Here's an example:

```yaml
---
extends:
  - foo-rules # resolves to the package 'foo-rules', make sure to add this as dependency in your package.json
  - ./base-config.yaml # you can also extend other local configurations
rules:
  core-rule: error # refers to a core rule
  foo/rule-one: error # refers to a custom rule
overrides:
  - files: '*.spec.ts' # globs without any '/' are only matched against the basename, therefore this glob is not relative to the config
    processor: some-processor # resolves to the package 'some-processor', make sure to add this as dependency in your package.json
```

Assuming you publish your package as `wotan-config-unicorn`, users can simply add `extends: wotan-config-unicorn` to their configuration and automatically extend your `index.yaml`.

## Multiple Configurations in one Package

If you have more than one configuration, you can simply add multiple `<name>.yaml` files to the root of your package. Users can then `extend: <your-package>/<name>`.

Let's assume you want to publish a recommended and strict configuration preset.
Start by adding the `recommended.yaml`:

```yaml
rules:
  rule-one: error
  rule-two: error
  rule-three: warning
```

You can then choose whether you want to extend the recommended config or write the strict configuration from scratch. Let's go with extending for now. Your `strict.yaml` could look as follows:

```yaml
extends: ./recommended.yaml
rules:
  rule-one:
    options: strict # overrides only the options of 'rule-one', severity is still 'error'
  rule-three: error # change severity of 'rule-three'
  rule-four: error # enable 'rule-four' in addition
```

Assuming you publish your package as `wotan-config-rainbow`, users can choose between `extends: wotan-config-rainbow/recommended` and `extends: wotan-config-rainbow/strict`.

If you decide to make `recommended` the default configuration, add `"main": "recommended"` to the `package.json` of your package. Now every user who does `extends: wotan-config-rainbow` automatically extends your `recommended.yaml`.
