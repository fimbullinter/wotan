import { excludeDeclarationFiles, TypedRule } from '@fimbul/ymir';
import * as ts from 'typescript';
import { NodeWrap, isTypeNodeKind, isExpression, isIdentifier, getUsageDomain, unionTypeParts, isThenableType, isMethodDeclaration, isPropertyDeclaration, getPropertyName, isValidNumericLiteral } from 'tsutils';
import { getPropertyOfType } from '../utils';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    public apply() {
        this.context.getWrappedAst().children.forEach(this.checkNode, this);
    }

    private checkNode({node, children}: NodeWrap) {
        if (isTypeNodeKind(node.kind))
            return;

        if (isExpression(node)) {
            if (!isIdentifier(node) || getUsageDomain(node) !== undefined)
                this.checkAssignment(node);
        } else if (isPropertyDeclaration(node)) {
            this.checkClassProperty(node);
        } else if (isMethodDeclaration(node)) {
            const parent = node.parent!;
            if (parent.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                this.checkObjectMethodDeclaration(node, parent);
            } else {
                this.checkClassMethod(node, parent);
            }
        }
        return children.forEach(this.checkNode, this);
    }

    private checkAssignment(node: ts.Expression) {
        const targetReturnType = getReturnType(this.checker.getContextualType(node));
        if (targetReturnType === undefined || (targetReturnType.flags & ts.TypeFlags.Void) === 0)
            return;
        const currentReturnType = getReturnType(this.checker.getTypeAtLocation(node));
        if (currentReturnType !== undefined && this.typeContainsThenable(currentReturnType, node))
            this.addFailureAtNode(node, "A 'Promise'-returning function should not be assigned to a 'void'-returning function type.");
    }

    private checkClassProperty(_node: ts.PropertyDeclaration) {

    }

    private checkClassMethod(_node: ts.MethodDeclaration, _parent: ts.ClassLikeDeclaration) {

    }

    private checkObjectMethodDeclaration(node: ts.MethodDeclaration, parent: ts.ObjectLiteralExpression) {
        const staticName = getPropertyName(node.name);
        if (staticName === undefined)
            return; // TODO handle late bound names
        const contextualType = this.checker.getContextualType(parent);
        if (contextualType === undefined)
            return;
        const property = getPropertyOfType(contextualType, ts.escapeLeadingUnderscores(staticName));
        const propertyType = property
            ? this.checker.getTypeOfSymbolAtLocation(property, parent)
            : isValidNumericLiteral(staticName) && String(+staticName) === staticName && contextualType.getNumberIndexType() ||
                contextualType.getStringIndexType();
        const targetReturnType = getReturnType(propertyType);
        if (targetReturnType === undefined || (targetReturnType.flags & ts.TypeFlags.Void) === 0)
            return;
        const signature = this.checker.getSignatureFromDeclaration(node);
        if (signature !== undefined && this.typeContainsThenable(signature.getReturnType(), node))
            this.addFailureAtNode(node, "A 'Promise'-returning function should not be assigned to a 'void'-returning function type.");
    }

    private typeContainsThenable(type: ts.Type, node: ts.Node): boolean {
        return unionTypeParts(type).some((t) => isThenableType(this.checker, node, t));
    }
}

function getReturnType(type: ts.Type | undefined): ts.Type | undefined {
    if (type === undefined)
        return;
    const callSignatures = type.getCallSignatures();
    if (callSignatures.length !== 1)
        return;
    return callSignatures[0].getReturnType();
}
