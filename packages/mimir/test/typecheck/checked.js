// @ts-check
const m = require('non-existent-module');
/** @type {string} */
let foo;
foo = 1;
console.clog(foo);

/** @type {Array<Map<string, [boolean, string]>>} */
let bar;
let baz = foo;

/**
 *
 * @param {Array<Map<string, [number, string]>>} param
 * @returns {boolean}
 */
function fn(param) {
    return param[0];
    fn
}

/**
 * @param {string} param1
 * @returns {string}
 */
function fn2(param1, param2) {
    fn(bar);
}

fn2();
