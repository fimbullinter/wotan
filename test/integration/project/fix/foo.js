const {AbstractRule, Replacement} = require('../../../../src/types');

exports.Rule = class extends AbstractRule {
    apply() {
        if (this.sourceFile.text.substr(8, 3) === 'foo')
            this.addFailureAt(8, 3, "'foo' is not allowed.", Replacement.replaceAt(8, 3, 'bar'));
    }
}
