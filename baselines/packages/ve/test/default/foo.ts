import {foo} from './jsx';
(async function() {
    1;
    ~~ [error no-unused-expression: This expression is unused. Did you mean to assign a value or call a function?]
    // JSDoc type annotations only work in JavaScript files
    /** @type {PromiseLike<string>} */
    let p = null;
    let v = null;
    p;
    ~~ [error no-unused-expression: This expression is unused. Did you mean to assign a value or call a function?]
    v;
    ~~ [error no-unused-expression: This expression is unused. Did you mean to assign a value or call a function?]
    await foo();
    await Promise.resolve();
})();
