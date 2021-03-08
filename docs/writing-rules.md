# Writing Rules

## Requirements

* the file name of a rule is kebab-case to match the name used in the configuration, e.g. `do-something-cool` is implemented in `do-something-cool.ts`
* rule names must match `/^[\w-]+$/`
* the file needs to export a class named `Rule` that extends `AbstractRule` (or any subclass thereof)
* replacements of a fix must not overlap, see [Adding Fixes](#adding-fixes) for more information

## Important Conventions

* rules should not have side effects
* rules should not rely on the order of the linted files
* rules should not make assumptions about the execution environment, for example accessing the file system is not guaranteed to work

## Best Practices

* the finding message should begin with an uppercase letter (unless it starts with `'`), end with a dot and wrap keywords and code snippets in single quotes.
* fixes should not introduce any syntax or type errors
* fixes should not alter the runtime semantics
* fixes should replace the minimum amount of text necessary to avoid overlapping fixes
* rules should not produce contradicting findings when run with and without type information

## Implementing the Rule

Let's start by implementing a simple rule that bans all uses of type `any` as type declaration.
This rule doesn't need type information and is not configurable, so we extend `AbstractRule`.
If the rule needed type information, you would extend `TypedRule` instead. If the rule was configurable, you should prefer `ConfigurableRule` or `ConfigurableTypedRule`.

### Initial Implementation

We start with the simplest or most common implementation and optimize it while we progress.

```ts
import * as ts from 'typescript';
import { AbstractRule } from '@fimbul/ymir';

export class Rule extends AbstractRule {
    public apply() {
        const cb = (node: ts.Node) => {
            // when we find AnyKeyword, we know this can only occur in type nodes
            if (node.kind === ts.SyntaxKind.AnyKeyword) {
                // we add a finding from the start of the keyword until the end
                // note that we don't provide any fix, since we cannot safely replace 'any' without possibly introducing type errors
                this.addFindingAtNode(node, "Type 'any' is forbidden.");
            }
            // continue visiting child nodes
            ts.forEachChild(node, cb);
        };
        // loop through all child nodes
        ts.forEachChild(this.sourceFile, cb);
    }
}
```

Note that we import from `@fimbul/ymir` instead of `@fimbul/wotan`. While the latter would also work, it's not recommended for custom rules. To allow reusing rules with a different linter runtime you should avoid having a dependency in `@fimbul/wotan` and use the core library `@fimbul/ymir` instead.

### Avoid scanning source text

The implementation above works, but we can do better. So we grab the low hanging fruit first:
`addFindingAtNode` internally calls `node.getStart(sourceFile)` which is not as cheap as it looks. Computing the start of a node is rather expensive.
Fortunately we know the end of the token and in this case we also know that `any` always has 3 characters.

```ts
                this.addFinding(node.end - 3, node.end, "Type 'any' is forbidden.");
```

Now we avoid computing the start position of the node. But that's only relavant if there is a finding.

### Prevent the rule from executing on certain files

Let's try to optimize further: Since type annotations can only occur in `*.ts` and `*.tsx` files, we don't need to instantiate and execute the rule for any other files.

To disable the rule based on the linted file, you can implement the static `supports` method or use the `@predicate` decorator to register an additional predicate.

```ts
export class Rule extends AbstractRule {
    public static supports(sourceFile: ts.SourceFile) {
        return /\.tsx?$/.test(sourceFile.fileName); // only apply this rule for *.ts and *.tsx files
    }
```

or

```ts
@predicate((sourceFile) => /\.tsx?$/.test(sourceFile.fileName))
export class Rule extends AbstractRule {
```

The same functionality is already available as decorator `@typescriptOnly`, so you could just write:

```ts
@typescriptOnly
export class Rule extends AbstractRule {
    // public static supports is no longer necessary
```

There's a similar decorator to exclude declaration files: `@excludeDeclarationFiles`. These decorators can be used together. They also respect the `public static supports` method if present.

### Avoid AST recursion

The optimization above avoid unnecessary work. Unfortunately visiting each AST node by calling `ts.forEachChild` recursively is very expensive. This is where the `RuleContext` saves the day.
The `RuleContext` provides two methods to get a converted version of the AST that is easier to iterate. `RuleContext` also provides some metadata about the current rule, but that's not beneficial for our use at the moment.

Since we are only searching for nodes with a specific kind and are not interested in the location of the node, we choose to iterate over a flattened AST:

```ts
    public apply() {
        for (const node of this.context.getFlatAst()) {
            if (node.kind === ts.SyntaxKind.AnyKeyword) {
                this.addFinding(node.end - 3, node.end, "Type 'any' is forbidden.".)
            }
        }
    }
```

You could convert the AST to the flattened version on your own using `convertAst` from the `tsutils` package. But using `RuleContext#getFlatAst()` caches the result so other rules don't have to convert it again.

The latest optimization reduced the execution time of the rule by about 80% and greatly simplifies the code.
For some rules this is best implementation possible. In this case however, it's only the second-best implementation.

### Avoid visiting AST nodes

Why iterate an array of thousands of nodes if the whole file doesn't contain a single `any`? So we decide to use a regular expression to scan the source code directly. That only works if you don't expect many false positives.

```ts
    public apply() {
        const re = /\bany\b/g;
        let wrappedAst: WrappedAst | undefined
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(
                wrappedAst || (wrappedAst = this.context.getWrappedAst()), // only get the wrapped AST if necessary
                match.index,
            )!;
            if (
                node.kind === ts.SyntaxKind.AnyKeyword && // makes sure this is not the content of a string, template or something else
                node.end === match.index + 3 // avoids duplicate findings for 'let foo: /* any */ any;' because the comment is also part of the node
            ) {
                this.addFinding(match.index, node.end, "Type 'any' is forbidden.");
            }
        }
    }
```

This is as fast as it gets. If you are willing to accept the increased complexity, you can adapt this pattern for your own rules.

### Fully optimized Implementation

Finally, here's the complete code of our fully optimized rule:

```ts
import * as ts from 'typescript';
import { AbstractRule, typescriptOnly } from '@fimbul/ymir';
import { WrappedAst, getWrappedNodeAtPosition } from 'tsutils';

@typescriptOnly // only apply this rule for *.ts and *.tsx files
export class Rule extends AbstractRule {
    public apply() {
        const re = /\bany\b/g;
        let wrappedAst: WrappedAst | undefined
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(
                wrappedAst || (wrappedAst = this.context.getWrappedAst()), // only get the wrapped AST if necessary
                match.index,
            )!;
            if (
                node.kind === ts.SyntaxKind.AnyKeyword && // makes sure this is not the content of a string, template or something else
                node.end === match.index + 3 // avoids duplicate findings for 'let foo: /* any */ any;' because the comment is also part of the node
            ) {
                this.addFinding(match.index, node.end, "Type 'any' is forbidden.");
            }
        }
    }
}
```

## Adding Fixes

Now that the rule finds all findings it would be nice to provide users the ability to automatically fix these findings.
For academic purposes we add fixes for our `no-any` rule, although there is no safe way to replace `any`. Keep in mind that you should not add fixes that might break at compile or runtime.

Let's pretend replacing `any` with the empty object type `{}` is correct.

```ts
declare let node: ts.Token<ts.SyntaxKind.AnyKeyword>; // this is the node we want to replace
const end = node.end;
const start = end - 3;

// adding a single replacement as fix
this.addFinding(start, end, "Type 'any' is forbidden.", Replacement.replace(start, end, '{}'));

/* OR */

// adding multiple replacements as fix, either all of them are applied or none, the order doesn't matter
this.addFinding(start, end, "Type 'any' is forbidden.", [
    Replacement.delete(start, end),
    Replacement.append(start, '{}'),
]);
```

Both fixes above are treated the same internally. But there are certain restrictions:
While overlapping replacements of different fixes are filtered out and applied in a subsequent iteration, replacements of the same fix must not overlap.
Replacements of the same fix are not considered overlapping if their ranges are touching.

* No `replace` or `delete` of the same character more than once.
* You are allowed to `delete` and `append` at the same position as they get merged internally.
* `append`ing multiple times at the same position merges the insertions in order of occurrence.

Some examples:

```ts
[
  Replacement.delete(start, end),
  Replacement.append(start, '{'),
  Replacement.append(start, '}'),
];
// same as
Replacement.replace(start, end, '{}');


[
  Replacement.replace(start, end, '{'),
  Replacement.append(start, '}'), // order matters, swapping with the previous line gives a different result
];
// same as
Replacement.replace(start, end, '{}');


[
  Replacement.delete(start, end),
  Replacement.replace(start, end, '{}'), // deletes twice ... why would you even want to do that?
];
```

## More Performance Advice

After fixes are applied, the `Program` needs to be updated before type information is available and up to date for the next rule.
To avoid unnecessary updates to the `Program` Wotan tries to defer that task for as long as possible. This is done by making `AbstractRule#program`, `TypedRule#checker` and `RuleContext#program` get accessors that update the program on first use.
Therefore try to avoid accessing these properties if there are other conditions you could check first.
That's why `RuleContext` has a member `compilerOptions` that contains the `CompilerOptions` currently in use. Using this property doesn't cause an update of the `Program`. It's a cheaper way to check if type information would be availabe or which compiler options are enabled.

## Testing

Before we throw our rule at our and other people's code, we should make sure it works as intended and doesn't destroy the code it's intended to make better.
Head over to [Testing Rules](testing-rules.md) to learn how to properly test your rules.
