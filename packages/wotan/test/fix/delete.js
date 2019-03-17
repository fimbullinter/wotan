const {AbstractRule, Replacement} = require('@fimbul/ymir');

exports.Rule = class extends AbstractRule {
    apply() {
        this.addFinding(0, 1, "remove this character", Replacement.delete(0, 1));
    }
}
