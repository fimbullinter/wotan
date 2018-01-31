const Lint = require('tslint');

'foo';

exports.Rule = class extends Lint.Rules.AbstractRule {
    apply() {
        return [];
    }
}
