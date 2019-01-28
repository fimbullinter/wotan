import { excludeDeclarationFiles, AbstractRule, Replacement } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isReassignmentTarget, isSpreadElement, isArrayLiteralExpression, isSpreadAssignment } from 'tsutils';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        for (const node of this.context.getFlatAst()) {
            switch (node.kind) {
                case ts.SyntaxKind.ArrayLiteralExpression:
                    if (isReassignmentTarget(<ts.ArrayLiteralExpression>node))
                        this.checkArray(
                            <ts.ArrayLiteralExpression>node,
                            node.parent!.kind === ts.SyntaxKind.BinaryExpression,
                            isNonEmptyAssignmentTarget,
                            simplifyAssignmentRestElement,
                        );
                    break;
                case ts.SyntaxKind.ObjectLiteralExpression:
                    if (isReassignmentTarget(<ts.ObjectLiteralExpression>node))
                        this.checkObject(
                            (<ts.ObjectLiteralExpression>node).properties,
                            node.parent!.kind === ts.SyntaxKind.BinaryExpression,
                            isAssignmentPropertyUsed,
                            isSpreadAssignment,
                            <ts.ObjectLiteralExpression>node,
                        );
                    break;
                case ts.SyntaxKind.ArrayBindingPattern:
                    this.checkArray(
                        <ts.ArrayBindingPattern>node,
                        node.parent!.kind !== ts.SyntaxKind.BindingElement,
                        isBindingElementUsed,
                        simplifyBindingRestElement,
                    );
                    break;
                case ts.SyntaxKind.ObjectBindingPattern:
                    this.checkObject(
                        (<ts.ObjectBindingPattern>node).elements,
                        node.parent!.kind !== ts.SyntaxKind.BindingElement,
                        isBindingPropertyUsed,
                        isBindingRestProperty,
                        <ts.ObjectBindingPattern>node,
                    );
            }
        }
    }

    private checkObject<T extends ts.BindingElement | ts.ObjectLiteralElementLike>(
        properties: ts.NodeArray<T>,
        reportEmpty: boolean,
        isUsed: (property: T) => boolean,
        isRestProperty: (property: T) => boolean,
        node: T['parent'],
    ) {
        if (properties.length === 0) {
            if (reportEmpty)
                this.addFindingAtNode(node, 'Object destructuring is not necessary as it contains no properties.');
            return;
        }

        if (isRestProperty(properties[properties.length - 1]))
            return; // don't report empty property destructuring if there is a rest property as it's used to exclude properties

        for (let i = 0; ; ++i) {
            const isLast = i === properties.length - 1;
            const property = properties[i];
            if (!isUsed(property))
                this.addFindingAtNode(
                    property,
                    "Destructuring property is not necessary as it doesn't assign to a variable.",
                    // make sure to delete the next comma to avoid consecutive commas
                    Replacement.delete(property.pos, isLast ? properties.end : properties[i + 1].pos),
                );
            if (isLast)
                break;
        }
    }

    private checkArray<T extends ts.ArrayBindingOrAssignmentPattern>(
        node: T,
        reportEmpty: boolean,
        isUsed: (member: T['elements'][number]) => boolean,
        trySimplifyRest: (member: T['elements'][number]) => T | undefined,
    ) {
        const elements = node.elements;
        if (elements.length === 0) {
            if (reportEmpty)
                this.addFindingAtNode(node, 'Array destructuring is not necessary as it contains no elements.');
            return;
        }
        const last = elements[elements.length - 1];
        if (isUsed(last)) {
            const restDestructuring = trySimplifyRest(last);
            if (restDestructuring !== undefined)
                this.addFindingAtNode(last, 'Array destructuring within array rest is redundant.', [
                    Replacement.delete(last.pos, restDestructuring.elements.pos),
                    Replacement.delete(restDestructuring.elements.end, last.end),
                ]);
        } else {
            this.addFindingAtNode(
                last,
                "Destructuring element is not necessary as it doesn't assign to a variable.",
                Replacement.delete(last.pos, elements.end),
            );
        }
        // TODO report all useless trailing elements at once
        // TODO report empty destructuring in previous elements
    }
}

function isBindingPropertyUsed(node: ts.BindingElement): boolean {
    return node.propertyName === undefined && node.dotDotDotToken === undefined || isNonEmptyBindingTarget(node.name);
}

function isBindingElementUsed(node: ts.ArrayBindingElement): boolean {
    return node.kind !== ts.SyntaxKind.OmittedExpression && isNonEmptyBindingTarget(node.name);
}

function isNonEmptyBindingTarget(node: ts.BindingName): boolean {
    return node.kind === ts.SyntaxKind.Identifier || node.elements.length !== 0;
}

function isAssignmentPropertyUsed(node: ts.ObjectLiteralElementLike): boolean {
    switch (node.kind) {
        case ts.SyntaxKind.PropertyAssignment:
            return isNonEmptyAssignmentTarget(node.initializer);
        case ts.SyntaxKind.SpreadAssignment:
            return isNonEmptyAssignmentTarget(node.expression);
        default:
            return true; // other than ShorthandPropertyAssignment there will be an error anyway
    }
}

function isNonEmptyAssignmentTarget(node: ts.Expression): boolean {
    switch (node.kind) {
        case ts.SyntaxKind.OmittedExpression: // only possible in array destructuring
            return false;
        case ts.SyntaxKind.SpreadElement: // only possible in array destructuring
            return isNonEmptyAssignmentTarget((<ts.SpreadElement>node).expression);
        case ts.SyntaxKind.ObjectLiteralExpression:
            return (<ts.ObjectLiteralExpression>node).properties.length !== 0;
        case ts.SyntaxKind.ArrayLiteralExpression:
            return (<ts.ArrayLiteralExpression>node).elements.length !== 0;
        default:
            return true;
    }
}

function simplifyBindingRestElement(node: ts.ArrayBindingElement) {
    return node.kind === ts.SyntaxKind.OmittedExpression ||
        node.dotDotDotToken === undefined ||
        node.name.kind !== ts.SyntaxKind.ArrayBindingPattern
            ? undefined
            : node.name;
}

function simplifyAssignmentRestElement(node: ts.Expression) {
    return isSpreadElement(node) && isArrayLiteralExpression(node.expression) ? node.expression : undefined;
}

function isBindingRestProperty(node: ts.BindingElement) {
    return node.dotDotDotToken !== undefined;
}
