import * as ts from 'typescript';
import { AbstractRule, Replacement, excludeDeclarationFiles } from '@fimbul/ymir';
import {
    WrappedAst,
    getWrappedNodeAtPosition,
    isArrayLiteralExpression,
    isOmittedExpression,
    isReassignmentTarget,
    isObjectLiteralExpression,
    getPropertyName,
    isValidJsxIdentifier,
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
            if (node.getStart(this.sourceFile) !== match.index)
                continue;
            switch (node.kind) {
                case ts.SyntaxKind.SpreadElement:
                    this.checkSpreadElement(<ts.SpreadElement>node);
                    break;
                case ts.SyntaxKind.SpreadAssignment:
                    this.checkSpreadAssignment(<ts.SpreadAssignment>node);
                    break;
                case ts.SyntaxKind.JsxSpreadAttribute:
                    this.checkJsxSpreadAttribute(<ts.JsxSpreadAttribute>node);
            }
        }
    }

    private checkSpreadElement(node: ts.SpreadElement) {
        if (!isArrayLiteralExpression(node.expression) || node.expression.elements.some(isOmittedExpression) && isReassignmentTarget(node))
            return;
        this.addFailureAtNode(node, FAILURE_STRING, removeUselessSpread(node, node.expression.elements));
    }

    private checkSpreadAssignment(node: ts.SpreadAssignment) {
        if (!isObjectLiteralExpression(node.expression))
            return;
        this.addFailureAtNode(node, FAILURE_STRING, removeUselessSpread(node, node.expression.properties));
    }

    private checkJsxSpreadAttribute(node: ts.JsxSpreadAttribute) {
        if (!isObjectLiteralExpression(node.expression) || !canConvertObjectSpreadToJsx(node.expression))
            return;
        this.addFailureAtNode(node, FAILURE_STRING, removeUselessJsxSpreadAttribute(node, node.expression.properties));
    }
}

type PropertiesConvertableToJsx = ts.SpreadAssignment | ts.ShorthandPropertyAssignment | ts.PropertyAssignment;

function canConvertObjectSpreadToJsx(
    node: ts.ObjectLiteralExpressionBase<ts.ObjectLiteralElementLike>,
): node is ts.ObjectLiteralExpressionBase<PropertiesConvertableToJsx> {
    for (const property of node.properties) {
        switch (property.kind) {
            case ts.SyntaxKind.SpreadAssignment:
            case ts.SyntaxKind.ShorthandPropertyAssignment:
                break;
            case ts.SyntaxKind.PropertyAssignment:
                const staticName = getPropertyName(property.name);
                if (staticName === undefined || !isValidJsxIdentifier(staticName))
                    return false;
                break;
            default:
                // TODO do something special for MethodDeclaration?
                // exclude accessors
                return false;
        }
    }
    return true;
}

function removeUselessJsxSpreadAttribute(node: ts.JsxSpreadAttribute, properties: ts.NodeArray<PropertiesConvertableToJsx>) {
    let prevEnd = node.pos;
    let append = '';
    const fix: Replacement[] = [];
    for (const property of properties) {
        switch (property.kind) {
            case ts.SyntaxKind.SpreadAssignment:
                replaceLeading(property.expression.pos - 3, '{');
                replaceTrailing(property.end, '}');
                break;
            case ts.SyntaxKind.PropertyAssignment:
                const name = getPropertyName(property.name)!;
                replaceLeading(property.initializer.pos, `${name}={`);
                replaceTrailing(property.end, '}');
                break;
            default:
                replaceLeading(property.getStart(), '');
                replaceTrailing(property.end, `={${property.name.text}}`);
        }
    }
    fix.push(Replacement.replace(prevEnd, node.end, append));
    return fix;

    // we need to merge fixes manually using these functions
    // otherwise replacement ranges would always start at the beginning of the previous one
    function replaceLeading(end: number, newText: string) {
        fix.push(Replacement.replace(prevEnd, end, `${append} ${newText}`));
    }
    function replaceTrailing(start: number, newText: string) {
        prevEnd = start;
        append = newText;
    }
}

function removeUselessSpread(node: ts.SpreadAssignment | ts.SpreadElement, elements: ts.NodeArray<ts.Node>) {
    if (elements.length === 0) {
        // handle special case of empty object or array to remove trailing comma
        const parent = node.parent!;
        const containingList: ts.NodeArray<ts.Node> = parent.kind === ts.SyntaxKind.ArrayLiteralExpression
            ? parent.elements
            : parent.kind === ts.SyntaxKind.ObjectLiteralExpression
                ? parent.properties
                : parent.arguments!;
        const index = containingList.indexOf(node);
        return Replacement.delete(node.pos, index === containingList.length - 1 ? containingList.end : containingList[index + 1].pos);
    }
    return [
        Replacement.delete(node.expression.pos - 3, elements.pos),
        Replacement.delete(elements[elements.length - 1].end, node.expression.end),
    ];
}
