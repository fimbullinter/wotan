# Contributing

Thank you for your interest in contributing to this project! There are many ways to contribute, and we appreciate all of them.

If you have questions, please use [Stack Overflow][so] or the [Gitter chat][gitter].

As a reminder, all contributors are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

* [Scope of this Project](#scope-of-this-project)
* [Feature Requests](#feature-requests)
* [Bug Reports](#bug-reports)
* [Development](#development)
* [Pull Requests](#pull-requests)
* [Writing Documentation](#writing-documentation)
* [Reviewing Pull Requests](#reviewing-pull-requests)
* [Issue Triage](#issue-triage)
* [Out-of-tree Contributions](#out-of-tree-contributions)

## Scope of this Project

This project aims to provide an extensible linting runtime with a well-chosen set of core rules.

The runtime API is designed to allow for easy integration in other tools and runtimes, such as editor plugins.
To keep the API maintainable, new functionality that does not directly benefit the common use case should be implemented and maintained outside of this project.
For example linting `stdin` could easily be achieved by a thin wrapper that uses the public API.

Core rules should help finding common bugs, enforce best practices or improve maintainability.
New users should be able to use the builtin configuration `wotan:recommended` without the need for refactoring large parts of their existing code or disabling a large portion of the rules.
For this reason we won't accept formatting related rules. For code style related rules that subjectively increase maintainability, e.g. curly braces in `if` and `for` statements, please open an issue for discussion before submitting a pull request.
Rules that rely heavily on user's preference and configuration should be maintained as part of a community package.

The runtime is not responsible for providing utility functions to help with developing custom rules.
If you need access to one of the internal utilities used in core rules, consider requesting that feature in the [tsutils][tsutils] project instead.

## Feature Requests

To suggest a new feature or enhancement, such as a new rule or formatter, please open a new issue describing the desired behavior in detail.
Good and bad code examples help a lot in understanding your proposal.

Make sure to search existing issues and pull requests before submitting the request. Also include closed issues in the search.

## Bug Reports

While bugs are unfortunate, they're a reality in software. We can't fix what we don't know about, so please report liberally.
If you're not sure if something is a bug or not, feel free to file a bug anyway.
Please avoid reporting bug reports about 3rd party rules, processors or formatters.

If you have the chance, before reporting a bug, please search existing issues, as it's possible that someone else has already reported your error.
This doesn't always work, and sometimes it's hard to know what to search for, so consider this extra credit.
We won't mind if you accidentally file a duplicate report.

Here's a template that you can use to file a bug:

    ## Meta

    `node_modules/.bin/wotan --version`
    `node_modules/.bin/tsc --version`

    How did you run wotan? (CLI, API, Editor Plugin, ...)

    ## Configuration

    `node_modules/.bin/wotan show <filename>`

    ```yaml
    # paste your configuration here
    ```

    ## Code

    <short summary of the bug>

    I tried this code:

    ```ts
    // code sample that causes the bug
    ```

    I expected to see this happen: <explanation>

    Instead, this happened: <explanation>

If an error is thrown, please include the stack trace. To narrow down where the error occurs, you can set the environment variable `DEBUG=wotan:*` to get some additional debug output.

## Development

This section describes how to make changes and test them locally.

You need at least Node 6.x and Yarn 1.2.1 or higher.

* `yarn compile` compiles the project.
* `yarn lint` lints the project with TSLint and the local build of wotan.
  * `yarn lint:tslint` lints the project with TSLint.
  * `yarn lint:wotan` lints the project with the local build of wotan
* `yarn test` runs all tests. Make sure to compile first.
  * `yarn test:api` runs only unit tests. Add option `-u` to update the unit test baselines.
  * `yarn test:integration` runs the integration tests. Add option `-u` to update the integration test baselines. Add option `--bail` to stop at the first failing test.
  * `yarn test:rules` runs the rule tests. Add option `-u` to update the rule test baselines. Add option `--bail` to stop at the first failing test.
  * `yarn test:coverage` runs all of the above test with coverage reporting.
* `yarn coverage` executes a given command with coverage reporting, e.g. `yarn coverage yarn test:rules`.
* `yarn verify` compiles, lints and tests the whole project. Basically all of the above.

Updating baselines may be necessary after changing or adding some functionality like new rules or new checks in rules. It's also necessary after editing a test.
Tests will fail if the output does not match the expected output in the corresponding baseline file.
Baselines are commited and pushed. Please review the changes to baseline files to make sure all changes are intended.

## Pull Requests

Pull requests are the primary mechanism we use to change Rust. GitHub itself has some [great documentation](https://help.github.com/articles/about-pull-requests/) on using the Pull Request feature.
We use the "fork and pull" model [described here](https://help.github.com/articles/about-collaborative-development-models/), where contributors push changes to their personal fork and create pull requests to bring those changes into the source repository.

Please make pull requests against the `master` branch.

Before submitting big changesets, consider opening an issue first to discuss your ideas with other contributors. That avoids unnecessary work for everyone involved if the proposed change is not agreed upon.

Make sure to add a test that fails without your change and succeeds with your change. Also update the baselines and add them to your pull request.

Your changes will automatically be tested on a Windows and Ubuntu machine to ensure it works across all platforms.
It's also tested with a subset of the supported TypeScript versions. While your code only needs to compile with `typescript@latest`, it needs to function correctly with all versions supported by this project.

Testing with `typescript@next` may fail CI because of changes in the TypeScript compiler. If the failures are not related to your change, it's not your responsibility to fix that before your pull request can be merged.
You may fix this failure in your pull request, but ideally you open another pull request specifically for this fix. That way both changes can be reviewed and merged independent from each other.
If you are not able to fix the failure, a core committer will take care of this.

Test coverage is also reported in the pull request. Please try to maintain a high coverage for all your changes.

If the pull request changes existing behavior or adds new functionality, please update the documentation accordingly.

Pull requests are [squashed while merging](https://help.github.com/articles/about-pull-request-merges/#squash-and-merge-your-pull-request-commits).
That means you can push new commits as you improve your pull request. It even helps reviewers to review the changes of each iterations.
All commits are combined into a single commit with a meaningful title (and description if necessary) during merging.

## Writing Documentation

Documentation improvements are very welcome.
(TODO: add more information once there is some real documentation.)

## Reviewing Pull Requests

Share your expertise by reviewing pull requests. Start by reviewing the high level approach of the change before pointing out code style issues.
A collaborator will take care of merging approved pull requests after an appropriate period of time if there are no objections.

### Helpful resources

* How to respectfully and usefully review code, part [one](https://mtlynch.io/human-code-reviews-1/) and [two](https://mtlynch.io/human-code-reviews-2/)
* [How to write a positive code review](https://css-tricks.com/code-review-etiquette/)

## Issue Triage

Sometimes, an issue will stay open, even though the bug has been fixed. And sometimes, the original bug may go stale because something has changed in the meantime.

It can be helpful to go through older bug reports and make sure that they are still valid.
Load up an older issue, double check that it's still true, and leave a comment letting us know if it is or is not.

If you're looking for somewhere to start, check out the [good first issue][goodfirstissue] or [help wanted][helpwanted] tags.

## Out-of-tree Contributions

There are a number of other ways to contribute that don't deal with this repository.

Answer questions on [Stack Overflow][so] or the [Gitter chat][gitter].

Contribute to existing community packages or create your own and publish it to npm.

[gitter]: https://gitter.im/ajafff/wotan
[so]: https://stackoverflow.com/
[tsutils]: https://github.com/ajafff/tsutils
[helpwanted]: https://github.com/ajafff/wotan/labels/help%20wanted
[goodfirstissue]: https://github.com/ajafff/wotan/labels/good%20first%20issue
