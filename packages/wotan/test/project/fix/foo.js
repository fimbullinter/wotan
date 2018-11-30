// @ts-check
const {AbstractRule, Replacement} = require('@fimbul/ymir');

exports.Rule = class extends AbstractRule {
    apply() {
        if (this.sourceFile.text.substring(8, 11) === 'foo')
            this.addFailure(8, 11, "'foo' is not allowed.", Replacement.replace(8, 11, 'bar'));
        if (this.sourceFile.statements.length === 3) {
            this.addFailureAtNode(
                this.sourceFile.statements[2],
                'import is unused',
                Replacement.delete(this.sourceFile.statements[2].pos, this.sourceFile.statements[2].end)
            );
        }
    }
}
