import * as ts from 'typescript';
import {
    hasModifier,
    WrappedAst,
    getWrappedNodeAtPosition,
    VariableUse,
    UsageDomain,
    isReassignmentTarget,
    getPropertyOfType,
    getLateBoundPropertyNames,
    PropertyName,
    isStatementInAmbientContext,
    getPropertyName,
} from 'tsutils';
import { RuleContext } from '@fimbul/ymir';

export function* switchStatements(context: RuleContext) {
    const {text} = context.sourceFile;
    const re = /\bswitch\s*[(/]/g;
    let wrappedAst: WrappedAst | undefined;
    for (let match = re.exec(text); match !== null; match = re.exec(text)) {
        const {node} = getWrappedNodeAtPosition(wrappedAst ??= context.getWrappedAst(), match.index)!;
        if (node.kind === ts.SyntaxKind.SwitchStatement && node.getStart(context.sourceFile) === match.index)
            yield <ts.SwitchStatement>node;
    }
}

export function* tryStatements(context: RuleContext) {
    const {text} = context.sourceFile;
    const re = /\btry\s*[{/]/g;
    let wrappedAst: WrappedAst | undefined;
    for (let match = re.exec(text); match !== null; match = re.exec(text)) {
        const {node} = getWrappedNodeAtPosition(wrappedAst ??= context.getWrappedAst(), match.index)!;
        if (node.kind === ts.SyntaxKind.TryStatement && (<ts.TryStatement>node).tryBlock.pos - 'try'.length === match.index)
            yield <ts.TryStatement>node;
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

export function* childStatements(node: ts.Statement) {
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

function getLeadingExpressionWithPossibleParsingAmbiguity(expr: ts.Node): ts.Expression | undefined {
    switch (expr.kind) {
        case ts.SyntaxKind.PropertyAccessExpression:
        case ts.SyntaxKind.ElementAccessExpression:
        case ts.SyntaxKind.AsExpression:
        case ts.SyntaxKind.CallExpression:
        case ts.SyntaxKind.NonNullExpression:
            return (
                <ts.PropertyAccessExpression | ts.ElementAccessExpression | ts.AsExpression | ts.CallExpression | ts.NonNullExpression>expr
            ).expression;
        case ts.SyntaxKind.PostfixUnaryExpression:
            return (<ts.PostfixUnaryExpression>expr).operand;
        case ts.SyntaxKind.BinaryExpression:
            return (<ts.BinaryExpression>expr).left;
        case ts.SyntaxKind.ConditionalExpression:
            return (<ts.ConditionalExpression>expr).condition;
        case ts.SyntaxKind.TaggedTemplateExpression:
            return (<ts.TaggedTemplateExpression>expr).tag;
        default:
            return;
    }
}

export function expressionNeedsParensWhenReplacingNode(expr: ts.Expression, replaced: ts.Expression): boolean {
    // this currently doesn't handle the following cases
    // (yield) as any
    // await (yield)
    // (1).toString()
    // ({foo} = {foo: 1});
    // binary operator precendence
    while (true) {
        switch (expr.kind) {
            case ts.SyntaxKind.ObjectLiteralExpression:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ClassExpression:
                return parentRequiresParensForNode(expr.kind, replaced);
            default:
                const current = getLeadingExpressionWithPossibleParsingAmbiguity(expr);
                if (current === undefined)
                    return false;
                expr = current;
        }
    }
}

function parentRequiresParensForNode(
    kind: ts.SyntaxKind.ObjectLiteralExpression | ts.SyntaxKind.FunctionExpression | ts.SyntaxKind.ClassExpression,
    replaced: ts.Node,
): boolean {
    while (true) {
        const parent = replaced.parent!;
        switch (parent.kind) {
            case ts.SyntaxKind.ArrowFunction:
                return kind === ts.SyntaxKind.ObjectLiteralExpression;
            case ts.SyntaxKind.ExpressionStatement:
                return true;
            case ts.SyntaxKind.ExportAssignment:
                return !(<ts.ExportAssignment>parent).isExportEquals && kind !== ts.SyntaxKind.ObjectLiteralExpression;
        }
        if (getLeadingExpressionWithPossibleParsingAmbiguity(parent) !== replaced)
            return false;
        replaced = parent;
    }
}

export function objectLiteralNeedsParens(replaced: ts.Expression): boolean {
    return parentRequiresParensForNode(ts.SyntaxKind.ObjectLiteralExpression, replaced);
}

const typeFormat = ts.TypeFormatFlags.NoTruncation
    | ts.TypeFormatFlags.UseFullyQualifiedType
    | ts.TypeFormatFlags.WriteClassExpressionAsTypeLiteral
    | ts.TypeFormatFlags.UseStructuralFallback;

export function typesAreEqual(a: ts.Type, b: ts.Type, checker: ts.TypeChecker) {
    return a === b || checker.typeToString(a, undefined, typeFormat) === checker.typeToString(b, undefined, typeFormat);
}

export function *elementAccessSymbols(node: ts.ElementAccessExpression, checker: ts.TypeChecker) {
    const {argumentExpression} = node;
    if (argumentExpression === undefined || argumentExpression.pos === argumentExpression.end)
        return;
    const {names} = getLateBoundPropertyNames(argumentExpression, checker);
    if (names.length === 0)
        return;
    yield* propertiesOfType(checker.getApparentType(checker.getTypeAtLocation(node.expression)).getNonNullableType(), names);
}

export function *propertiesOfType(type: ts.Type, names: Iterable<PropertyName>) {
    for (const {symbolName, displayName} of names) {
        const symbol = getPropertyOfType(type, symbolName);
        if (symbol !== undefined)
            yield {symbol, name: displayName};
    }
}

export function hasDirectivePrologue(node: ts.Node): node is ts.BlockLike {
    switch (node.kind) {
        case ts.SyntaxKind.SourceFile:
        case ts.SyntaxKind.ModuleBlock:
            return true;
        case ts.SyntaxKind.Block:
            switch (node.parent!.kind) {
                case ts.SyntaxKind.ArrowFunction:
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.Constructor:
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                    return true;
                default:
                    return false;
            }
        default:
            return false;
    }
}

/** Determines whether a property has the `declare` modifier or the containing class is ambient. */
export function isAmbientPropertyDeclaration(node: ts.PropertyDeclaration): boolean {
    return hasModifier(node.modifiers, ts.SyntaxKind.DeclareKeyword) ||
        node.parent!.kind === ts.SyntaxKind.ClassDeclaration && isStatementInAmbientContext(node.parent);
}

/** Determines whether the given variable declaration is ambient. */
export function isAmbientVariableDeclaration(node: ts.VariableDeclaration): boolean {
    return node.parent!.kind === ts.SyntaxKind.VariableDeclarationList &&
        node.parent.parent!.kind === ts.SyntaxKind.VariableStatement &&
        isStatementInAmbientContext(node.parent.parent);
}

export function tryGetBaseConstraintType(type: ts.Type, checker: ts.TypeChecker) {
    return checker.getBaseConstraintOfType(type) || type;
}

export interface PropertyNameWithLocation extends PropertyName {
    node: ts.Node;
}

export function *addNodeToPropertyNameList(node: ts.Node, list: Iterable<PropertyName>): IterableIterator<PropertyNameWithLocation> {
    for (const element of list)
        yield {node, symbolName: element.symbolName, displayName: element.displayName};
}

export function *destructuredProperties(node: ts.ObjectBindingPattern, checker: ts.TypeChecker) {
    for (const element of node.elements) {
        if (element.dotDotDotToken !== undefined)
            continue;
        if (element.propertyName === undefined) {
            yield {
                node: element.name,
                symbolName: (<ts.Identifier>element.name).escapedText,
                displayName: (<ts.Identifier>element.name).text,
            };
        } else {
            const propName = getPropertyName(element.propertyName);
            if (propName !== undefined) {
                yield {
                    node: element.propertyName,
                    symbolName: ts.escapeLeadingUnderscores(propName),
                    displayName: propName,
                };
            } else {
                // TODO handle PrivateIdentifier
                yield* addNodeToPropertyNameList(
                    element.propertyName,
                    getLateBoundPropertyNames((<ts.ComputedPropertyName>element.propertyName).expression, checker).names,
                );
            }
        }
    }
}
