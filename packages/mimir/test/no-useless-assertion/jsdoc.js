export {};

function takeString(/** @type {string} */param) {}
function takeStringOrUndefined(/** @type {string} */param = '') {}

let s = '';
let su = Boolean() ? s : undefined;

s = (s);
s = /** foo */(s);
s = /** @type {string} */s;
s = /** @type {string} */(s);
s = /** @type {string} */ /** @type {number} */(s);
s = /** foobar */ /** @type {string} */ // foo
    (s);
s = /** @type {string} */(su);

takeString(/** @type {string} */(su))
takeStringOrUndefined(/** @type {string} */(su));

let literal = /** @type {1} */(1);
