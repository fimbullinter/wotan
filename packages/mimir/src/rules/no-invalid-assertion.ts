import { excludeDeclarationFiles, typescriptOnly, TypedRule } from '@fimbul/ymir';
import { unionTypeParts, isIntersectionType } from 'tsutils';
import * as ts from 'typescript';
import { formatPseudoBigInt } from '../utils';

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
        const assertedLiterals = getLiteralsByType(assertedType);
        if (isEmpty(assertedLiterals))
            return;
        // if expression is a type variable, the type checker already handles everything as expected
        const originalTypeParts = getLiteralsByType(this.checker.getTypeAtLocation(node.expression));
        if (isEmpty(originalTypeParts))
            return;
        match(originalTypeParts, assertedLiterals);
        if (!isEmpty(assertedLiterals))
            this.addFindingAtNode(node, `Type '${format(originalTypeParts)}' cannot be converted to type '${format(assertedLiterals)}'.`);
    }
}

function format(literals: LiteralInfo) {
    const result = [];
    if (literals.string !== undefined)
        result.push(`"${Array.from(literals.string).join('" | "')}"`);
    if (literals.number !== undefined)
        result.push(Array.from(literals.number).join(' | '));
    if (literals.bigint !== undefined)
        result.push(Array.from(literals.bigint).join(' | '));
    if (literals.boolean !== undefined)
        result.push(`${literals.boolean}`);
    return result.join(' | ');
}

function match(a: LiteralInfo, b: LiteralInfo) {
    if (a.string === undefined || b.string === undefined || intersects(a.string, b.string))
        a.string = b.string = undefined;
    if (a.number === undefined || b.number === undefined || intersects(a.number, b.number))
        a.number = b.number = undefined;
    if (a.bigint === undefined || b.bigint === undefined || intersects(a.bigint, b.bigint))
        a.bigint = b.bigint = undefined;
    if (a.boolean === undefined || b.boolean === undefined || a.boolean === b.boolean)
        a.boolean = b.boolean = undefined;
}

function intersects<T>(arr: Iterable<T>, other: Set<T>): boolean {
    for (const element of arr)
        if (other.has(element))
            return true;
    return false;
}

function isEmpty(literals: LiteralInfo) {
    return literals.string === undefined &&
        literals.number === undefined &&
        literals.bigint === undefined &&
        literals.boolean === undefined;
}

interface LiteralInfo {
    string: Set<string> | undefined;
    number: Set<number> | undefined;
    bigint: Set<string> | undefined;
    boolean: boolean | undefined;
}

function getLiteralsByType(type: ts.Type) {
    const result: LiteralInfo = {
        string: undefined,
        number: undefined,
        bigint: undefined,
        boolean: undefined,
    };
    // typically literal types are swallowed by their corresponding widened type if they occur in the same union
    // this is not the case with intersections: `(string & {foo: string}) | ('bar' & {bar: string})`
    // therefore we need to reset all previously seen literal types if we see the widened type
    // we also need to remember not to store any new literal types of that kind
    let seenString = false;
    let seenNumber = false;
    let seenBigint = false;
    let seenBoolean = false;
    for (const t of typeParts(type)) {
        if (t.flags & ts.TypeFlags.StringLiteral) {
            if (!seenString)
                result.string = append(result.string, (<ts.StringLiteralType>t).value);
        } else if (t.flags & ts.TypeFlags.NumberLiteral) {
            if (!seenNumber)
                result.number = append(result.number, (<ts.NumberLiteralType>t).value);
        } else if (t.flags & ts.TypeFlags.BigIntLiteral) {
            if (!seenBigint)
                result.bigint = append(result.bigint, formatPseudoBigInt((<ts.BigIntLiteralType>t).value));
        } else if (t.flags & ts.TypeFlags.BooleanLiteral) {
            if (!seenBoolean) {
                const current = (<{intrinsicName: string}><{}>t).intrinsicName === 'true';
                if (result.boolean === undefined) {
                    result.boolean = current;
                } else if (result.boolean !== current) {
                    result.boolean = undefined;
                    seenBoolean = true;
                }
            }
        } else if (t.flags & ts.TypeFlags.String) {
            result.string = undefined;
            seenString = true;
        } else if (t.flags & ts.TypeFlags.Number) {
            result.number = undefined;
            seenNumber = true;
        } else if (t.flags & ts.TypeFlags.BigInt) {
            result.bigint = undefined;
            seenBigint = true;
        }
    }
    return result;
}

function* typeParts(type: ts.Type) {
    for (const t of unionTypeParts(type)) {
        if (isIntersectionType(t)) {
            yield* t.types;
        } else {
            yield t;
        }
    }
}

function append<T>(set: Set<T> | undefined, v: T) {
    if (set === undefined)
        return new Set([v]);
    set.add(v);
    return set;
}
