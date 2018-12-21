const {AbstractRule, Replacement} = require('@fimbul/ymir');

exports.Rule = class extends AbstractRule {
    apply() {
        const end = this.sourceFile.end - 2;
        const pos = end - 1;
        this.addFinding(pos, end, "remove just a little bit", Replacement.delete(pos, end));
    }
}
