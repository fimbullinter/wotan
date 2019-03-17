//@ts-check
const {Rule} = require('./rule');
const {predicate} = require('@fimbul/ymir');
const {__decorate} = require('tslib');

exports.Rule = __decorate(
    [
        predicate(() => false)
    ],
    class extends Rule {}
);
