import { excludeDeclarationFiles, typescriptOnly, TypedRule } from '@fimbul/ymir';
import { unionTypeParts } from 'tsutils';
import * as ts from 'typescript';

@excludeDeclarationFiles
@typescriptOnly
export class Rule extends TypedRule {
    public apply() {
        for (const node of this.context.getFlatAst()) {
            switch (node.kind) {
                case ts.SyntaxKind.AsExpression:
                case ts.SyntaxKind.TypeAssertionExpression:
                    this.checkAssertion(<ts.AssertionExpression>node);
            }
        }
    }

    private checkAssertion(node: ts.AssertionExpression) {
        let assertedType = this.checker.getTypeFromTypeNode(node.type);
        assertedType = this.checker.getBaseConstraintOfType(assertedType) || assertedType;
        const assertedLiterals = getLiteralsByType(unionTypeParts(assertedType));
        if (isEmpty(assertedLiterals))
            return;
        // if expression is a type variable, the type checker already handles everything as expected
        const originalTypeParts = getLiteralsByType(unionTypeParts(this.checker.getTypeAtLocation(node.expression)!));
        if (isEmpty(originalTypeParts))
            return;
        match(originalTypeParts, assertedLiterals);
        if (!isEmpty(assertedLiterals))
            this.addFailureAtNode(node, `Type '${format(originalTypeParts)}' cannot be converted to type '${format(assertedLiterals)}'.`);
    }
}

function format(literals: LiteralInfo) {
    const result = [];
    if (literals.string !== undefined)
        result.push(`"${literals.string.join('" | "')}"`);
    if (literals.number !== undefined)
        result.push(literals.number.join(' | '));
    if (literals.boolean !== undefined)
        result.push(`${literals.boolean}`);
    return result.join(' | ');
}

function match(a: LiteralInfo, b: LiteralInfo) {
    if (a.string === undefined || b.string === undefined || intersects(a.string, b.string))
        a.string = b.string = undefined;
    if (a.number === undefined || b.number === undefined || intersects(a.number, b.number))
        a.number = b.number = undefined;
    if (a.boolean === undefined || b.boolean === undefined || a.boolean === b.boolean)
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
    boolean: boolean | undefined;
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
            const current = (<{intrinsicName: string}><{}>type).intrinsicName === 'true';
            if (result.boolean !== current)
                result.boolean = result.boolean === undefined ? current : undefined;
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
