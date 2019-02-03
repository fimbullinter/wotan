# Testing Rules

Testing rules serves one main purpose: making sure they don't annoy the heck out of users.

There are several aspects of testing to ensure a rule works as intended:

* doesn't crash on syntactially valid *and* invalid code
* works with different configuration values
* excludes certain files if necessary
* uses type information if necessary and available
  * and correctly picks up different `compilerOptions`
* reports findings at the relevant locations
  * with the correct error spans
  * and doesn't report false-positives anywhere else
* fixable findings actually have a fixer
  * a single fix contains no overlapping changes
  * fixes don't cause syntax errors
  * fixes produce the correct output

Fortunately you don't have to write a script to test all of this. You can simply use the `wotan test` subcommand to verify a set of test configurations.

```
wotan test [-u|--bail] [--exact] [--] [files ...]

  files
    Any number of paths or glob patterns that resolve to `*.test.json` files.
    Each of these files contains the configuration for one test.
    Tests are executed in the specified order.

  -u, --update
    Update baselines to match the current output, removing and adding files as necessary.
    Always returns with exit code 0.

  --bail
    Abort on the first mismatching baseline. This option has no effect if '-u' is used.

  --exact
    Report all baselines that were not used to verify any output of the current test.
    This option should be enabled to detect missing outputs: if there is a `.fix` baseline you expect
    your rule to apply fixes. If it didn't produce any fix output that's most likely an error.
```

## Baselines

So what exactly are "baselines"?

Baselines are files that act as reference of the expected output of a test. You could create and update these files manually and call it "test driven development". Or you simply use the `-u` option to create or update baselines if you expect changes.

After reviewing the changed baselines, you should check them into source control together with your rule changes.

Baselines are stored in a folder next to your tests. If you execute `wotan test -u tests/my-rule/default.test.json` it creates a folder `baselines/my-rule/default/` in which all baselines of that test are stored.

There are two different kinds of baseline files that can be created by a test: `<filename>.lint` for the finding output and `<filename>.fix` for the fixed code if there are fixable findings.

### `.lint` Baselines

Every file included in the test has an associated `<filename>.lint` baseline. These files contain the linted code with special markup to show where a rule added a finding. Here are some examples:

```
let foo: any;
       ~nil   [warning whitespace: Missing whitespace.]
         ~~~  [error no-any: Type 'any' is forbidden.]
foo
~~~
  + 1;
~~~~~~ [error no-unused-expression: This expression is unused. Did you mean to assign a value or call a function?]
```

The squiggly lines show the location where a finding is added. If the span has a length of 0 it's displayed as `~nil`.
A finding can span multiple lines. In that case only the last line contains the finding information in brackets.
If a line contains multiple findings each finding is displayed in a new line below the offending code.

### `.fix` Baselines

Files that contain findings with fixes produce a `<filename>.fix` baseline. You can explicitly disable fixing in each test configuration.
The fix output is computed in the same way `wotan lint --fix` works:

* doesn't fix files with syntax errors
* tries a certain number of iterations
* defers overlapping changes to the next iteration
* rolls back the last set of fixes and aborts if fixes caused syntax errors

## Test Configuration

By convention a test configuration's name is `<testname>.test.json` where `<testname>` is used in the path of the baseline directory for that test.
A test configuration is basically a JSON file that contains a serialized version of the CLI options you would normally pass to `wotan lint`.

```ts
interface TestOptions {
    config?: string | undefined;
    files?: string | ReadonlyArray<string>;
    exclude?: string | ReadonlyArray<string>;
    project?: string | ReadonlyArray<string>;
    references?: boolean;
    fix?: boolean | number;
    extensions?: string | ReadonlyArray<string>;
    reportUselessDirectives?: Severity | boolean;
    typescriptVersion?: string;
}
```

All paths and glob patterns are relative to the directory containing the test configuration.
`fix` is implicitly enabled. If you do not want to produce `.fix` baselines for this test, you need to explicitly disable the `fix` option.

Since tests use the same functionality as the normal linter, there are a few things to be aware of:

* If no `files` or `project` is specified, it looks for a `tsconfig.json` in the current or a parent directory.
* Specifiying `files` disables the implicit `tsconfig.json` lookup. If you want to test with type information and filter files using `files`, you need to specify `project` as well.
* If no `config` is specified, it looks for the closest `.wotanrc.yaml`. You should make sure that it finds the correct `.wotanrc.yaml` for that test and not the `.wotanrc.yaml` in the root of your project that is used to lint your source code.

You can have multiple test configurations per folder. That means you can test the same code with different rule configs or different `compilerOptions`.

If you test your rules with multiple versions of TypeScript (in CI or locally), you probably want to have tests that use new language features or syntax. Older versions of TypeScript don't know about these language features and might cause tests to fail. Therefore you probably want to limit the tests to certain versions of TypeScript. Simply set the `typescriptVersion` config option to a SemVer range. If the current TypeScript version is within the range, the test is executed, otherwise it is skipped.

## Example Test Setup

Let's assume you have a rule `no-any` in `src/rules/` and the compiled output is located at `dist/rules`.

1. Start by creating a folder for all tests of that rule: `tests/no-any`.
1. A test configuration is required. Let's call it `default.test.json`:
   ```json
   {
     "config": ".wotanrc.yaml",
     "files": ["*.ts", "*.js"]
   }
   ```
1. Add a `.wotanrc.yaml` to configure your rule for that test:
   ```yaml
   rulesDirectories:
     local: ../../dist/rules # relative path to the directory containing the compiled version of your rule
   rules:
     local/no-any: error # use any severity you like
   ```
1. Add files to test. Also add test cases that shouldn't have findings.
   * `typescript.ts`
      ```ts
      let foo: any; // expecting error
      let any: string; // expecting no error
      ```
   * `javascript.js`
      ```js
      let any; // expecting no error
      ```
1. Now it's time to generate the baselines. Execute `wotan test -u tests/no-any/default.test.json`.
   * This creates `baselines/no-any/default/typescript.ts.lint` with one finding and `baselines/no-any/default/javascript.js.lint` with no finding.
   * If your rule is fixable, it should also generate `baselines/no-any/default/typescript.ts.fix`.
   * Carefully review the baselines for false-positives.
1. Let's assume you tweaked your rule but still expect the same output. After compiling you execute `wotan test --exact tests/no-any/default.test.json` to ensure you didn't introduce any unwanted changes.
1. If you enhance your rule to produce more/less/different output or you update any of your test files, the above command will fail and display the differences.
   * To accept the new output use the `-u` flag to update the existing baselines.
   * Carefully review the changes before adding them to your source control.
