import * as ts from 'typescript';
import { hasModifier } from 'tsutils';

export function isAsyncFunction(node: ts.Node): node is ts.FunctionLikeDeclaration {
    switch (node.kind) {
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.MethodDeclaration:
            if ((<ts.FunctionLikeDeclaration>node).body === undefined)
                return false;
            // falls through
        case ts.SyntaxKind.ArrowFunction:
        case ts.SyntaxKind.FunctionExpression:
            return hasModifier(node.modifiers, ts.SyntaxKind.AsyncKeyword);
        default:
            return false;
    }
}
