import { AbstractRule } from '../types';
import * as ts from 'typescript';
import { isBlockScopedVariableDeclarationList, endsControlFlow, isBlock, isCaseOrDefaultClause, hasModifier } from 'tsutils';

export class Rule extends AbstractRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    public apply() {
        for (const node of this.context.getFlatAst()) {
            if (!isBlock(node) && !isCaseOrDefaultClause(node))
                continue;
            let i = node.statements.findIndex(endsControlFlow);
            if (i === -1)
                continue;
            for (i += 1; i < node.statements.length; ++i) {
                if (!isHoistedDeclaration(node.statements[i])) {
                    this.addFailureAtNode(node.statements[i].getFirstToken(), 'Unreachable code detected.');
                    break;
                }
            }
        }
    }
}

function isHoistedDeclaration(node: ts.Statement) {
    switch (node.kind) {
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.TypeAliasDeclaration:
            return true;
        case ts.SyntaxKind.EnumDeclaration:
            return hasModifier(node.modifiers, ts.SyntaxKind.ConstKeyword);
        case ts.SyntaxKind.VariableStatement:
            return isBlockScopedVariableDeclarationList((<ts.VariableStatement>node).declarationList) &&
            (<ts.VariableStatement>node).declarationList.declarations.every((d) => d.initializer === undefined);
        default:
            return false;
    }
}
