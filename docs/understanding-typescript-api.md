# Understanding TypeScript's API

This page lists some helpful ressources to learn how to use TypeScript's API and how to analyze a code snippet using different versions of TypeScript.

* https://github.com/Microsoft/TypeScript/wiki/Architectural-Overview offers a great overview of the compiler architecture as well as some basics about Nodes, their locations and comments.
* https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API explains the use of the compiler API. It contains come examples how to traverse the AST with a lint-like script and demonstrates the use of the TypeChecker.
* https://github.com/sandersn/manual/blob/master/Typescript-compiler-implementation.md is a writeup of some compiler internals you probably won't understand if you are new to this topic. It's definitely worth reading as it makes many things clearer, for example:
  * type inference
  * contextual types
  * fresh literal types / widening (a more detailed description of widening can be found at https://github.com/sandersn/manual/blob/master/Widening-and-Narrowing-in-Typescript.md)
  * basic information how types work (for more details see https://github.com/sandersn/manual/blob/master/Assignability.md)
* https://astexplorer.net/ can be used to visualize the parsed AST.
  * You need to select language `JavaScript` and parser `typescript`.
  * In a separate settings menu you can choose to parse as JSX or plain TypeScript.
  * Often uses an outdated version of the TypeScript parser (can be seen in the upper right corner), which makes it impossible to test bleeding-edge syntax features.
* https://ts-ast-viewer.com/ is a more advanced tool to visualize and analyze the AST.
  * Has not such a fancy UI like AST Explorer (e.g. no highlighting of source code when selecting an AST Node).
  * Allows you to choose between different script kinds (JS, JSX, TS, TSX, JSON, ...).
  * Can switch between all stable TypeScript versions since `v2.4.2` plus the ability to use the most recent nightly version.
  * Can display the result of different AST traversal methods:
    * `node.forEachChild(cb)` displays the actual AST (which excludes some tokens that are always present like the `function` keyword of a FunctionDeclaration or FunctionExpression).
    * `node.getChildren()` contains all AST Nodes plus tokens not present in the actual AST.
  * Displays detailed information about the selected Node.
    * Displays `Type`, `Symbol` and `Signature` of the Node if available.
    * Some of the properties are internal and not available through the public API. Though they are useful for debugging purposes.
    * Because some of this information is internal the API sometimes doesn't return the same values as displayed here (e.g. `checker.getSymbolAtLocation(node)` doesn't return the symbol of a ClassExpression).
  * It's definitely worth opening your browser's developer tools as you can use it to fiddle around using global variables to access the TypeScript compiler, TypeChecker, the selected Node and more.
* https://agentcooper.github.io/typescript-play/#code/ is an enhanced version of TypeScript's playground.
  * Allows you to select the TypeScript version used.
  * Has settings for almost all compilerOptions.
  * Allows sharing code snippets including the compilerOptions.
* https://github.com/phenomnomnominal/tsquery is a library for querying an AST using a CSS-selector-like syntax. You can try it out in the playground: https://tsquery-playground.firebaseapp.com/
* https://bigtsquery.firebaseapp.com uses TSQuery to crawl through the AST of all public TypeScript files in GitHub.
* https://github.com/ajafff/tsutils is a utility library that contains a lot of helper functions to make your life easier.
  * Most things you want to do with TypeScript's AST, there's probably already a function that does that or at least parts of it.
  * Unfortunately there's not so much documentation, so you need to look into the code to know what's available.
