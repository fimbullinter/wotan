import { excludeDeclarationFiles, typescriptOnly, TypedRule } from '@fimbul/ymir';
import { isAssertionExpression, unionTypeParts } from 'tsutils';
import * as ts from 'typescript';

@excludeDeclarationFiles
@typescriptOnly
export class Rule extends TypedRule {
    public apply() {
        for (const node of this.context.getFlatAst())
            if (isAssertionExpression(node))
                this.checkAssertion(node);
    }

    private checkAssertion(node: ts.AssertionExpression) {
        const assertedTypes = getLiteralsByType(unionTypeParts(this.checker.getTypeFromTypeNode(node.type)));
        if (isEmpty(assertedTypes))
            return;
        let originalType = this.checker.getTypeAtLocation(node.expression);
        originalType = this.checker.getBaseConstraintOfType(originalType) || originalType;
        const originalTypeParts = getLiteralsByType(unionTypeParts(originalType));
        if (isEmpty(originalTypeParts))
            return;
        match(originalTypeParts, assertedTypes);
        if (!isEmpty(assertedTypes))
            this.addFailureAtNode(node, `Type '${format(originalTypeParts)}' cannot be converted to type '${format(assertedTypes)}'.`);
    }
}

function format(literals: LiteralInfo) {
    const result = [];
    if (literals.string !== undefined)
        result.push(`"${literals.string.join('" | "')}"`);
    if (literals.number !== undefined)
        result.push(literals.number.join(' | '));
    if (literals.boolean !== undefined)
        result.push(literals.boolean.join(' | '));
    return result.join(' | ');
}

function match(a: LiteralInfo, b: LiteralInfo) {
    if (a.string === undefined || b.string === undefined || intersects(a.string, b.string))
        a.string = b.string = undefined;
    if (a.number === undefined || b.number === undefined || intersects(a.number, b.number))
        a.number = b.number = undefined;
    if (a.boolean === undefined || b.boolean === undefined || intersects(a.boolean, b.boolean))
        a.boolean = b.boolean = undefined;
}

function intersects<T>(arr: T[], other: T[]): boolean {
    for (const element of arr)
        if (other.includes(element))
            return true;
    return false;
}

function isEmpty(literals: LiteralInfo) {
    return literals.string === undefined && literals.number === undefined && literals.boolean === undefined;
}

interface LiteralInfo {
    string: string[] | undefined;
    number: number[] | undefined;
    boolean: boolean[] | undefined;
}

function getLiteralsByType(types: ReadonlyArray<ts.Type>) {
    const result: LiteralInfo = {
        string: undefined,
        number: undefined,
        boolean: undefined,
    };
    for (const type of types) {
        if (type.flags & ts.TypeFlags.StringLiteral) {
            result.string = append(result.string, (<ts.StringLiteralType>type).value);
        } else if (type.flags & ts.TypeFlags.NumberLiteral) {
            result.number = append(result.number, (<ts.NumberLiteralType>type).value);
        } else if (type.flags & ts.TypeFlags.BooleanLiteral) {
            result.boolean = append(result.boolean, (<{intrinsicName: string}><{}>type).intrinsicName === 'true');
        }
    }
    return result;
}

function append<T>(arr: T[] | undefined, v: T) {
    if (arr === undefined)
        return [v];
    arr.push(v);
    return arr;
}
