const {AbstractRule, Replacement} = require('../../../../src/types');

exports.Rule = class extends AbstractRule {
    apply() {
        if (this.sourceFile.text.substring(8, 11) === 'foo')
            this.addFailure(8, 11, "'foo' is not allowed.", Replacement.replace(8, 11, 'bar'));
    }
}
