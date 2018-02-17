# Dísir

> A dís ("lady", plural dísir) is a ghost, spirit or deity associated with fate who can be either benevolent or antagonistic towards mortals. Dísir may act as protective spirits.

The rules in this package are used internally to lint this project during development:

* `import-package` disallows direct imports from other packages. You should import from `@fimbul/<package>` instead.
* `no-import-self` disallows importing the package by its external name withing the package. You should directly import from the file containing the declaration.
