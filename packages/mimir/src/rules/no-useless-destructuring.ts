import { excludeDeclarationFiles, AbstractRule, Replacement } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isReassignmentTarget, isSpreadElement, isArrayLiteralExpression } from 'tsutils';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        for (const node of this.context.getFlatAst()) {
            switch (node.kind) {
                case ts.SyntaxKind.ArrayLiteralExpression:
                    if (isReassignmentTarget(<ts.ArrayLiteralExpression>node))
                        this.checkArray(<ts.ArrayLiteralExpression>node, isValidDestructuringTarget, simplifyArrayLiteralRest);
                    break;
                case ts.SyntaxKind.ObjectLiteralExpression:
                    if (isReassignmentTarget(<ts.ObjectLiteralExpression>node))
                        this.checkObject(
                            (<ts.ObjectLiteralExpression>node).properties,
                            isObjectDestructuringPropertyUsed,
                            isObjectRestDestructuring,
                            <ts.ObjectLiteralExpression>node,
                        );
                    break;
                case ts.SyntaxKind.ArrayBindingPattern:
                    this.checkArray(<ts.ArrayBindingPattern>node, isArrayBindingElementUsed, simplifyArrayBindingRest);
                    break;
                case ts.SyntaxKind.ObjectBindingPattern:
                    this.checkObject(
                        (<ts.ObjectBindingPattern>node).elements,
                        isBindingElementUsed,
                        () => false,
                        <ts.ObjectBindingPattern>node,
                    );
            }
        }
    }

    private checkObject<T extends ts.BindingElement | ts.ObjectLiteralElementLike>(
        properties: ts.NodeArray<T>,
        isUsed: (property: T) => boolean,
        isRestPropertyDestructured: (property: T) => boolean,
        node: ts.Node,
    ) {
        let unused = true;
        for (let i = 0; ; ++i) {
            const isLast = i === properties.length - 1;
            const property = properties[i];
            if (!isUsed(property)) {
                this.addFailureAtNode(
                    property,
                    'Destructuring property is not necessary',
                    // make sure to delete the next comma to avoid consecutive commas
                    Replacement.delete(node.pos, isLast ? properties.end : properties[i + 1].pos),
                );
            } else {
                unused = false;
                if (isLast && isRestPropertyDestructured(property))
                    // TODO remove once TypeScript does this check
                    this.addFailureAtNode(node, 'Destructuring object rest is not allowed.');
            }
            if (isLast)
                break;
        }
        if (unused)
            this.addFailureAtNode(node, 'Destructuring is not necessary.');
    }

    private checkArray<T extends ts.ArrayBindingOrAssignmentPattern>(
        node: T,
        isUsed: (member: T['elements'][number]) => boolean,
        trySimplifyRest: (member: T['elements'][number]) => Replacement[] | undefined,
    ) {
        const elements = node.elements;
        for (let i = elements.length - 1; i >= 0; --i) {
            const element = elements[i];
            if (isUsed(element)) {
                if (i === elements.length - 1) {
                    const simplifyRest = trySimplifyRest(element);
                    if (simplifyRest !== undefined)
                        this.addFailureAtNode(element, 'Array destructuring withing array rest is redundant.', simplifyRest);
                } else {
                    this.addFailureAtNode(
                        element,
                        `Destructuring element${i === elements.length - 2 ? ' is' : 's are'} not necessary.`,
                        Replacement.delete(element.end, elements.end),
                    );
                }
                return;
            }
        }
        this.addFailureAtNode(node, 'Destructuring is not necessary');
    }
}

function isBindingElementUsed(node: ts.BindingElement): boolean {
    return node.propertyName === undefined || isValidBindingElementTarget(node.name);
}

function isArrayBindingElementUsed(node: ts.ArrayBindingElement): boolean {
    return node.kind !== ts.SyntaxKind.OmittedExpression && isValidBindingElementTarget(node.name);
}

function isValidBindingElementTarget(node: ts.BindingName): boolean {
    switch (node.kind) {
        case ts.SyntaxKind.Identifier:
            return true;
        case ts.SyntaxKind.ObjectBindingPattern:
            return node.elements.some(isBindingElementUsed);
        case ts.SyntaxKind.ArrayBindingPattern:
            return node.elements.some(isArrayBindingElementUsed);
    }
}

function isObjectDestructuringPropertyUsed(node: ts.ObjectLiteralElementLike): boolean {
    switch (node.kind) {
        case ts.SyntaxKind.PropertyAssignment:
            return isValidDestructuringTarget(node.initializer);
        case ts.SyntaxKind.SpreadAssignment:
            return isValidDestructuringTarget(node.expression);
        default:
            return true; // other than ShorthandPropertyAssignment there will be an error anyway
    }
}

function isValidDestructuringTarget(node: ts.Expression): boolean {
    switch (node.kind) {
        case ts.SyntaxKind.OmittedExpression: // only possible in array destructuring
            return false;
        case ts.SyntaxKind.SpreadElement: // only possible in array destructuring
        case ts.SyntaxKind.ParenthesizedExpression:
            return isValidDestructuringTarget((<ts.SpreadElement | ts.ParenthesizedExpression>node).expression);
        case ts.SyntaxKind.ObjectLiteralExpression:
            return (<ts.ObjectLiteralExpression>node).properties.some(isObjectDestructuringPropertyUsed);
        case ts.SyntaxKind.ArrayLiteralExpression:
            return (<ts.ArrayLiteralExpression>node).elements.some(isValidDestructuringTarget);
        case ts.SyntaxKind.BinaryExpression:
            return (<ts.BinaryExpression>node).operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
                isValidDestructuringTarget((<ts.BinaryExpression>node).left);
        default:
            return true;
    }
}

function simplifyArrayBindingRest(node: ts.ArrayBindingElement) {
    if (
        node.kind === ts.SyntaxKind.OmittedExpression ||
        node.dotDotDotToken === undefined ||
        node.name.kind !== ts.SyntaxKind.ArrayBindingPattern
    )
        return;
    return [
        Replacement.delete(node.pos, node.name.elements.pos),
        Replacement.delete(node.name.elements.end, node.end),
    ];
}

function simplifyArrayLiteralRest(node: ts.Expression) {
    if (!isSpreadElement(node) || !isArrayLiteralExpression(node.expression))
        return;
    return [
        Replacement.delete(node.pos, node.expression.elements.pos),
        Replacement.delete(node.expression.elements.end, node.end),
    ];
}

function isObjectRestDestructuring(node: ts.ObjectLiteralElementLike) {
    return node.kind === ts.SyntaxKind.SpreadAssignment &&
        (node.expression.kind === ts.SyntaxKind.ObjectLiteralExpression || node.expression.kind === ts.SyntaxKind.ArrayLiteralExpression);
}
