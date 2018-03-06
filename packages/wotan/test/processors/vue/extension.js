const {AbstractRule} = require('@fimbul/ymir');
const path = require('path');

exports.Rule = class Rule extends AbstractRule {
    apply() {
        this.addFailure(0, 0, 'The extension of this file is: ' + path.extname(this.sourceFile.fileName));
    }
}
