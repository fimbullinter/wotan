const {AbstractRule, Replacement} = require('../../../src/types');

exports.Rule = class extends AbstractRule {
    apply() {
        if (this.sourceFile.end !== 0)
            this.addFailureAt(0, 1, "remove this character", Replacement.deleteAt(0, 1));
    }
}
