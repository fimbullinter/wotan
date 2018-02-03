# Using local Rules

Some projects have very specific linting rules. Often time these rules are developed as part of the project within the same repository.
Fortunately rules don't need to be packaged as a module to be used by Wotan. You can simply reference local rules by specifying them in `rulesDirectories`.

Let's create a sample `.wotanrc.yaml` with local rules:

```yaml
---
rulesDirectories:
  local: ./rules # every rule starting with the prefix 'local/' will be searched in './rules'
rules:
  await-promise: error # refers to a builtin rule
  local/rule-one: error # refers to './rules/rule-one.js'
  local/rule-two: error # refers to './rules/rule-two.js'
```

All paths in `rulesDirectories` are relative to the configuration file they are declared in.
That allows you to extend this configuration in a subdirectory and still get the rules from the same path.

Paths in `rulesDirectories` are **never** treated as node modules.

You don't need to use the prefix `local`. This is just an arbitrary name used in this example.
In fact you can even specify multiple `rulesDirectories` and each one of them needs to have it's own prefix.
If you extend another configuration, `rulesDirectories` with the same name are merged. The directory in the child configuration is searched first and if no rule is found, the search continues in the directory declared in the base configuration.
