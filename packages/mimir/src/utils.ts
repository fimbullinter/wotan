import * as ts from 'typescript';
import { hasModifier, WrappedAst, getWrappedNodeAtPosition, VariableUse, UsageDomain, isReassignmentTarget } from 'tsutils';
import { RuleContext } from '@fimbul/ymir';

export function isStrictNullChecksEnabled(options: ts.CompilerOptions): boolean {
    return options.strict ? options.strictNullChecks !== false : options.strictNullChecks === true;
}

export function isStrictPropertyInitializationEnabled(options: ts.CompilerOptions): boolean {
    return options.strict
        ? options.strictPropertyInitialization !== false && options.strictNullChecks !== false
        : options.strictPropertyInitialization === true && options.strictNullChecks === true;
}

export function* switchStatements(context: RuleContext) {
    const {text} = context.sourceFile;
    const re = /\bswitch\s*[(/]/g;
    let wrappedAst: WrappedAst | undefined;
    for (let match = re.exec(text); match !== null; match = re.exec(text)) {
        const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = context.getWrappedAst()), match.index)!;
        if (node.kind === ts.SyntaxKind.SwitchStatement && node.getStart(context.sourceFile) === match.index)
            yield <ts.SwitchStatement>node;
    }
}

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

export function isVariableReassignment(use: VariableUse) {
    return (use.domain & (UsageDomain.Value | UsageDomain.TypeQuery)) === UsageDomain.Value && isReassignmentTarget(use.location);
}
