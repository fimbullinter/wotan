import {foo} from './jsx';
(async function() {
    1;
    // JSDoc type annotations only work in JavaScript files
    /** @type {PromiseLike<string>} */
    let p = null;
    let v = null;
    p;
    v;
    await foo();
    await Promise.resolve();
})();
