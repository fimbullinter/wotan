# Replacement for `tslint --type-check`

This recipe explains how to include syntactic and semantic compile errors in the linter output.

## The Problem

TSLint used to have an option `--type-check` that checked if the whole project had any error before doing the actual linting.
Some users relied on TSLint also reporting compile errors so they only need a single tool to verify their code, e.g. as precommit hook: [palantir/tslint#3399](https://github.com/palantir/tslint/issues/3399).

While working most of the time, there were some obvious issues:

* errors in excluded files are reported: [palantir/tslint#3321](https://github.com/palantir/tslint/issues/3321), [palantir/tslint#3069](https://github.com/palantir/tslint/issues/3069)
* errors can not be disables using `// tslint:disable`: [palantir/tsint#3242](https://github.com/palantir/tslint/issues/3242)
* output is not formatted with the configured formatter: [palantir/tslint#2809](https://github.com/palantir/tslint/issues/2809), [palantir/tslint#2388](https://github.com/palantir/tslint/issues/2388)
* outfile option is ignored: [palantir/tslint#2539](https://github.com/palantir/tslint/issues/2539)
* some other strange errors, mostly missing declarations or wrong library files

In the end TSLint 5.7.0 deprecated this option because most of the issues were not actionable.

## The Solution

Wotan has two builtin rules to report syntactic and semantic errors as lint failures: `syntaxcheck` and `typecheck`. Both rules need type information (`-p` CLI argument) to work.

1. Enable both rules in your `.wotanrc.yaml`:
    ```yaml
    rules:
      # your other rules go here
      syntaxcheck: error # could also be 'warning'
      typecheck: error # could also be 'warning'
    ```
2. Run Wotan with type information
   ```sh
   wotan -p tsconfig.json
   ```

Note that especially `typecheck` might take some time to complete.

Since errors are reported as lint failures, you can choose the severity, disable specific errors and get the result formatted as expected.
In addition these rules, like any other rule, operate only on the files you want to lint.

You can also use these rules in addition with processors. As an example you can apply both rules to Vue Single File Components using [`@fimbul/ve`](../../packages/ve#readme).
