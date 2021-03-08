"use strict";
exports.__esModule = true;
exports.A = void 0;
var a1_1 = require("./a1");
var A = /** @class */ (function () {
    function A() {
        this.nested = new a1_1.A1();
    }
    return A;
}());
exports.A = A;
// this fixable failure ensures we only lint this project / file once
debugger;
