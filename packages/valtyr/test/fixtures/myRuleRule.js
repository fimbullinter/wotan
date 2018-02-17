const TSLint = require('tslint');

exports.Rule = class Rule extends TSLint.Rules.AbstractRule {
    apply(sourceFile) {
        return [new TSLint.RuleFailure(sourceFile, 0, 0, 'test message', '')];
    }
};
