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
                        shouldReportEmptyBindingPattern(<ts.ArrayBindingPattern>node),
                        isBindingElementUsed,
                        simplifyBindingRestElement,
                    );
                    break;
                case ts.SyntaxKind.ObjectBindingPattern:
                    this.checkObject(
                        (<ts.ObjectBindingPattern>node).elements,
                        shouldReportEmptyBindingPattern(<ts.ObjectBindingPattern>node),
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
            return;
        }
        let i = elements.length - 1;
        while (true) {
            if (i === 0 || isUsed(elements[i - 1])) {
                const diff = elements.length - i;
                this.addFinding(
                    elements[i].getStart(this.sourceFile),
                    elements.end,
                    diff === 1
                        ? "Destructuring element is not necessary as it doesn't assign to a variable."
                        : "Destructuring elements are not necessary as they don't assign to a variable.",
                    Replacement.delete(elements[i].pos, elements.end),
                );
                break;
            }
            --i;
        }

        for (i -= 2; i >= 0; --i) {
            const element = elements[i];
            if (element.kind !== ts.SyntaxKind.OmittedExpression && !isUsed(element))
                this.addFindingAtNode(
                    element,
                    "Destructuring element is not necessary as it doesn't assign to a variable.",
                    Replacement.delete(element.getStart(this.sourceFile), element.end),
                );
        }
    }
}

function isBindingPropertyUsed(node: ts.BindingElement): boolean {
    return node.dotDotDotToken !== undefined || node.propertyName === undefined  || isNonEmptyBindingTarget(node.name);
}

function isBindingElementUsed(node: ts.ArrayBindingElement): boolean {
    return node.kind !== ts.SyntaxKind.OmittedExpression && isNonEmptyBindingTarget(node.name);
}

function isNonEmptyBindingTarget(node: ts.BindingName): boolean {
    return node.kind === ts.SyntaxKind.Identifier || node.elements.length !== 0;
}

function isAssignmentPropertyUsed(node: ts.ObjectLiteralElementLike): boolean {
    return node.kind !== ts.SyntaxKind.PropertyAssignment || isNonEmptyAssignmentTarget(node.initializer);
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

function shouldReportEmptyBindingPattern(node: ts.BindingPattern) {
    switch (node.parent!.kind) {
        case ts.SyntaxKind.BindingElement:
        case ts.SyntaxKind.Parameter:
            return false;
        default:
            return true;
    }
}
