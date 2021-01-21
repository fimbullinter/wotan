import { TypedRule, Replacement, typescriptOnly, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import {
    expressionNeedsParensWhenReplacingNode,
    isAmbientPropertyDeclaration,
    isAmbientVariableDeclaration,
    typesAreEqual,
    tryGetBaseConstraintType,
} from '../utils';
import {
    isVariableDeclaration,
    hasModifier,
    isFunctionScopeBoundary,
    unionTypeParts,
    isFunctionExpression,
    isArrowFunction,
    getIIFE,
    removeOptionalityFromType,
    isStrictCompilerOptionEnabled,
    isConstAssertion,
    isInConstContext,
    isTypeReference,
    isTupleType,
    isOptionalChainingUndefinedMarkerType,
} from 'tsutils';
import * as debug from 'debug';

const log = debug('wotan:rule:no-useless-assertion');

const FAIL_MESSAGE = "This assertion is unnecesary as it doesn't change the type of the expression.";
const FAIL_DEFINITE_ASSIGNMENT = 'This assertion is unnecessary as it has no effect on this declaration.';

@excludeDeclarationFiles
@typescriptOnly
export class Rule extends TypedRule {
    private strictNullChecks = isStrictCompilerOptionEnabled(this.context.compilerOptions, 'strictNullChecks');

    public apply(): void {
        for (const node of this.context.getFlatAst()) {
            switch (node.kind) {
                case ts.SyntaxKind.NonNullExpression:
                    this.checkNonNullAssertion(<ts.NonNullExpression>node);
                    break;
                case ts.SyntaxKind.AsExpression:
                case ts.SyntaxKind.TypeAssertionExpression:
                    this.checkTypeAssertion(<ts.AssertionExpression>node);
                    break;
                case ts.SyntaxKind.VariableDeclaration:
                    this.checkDefiniteAssignmentAssertion(<ts.VariableDeclaration>node);
                    break;
                case ts.SyntaxKind.PropertyDeclaration:
                    this.checkDefiniteAssignmentAssertionProperty(<ts.PropertyDeclaration>node);
            }
        }
    }

    private checkDefiniteAssignmentAssertion(node: ts.VariableDeclaration) {
        // compiler already emits an error for definite assignment assertions on ambient or initialized variables
        if (node.exclamationToken !== undefined &&
            node.initializer === undefined &&
            node.type !== undefined &&
            !isAmbientVariableDeclaration(node) && (
                !isStrictCompilerOptionEnabled(this.context.compilerOptions, 'strictNullChecks') ||
                // type does not allow undefined
                getNullableFlagsOfReceiver(this.checker.getTypeAtLocation(node.name)) & ts.TypeFlags.Undefined
            ))
            this.addFinding(
                node.exclamationToken.end - 1,
                node.exclamationToken.end,
                FAIL_DEFINITE_ASSIGNMENT,
                Replacement.delete(node.exclamationToken.pos, node.exclamationToken.end),
            );
    }

    private checkDefiniteAssignmentAssertionProperty(node: ts.PropertyDeclaration) {
        // compiler emits an error for definite assignment assertions on ambient, initialized or abstract properties
        if (node.exclamationToken !== undefined &&
            node.initializer === undefined &&
            node.type !== undefined &&
            !isAmbientPropertyDeclaration(node) &&
            !hasModifier(node.modifiers, ts.SyntaxKind.AbstractKeyword, ts.SyntaxKind.StaticKeyword) && (
                // properties with string or computed name are not checked
                node.name.kind !== ts.SyntaxKind.Identifier && node.name.kind !== ts.SyntaxKind.PrivateIdentifier ||
                !isStrictCompilerOptionEnabled(this.context.compilerOptions, 'strictPropertyInitialization') ||
                getNullableFlagsOfReceiver(this.checker.getTypeAtLocation(node)) & ts.TypeFlags.Undefined // type allows undefined
            ))
            this.addFinding(
                node.exclamationToken.end - 1,
                node.exclamationToken.end,
                FAIL_DEFINITE_ASSIGNMENT,
                Replacement.delete(node.exclamationToken.pos, node.exclamationToken.end),
            );
    }

    private checkNonNullAssertion(node: ts.NonNullExpression) {
        let message = FAIL_MESSAGE;
        if (this.strictNullChecks) {
            const originalType = this.checker.getTypeAtLocation(node.expression);
            const flags = getNullableFlags(
                tryGetBaseConstraintType(originalType, this.checker),
                ts.isOptionalChain(node)
                    ? (t) => isOptionalChainingUndefinedMarkerType(this.checker, t) ? 0 : t.flags
                    : undefined,
            );
            if (flags !== 0) { // type is nullable
                const contextualType = this.getSafeContextualType(node);
                if (contextualType === undefined || (flags & ~getNullableFlagsOfReceiver(contextualType)))
                    return;
                message = `This assertion is unnecessary as the receiver accepts ${formatNullableFlags(flags)} values.`;
            }
            if (maybeUsedBeforeBeingAssigned(node.expression, originalType, this.checker)) {
                log('Identifier %s could be used before being assigned', node.expression.text);
                return;
            }
        }
        this.addFinding(node.end - 1, node.end, message, Replacement.delete(node.expression.end, node.end));
    }

    private checkTypeAssertion(node: ts.AssertionExpression) {
        if (isConstAssertion(node)) {
            if (isInConstContext(node))
                this.reportUselessTypeAssertion(node, 'This assertion is unnecessary as it is already in a const context.');
            return;
        }
        let targetType = this.checker.getTypeFromTypeNode(node.type);
        if ((targetType.flags & ts.TypeFlags.Literal) !== 0 && !isInConstContext(node) || // allow "foo" as "foo" to avoid widening
            isTupleType(isTypeReference(targetType) ? targetType.target : targetType))
            return;
        let sourceType = this.checker.getTypeAtLocation(node.expression);
        if ((targetType.flags & (ts.TypeFlags.TypeVariable | ts.TypeFlags.Instantiable)) === 0) {
            targetType = tryGetBaseConstraintType(targetType, this.checker);
            sourceType = tryGetBaseConstraintType(sourceType, this.checker);
        }
        let message = FAIL_MESSAGE;
        if (!typesAreEqual(sourceType, targetType, this.checker)) {
            const contextualType = this.getSafeContextualType(node);
            // TODO use assignability check once it's exposed from TypeChecker
            if (
                contextualType === undefined ||
                contextualType.flags & (ts.TypeFlags.TypeVariable | ts.TypeFlags.Instantiable) ||
                (contextualType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) === 0 &&
                // contextual type is exactly the same
                !typesAreEqual(sourceType, contextualType, this.checker) &&
                // contextual type is an optional parameter or similar
                !typesAreEqual(sourceType, removeOptionalityFromType(this.checker, contextualType), this.checker)
            )
                return;
            message = 'This assertion is unnecessary as the receiver accepts the original type of the expression.';
        }
        this.reportUselessTypeAssertion(node, message);
    }

    private reportUselessTypeAssertion(node: ts.AssertionExpression, message: string) {
        if (node.kind === ts.SyntaxKind.AsExpression) {
            this.addFinding(
                node.type.pos - 'as'.length,
                node.end,
                message,
                Replacement.delete(node.expression.end, node.end),
            );
        } else {
            const start = node.getStart(this.sourceFile);
            const fix = [Replacement.delete(start, node.expression.getStart(this.sourceFile))];
            if (expressionNeedsParensWhenReplacingNode(node.expression, node))
                fix.push(
                    Replacement.append(start, '('),
                    Replacement.append(node.end, ')'),
                );
            this.addFinding(start, node.expression.pos, message, fix);
        }
    }

    /** Returns the contextual type if it is a position that does not contribute to control flow analysis. */
    private getSafeContextualType(node: ts.Expression): ts.Type | undefined {
        const parent = node.parent!;
        // If assertion is used as argument, check if the function accepts this expression without an assertion
        // TODO expand this to VariableLike initializers and return expressions where a type declaration exists
        switch (parent.kind) {
            case ts.SyntaxKind.CallExpression:
            case ts.SyntaxKind.NewExpression:
                if (node === (<ts.CallExpression | ts.NewExpression>parent).expression)
                    return;
                break;
            case ts.SyntaxKind.TemplateSpan: // TODO return 'any' for non-tagged template expressions
            case ts.SyntaxKind.JsxExpression:
                break;
            default:
                return;
        }
        return this.checker.getContextualType(node);
    }
}

function getNullableFlags(type: ts.Type, selector?: (t: ts.Type) => ts.TypeFlags): ts.TypeFlags {
    let flags = 0;
    for (const t of unionTypeParts(type))
        flags |= selector !== undefined ? selector(t) : t.flags;
    return flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined);
}

function getNullableFlagsOfReceiver(type: ts.Type) {
    return getNullableFlags(type, (t) => t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown) ? -1 : t.flags);
}

function formatNullableFlags(flags: ts.TypeFlags) {
    switch (flags) {
        case ts.TypeFlags.Null: return "'null'";
        case ts.TypeFlags.Undefined: return "'undefined'";
        default: return "'null' and 'undefined'";
    }
}

/**
 * Determine if the assertion may be necessary to avoid a compile error for use before being assigned.
 * This function may yield some false negatives, but is needed until https://github.com/Microsoft/TypeScript/issues/20221 is implemented.
 *
 * The rules are as follows:
 * * strictNullChecks are enabled
 * * assertion is on an identifier
 * * identifier is a mutable variable
 * * no destructuring, parameters, catch binding, ambient declarations
 * * variable is not initialized
 * * variable has no definite assignment assertion (exclamation mark)
 * * variable has a type annotation
 * * declared type is equal to the type at the assertion
 * * declaration and assertion are in the same function scope
 *
 * We don't need to worry about strictPropertyInitialization errors, because they cannot be suppressed with a non-null assertion
 */
function maybeUsedBeforeBeingAssigned(node: ts.Expression, type: ts.Type, checker: ts.TypeChecker): node is ts.Identifier {
    if (node.kind !== ts.SyntaxKind.Identifier || getNullableFlagsOfReceiver(type) & ts.TypeFlags.Undefined)
        return false;
    const symbol = checker.getSymbolAtLocation(node)!;
    const declaration = symbol.declarations![0];
    if (!isVariableDeclaration(declaration) ||
        declaration.parent!.kind !== ts.SyntaxKind.VariableDeclarationList ||
        declaration.initializer !== undefined ||
        declaration.exclamationToken !== undefined ||
        declaration.type === undefined ||
        declaration.parent!.parent!.kind === ts.SyntaxKind.VariableStatement &&
            hasModifier(declaration.parent!.parent!.modifiers, ts.SyntaxKind.DeclareKeyword))
        return false;
    if (!typesAreEqual(type, checker.getTypeFromTypeNode(declaration.type), checker))
        return false;
    const declaringFunctionScope = findupFunction(declaration.parent!.parent!.parent!);
    let useFunctionScope = findupFunction(node.parent!.parent!);
    while (useFunctionScope !== declaringFunctionScope && isInlinedIife(useFunctionScope))
        // TypeScript inlines IIFEs, so we need to do as well
        useFunctionScope = findupFunction(useFunctionScope.parent!.parent!);
    return useFunctionScope === declaringFunctionScope;
}

/** Finds the nearest parent that has a function scope. */
function findupFunction(node: ts.Node) {
    while (!isFunctionScopeBoundary(node) && node.kind !== ts.SyntaxKind.SourceFile)
        node = node.parent!;
    return node;
}

function isInlinedIife(node: ts.Node): boolean {
    return (isFunctionExpression(node) || isArrowFunction(node)) &&
        node.asteriskToken === undefined && // exclude generators
        !hasModifier(node.modifiers, ts.SyntaxKind.AsyncKeyword) && // exclude async functions
        getIIFE(node) !== undefined;
}
