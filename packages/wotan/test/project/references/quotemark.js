// @ts-check
const AbstractRule = require('@fimbul/ymir').AbstractRule;
const ts = require('typescript');

exports.Rule = class Rule extends AbstractRule {
    apply() {
        for (const node of this.context.getFlatAst())
            if (node.kind === ts.SyntaxKind.StringLiteral && this.sourceFile.text[node.end - 1] === '"')
                this.addFindingAtNode(node, 'Prefer single quotes');
    }
}
