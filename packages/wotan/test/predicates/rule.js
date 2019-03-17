//@ts-check
const {AbstractRule} = require('@fimbul/ymir');

exports.Rule = class extends AbstractRule {
    apply() {
        this.addFinding(0, 0, 'finding');
    }
}
