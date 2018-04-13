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

export function isAsyncFunction(node: ts.Node): node is ts.FunctionLikeDeclaration & {body: ts.Block} {
    switch (node.kind) {
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.MethodDeclaration:
            if ((<ts.FunctionLikeDeclaration>node).body === undefined)
                return false;
            // falls through
        case ts.SyntaxKind.ArrowFunction:
            if ((<ts.ArrowFunction>node).body.kind !== ts.SyntaxKind.Block)
                return false;
            // falls through
        case ts.SyntaxKind.FunctionExpression:
            break;
        default:
            return false;
    }
    return hasModifier(node.modifiers, ts.SyntaxKind.AsyncKeyword);
}

export function isVariableReassignment(use: VariableUse) {
    return (use.domain & (UsageDomain.Value | UsageDomain.TypeQuery)) === UsageDomain.Value && isReassignmentTarget(use.location);
}

export function* getChildStatements(node: ts.Statement) {
    switch (node.kind) {
        case ts.SyntaxKind.IfStatement:
            yield (<ts.IfStatement>node).thenStatement;
            if ((<ts.IfStatement>node).elseStatement !== undefined)
                yield (<ts.IfStatement>node).elseStatement!;
            break;
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.LabeledStatement:
        case ts.SyntaxKind.WithStatement:
            yield (<ts.IterationStatement | ts.LabeledStatement | ts.WithStatement>node).statement;
            break;
        case ts.SyntaxKind.SwitchStatement:
            for (const clause of (<ts.SwitchStatement>node).caseBlock.clauses)
                yield* clause.statements;
            break;
        case ts.SyntaxKind.Block:
            yield* (<ts.Block>node).statements;
            break;
        case ts.SyntaxKind.TryStatement:
            yield* (<ts.TryStatement>node).tryBlock.statements;
            if ((<ts.TryStatement>node).catchClause !== undefined)
                yield* (<ts.TryStatement>node).catchClause!.block.statements;
            if ((<ts.TryStatement>node).finallyBlock !== undefined)
                yield* ((<ts.TryStatement>node)).finallyBlock!.statements;
    }
}
