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
        match(originalTypeParts, assertedTypes, 'string');
        match(originalTypeParts, assertedTypes, 'number');
        match(originalTypeParts, assertedTypes, 'boolean');
        if (!isEmpty(assertedTypes))
            this.addFailureAtNode(node, `Type '${format(originalTypeParts)}' cannot be converted to type '${format(assertedTypes)}'.`);
    }
}

function format(literals: LiteralInfo) {
    const result = [];
    if (literals.string.length !== 0)
        result.push(`"${literals.string.join('" | "')}"`);
    if (literals.number.length !== 0)
        result.push(literals.number.join(' | '));
    if (literals.boolean.length !== 0)
        result.push(literals.boolean.join(' | '));
    return result.join(' | ');
}

function match<K extends keyof LiteralInfo, V extends LiteralInfo[K][number]>(a: Record<K, V[]>, b: Record<K, V[]>, key: K) {
    if (intersects(a[key], b[key]))
        a[key] = b[key] = [];
}

function intersects<T>(arr: T[], other: T[]): boolean {
    if (arr.length === 0 || other.length === 0)
        return true;
    for (const element of arr)
        if (other.includes(element))
            return true;
    return false;
}

function isEmpty(literals: LiteralInfo) {
    return literals.string.length === 0 && literals.number.length === 0 && literals.boolean.length === 0;
}

interface LiteralInfo {
    string: string[];
    number: number[];
    boolean: boolean[];
}

function getLiteralsByType(types: ReadonlyArray<ts.Type>) {
    const result: LiteralInfo = {
        string: [],
        number: [],
        boolean: [],
    };
    for (const type of types) {
        if (type.flags & ts.TypeFlags.StringLiteral) {
            result.string.push((<ts.StringLiteralType>type).value);
        } else if (type.flags & ts.TypeFlags.NumberLiteral) {
            result.number.push((<ts.NumberLiteralType>type).value);
        } else if (type.flags & ts.TypeFlags.BooleanLiteral) {
            result.boolean.push((<{intrinsicName: string}><{}>type).intrinsicName === 'true');
        }
    }
    return result;
}
