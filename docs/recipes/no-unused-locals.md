# Detect Unused Variables

This recipe explains how to configure Wotan to detect unused variables and imports.

## The Problem

TypeScript has the option `noUnusedLocal` to detect unused variables and imports. The resulting failures are treated like any other compile error.
Sometimes you need to keep a variable or import. For example if you are compiling with the `declaration` option enabled and get the error [`XXX has or is using name 'Foo' from external module "../bar" but cannot be named`](https://github.com/Microsoft/TypeScript/issues/9944).
As a workaround you could just drop in some `// @ts-ignore` comments. But that also disables all other errors on that line.

TSLint's rule `no-unused-variable` uses TypeScripts `noUnusedLocals` internally and reports the result as lint errors.
The rule tries to work around [Microsoft/TypeScript#9944](https://github.com/Microsoft/TypeScript/issues/9944) but isn't very effective as there are still false positives.
In addition that rule has some pretty nasty side effects [palantir/tslint#2736](https://github.com/palantir/tslint/issues/2736) [palantir/tslint#2649](https://github.com/palantir/tslint/issues/2649) and is pretty damn slow.

## The Solution

Wotan has a builtin rule to report type checking errors as lint failures: `typecheck`.
You can use this rule together with a special `tsconfig.json` to report `noUnusedLocals` errors as lint failures.

1. Enable `typecheck` in your `.wotanrc.yaml`:
    ```yaml
    rules:
      # your other rules go here
      typecheck: error # could also be 'warning'
    ```
2. Disable `noUnusedLocals` in your `tsconfig.json` you use to compile your program.
3. Add a new `tsconfig.lint.json` (you can choose another name if you prefer) that extends your `tsconfig.json` (the one used for compiling) and enable `noUnusedLocals`
    ```json
    {
      "extends": "./tsconfig.json", // the name of your existing tsconfig.json
      "compilerOptions": {
        "noUnusedLocals": true
      }
    }
    ```
4. Run the linter with your new `tsconfig.lint.json`
    ```sh
    wotan -p tsconfig.lint.json
    ```

You will now see `'Foo' is declared but its value is never read.` as lint failures instead of compile errors.
You can now use a `// wotan-disable-line typecheck` comment to suppress the failure in that line.

You continue to use the original `tsconfig.json` for compiling. That way TypeScript can report any other error while unused variables or imports are reported by Wotan.
