<script lang="js"></script>
export async function foo() {
    await 1;
    // JSDoc type annotations only work in JavaScript files
    /** @type {PromiseLike<string>} */
    let p = null;
    let v = null;
    await p;
    await v;
    await Promise.resolve();
}
