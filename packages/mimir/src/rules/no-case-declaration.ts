import { AbstractRule } from '@fimbul/ymir';
import * as ts from 'typescript';
import { hasModifier } from 'tsutils';

export class Rule extends AbstractRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    public apply() {
        for (const node of this.context.getFlatAst())
            if (node.kind === ts.SyntaxKind.CaseBlock)
                for (const clause of (<ts.CaseBlock>node).clauses)
                    for (const statement of clause.statements)
                        if (isForbiddenDeclaration(statement))
                            this.addFailureAtNode(statement, 'Unexpected lexical declaration in case block.');

    }
}

function isForbiddenDeclaration(node: ts.Statement): boolean {
    switch (node.kind) {
        case ts.SyntaxKind.ClassDeclaration:
            return true;
        case ts.SyntaxKind.VariableStatement:
            return ((<ts.VariableStatement>node).declarationList.flags & ts.NodeFlags.Let) !== 0;
        case ts.SyntaxKind.EnumDeclaration:
            return !hasModifier(node.modifiers, ts.SyntaxKind.ConstKeyword);
        default:
            return false;
    }
}
