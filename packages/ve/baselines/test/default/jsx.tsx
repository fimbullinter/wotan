<script lang="js"></script>
~~~~~~~~~~~~~~~~~~~~~~~~~~~ [error no-unused-expression: This expression is unused. Did you mean to assign a value or call a function?]
export async function foo() {
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
    await Promise.resolve();
}
