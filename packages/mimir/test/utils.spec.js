"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = require("ava");
const utils_1 = require("../src/utils");
ava_1.default('isStrictNullChecksEnabled', (t) => {
    t.true(utils_1.isStrictNullChecksEnabled({ strict: true }));
    t.true(utils_1.isStrictNullChecksEnabled({ strictNullChecks: true }));
    t.true(utils_1.isStrictNullChecksEnabled({ strict: false, strictNullChecks: true }));
    t.false(utils_1.isStrictNullChecksEnabled({ strict: false }));
    t.false(utils_1.isStrictNullChecksEnabled({ strict: true, strictNullChecks: false }));
    t.false(utils_1.isStrictNullChecksEnabled({ strict: false, strictNullChecks: false }));
});
ava_1.default('isStrictPropertyInitializationEnabled', (t) => {
    t.true(utils_1.isStrictPropertyInitializationEnabled({ strict: true }));
    t.true(utils_1.isStrictPropertyInitializationEnabled({ strict: false, strictNullChecks: true, strictPropertyInitialization: true }));
    t.true(utils_1.isStrictPropertyInitializationEnabled({ strict: true, strictPropertyInitialization: true }));
    t.false(utils_1.isStrictPropertyInitializationEnabled({ strictPropertyInitialization: true }));
    t.false(utils_1.isStrictPropertyInitializationEnabled({ strictNullChecks: true }));
    t.false(utils_1.isStrictPropertyInitializationEnabled({ strict: false, strictPropertyInitialization: true }));
    t.false(utils_1.isStrictPropertyInitializationEnabled({ strict: false, strictNullChecks: true }));
    t.false(utils_1.isStrictPropertyInitializationEnabled({ strict: false }));
    t.false(utils_1.isStrictPropertyInitializationEnabled({ strict: true, strictPropertyInitialization: false }));
    t.false(utils_1.isStrictPropertyInitializationEnabled({ strict: false, strictPropertyInitialization: false }));
    t.false(utils_1.isStrictPropertyInitializationEnabled({ strict: true, strictNullChecks: false }));
});
//# sourceMappingURL=utils.spec.js.map