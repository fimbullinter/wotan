import { AbstractRule, Replacement } from '@fimbul/ymir';
import * as ts from 'typescript';

export class Rule extends AbstractRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    public apply() {
        for (const node of this.context.getFlatAst())
            if (node.kind === ts.SyntaxKind.NewExpression && this.sourceFile.text[node.end - 1] !== ')')
                this.addFailure(node.end, node.end, 'Expected parentheses on constructor call.', Replacement.append(node.end, '()'));
    }
}
