import * as ts from 'typescript';
import { AbstractRule, Replacement, excludeDeclarationFiles } from '@fimbul/ymir';
import {
    WrappedAst,
    getWrappedNodeAtPosition,
    isArrayLiteralExpression,
    isOmittedExpression,
    isSpreadElement,
    isSpreadAssignment,
    isReassignmentTarget,
    isObjectLiteralExpression,
} from 'tsutils';

const FAILURE_STRING = 'Using the spread operator here is not necessary.';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        const re = /\.{3}\s*[/[{]/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const { node } = getWrappedNodeAtPosition(
                wrappedAst || (wrappedAst = this.context.getWrappedAst()),
                match.index,
            )!;
            if (
                ((isSpreadElement(node) &&
                    isArrayLiteralExpression(node.expression) &&
                    (!node.expression.elements.some(isOmittedExpression) || isReassignmentTarget(node))) ||
                    (isSpreadAssignment(node) && isObjectLiteralExpression(node.expression))) &&
                node.expression.pos - 3 === match.index
            )
                this.addFailureAtNode(node, FAILURE_STRING, removeUselessSpread(node));
        }
    }
}

function removeUselessSpread(node: ts.SpreadElement | ts.SpreadAssignment): Replacement | Replacement[] {
    /* Handles edge cases of spread on empty array literals */
    if (
        isSpreadElement(node) &&
        isArrayLiteralExpression(node.expression) &&
        node.expression.elements.length === 0 &&
        node.parent &&
        isArrayLiteralExpression(node.parent)
    )
        return removeUselessSpreadOfEmptyArray(node);

    const replacements = [
        Replacement.delete(node.getStart(), node.expression.getStart() + 1),
        Replacement.delete(node.expression.end - 1, node.expression.end),
    ];

    /* Handles trailing commas in array/object literals */
    if (isSpreadElement(node) && isArrayLiteralExpression(node.expression) && node.expression.elements.hasTrailingComma)
        replacements.push(Replacement.delete(node.expression.elements.end - 1, node.expression.elements.end));

    if (
        isSpreadAssignment(node) &&
        isObjectLiteralExpression(node.expression) &&
        node.expression.properties.hasTrailingComma
    )
        replacements.push(Replacement.delete(node.expression.properties.end - 1, node.expression.properties.end));

    return replacements;
}

function removeUselessSpreadOfEmptyArray(node: ts.SpreadElement): Replacement {
    const parent = <ts.ArrayLiteralExpression>node.parent!;

    if (parent.elements.length === 1) return Replacement.delete(parent.elements.pos, parent.elements.end);

    const spreadElementIndex = parent.elements.findIndex((el) => el === node);
    return spreadElementIndex === parent.elements.length - 1
        ? Replacement.delete(node.getFullStart(), parent.elements.end)
        : Replacement.delete(node.getFullStart(), parent.elements[spreadElementIndex + 1].pos);
}
