import { AbstractRule, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import {
    isTextualLiteral,
    isNumericLiteral,
    isPrefixUnaryExpression,
    isIdentifier,
    isLiteralType,
    unionTypeParts,
    isStrictCompilerOptionEnabled,
    formatPseudoBigInt,
    isBooleanLiteralType,
} from 'tsutils';
import { isBigIntLiteral } from 'tsutils/typeguard/3.2';
import { switchStatements } from '../utils';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        for (const {caseBlock: {clauses}} of switchStatements(this.context)) {
            const expressionsSeen = new Set<string>();
            const valuesSeen = new Set<Primitive>();
            for (const clause of clauses) {
                if (clause.kind === ts.SyntaxKind.DefaultClause)
                    continue;
                const text = clause.expression.getText(this.sourceFile);
                if (expressionsSeen.has(text)) {
                    this.addFindingAtNode(clause.expression, `Duplicate 'case ${text}'.`);
                    continue;
                }
                expressionsSeen.add(text);
                const literals = this.getLiteralValue(clause.expression);
                switch (literals.length) {
                    case 0:
                        break;
                    case 1:
                        if (valuesSeen.has(literals[0])) {
                            this.addFindingAtNode(clause.expression, `Duplicate 'case ${literals[0]}'.`);
                        } else {
                            valuesSeen.add(literals[0]);
                        }
                        break;
                    default:
                        // union of literal types, do not add these to `valuesSeen`, but display an error if all literals were already seen
                        if (literals.every((v) => valuesSeen.has(v)))
                            this.addFindingAtNode(
                                clause.expression,
                                `Duplicate 'case ${literals.sort().join(' | ')}'.`,
                            );
                }
            }
        }
    }

    private getLiteralValue(node: ts.Expression): string[] {
        let prefixFn: ApplyPrefixFn = identity;
        while (isPrefixUnaryExpression(node)) {
            const next = makePrefixFn(node, prefixFn);
            if (next === undefined)
                return [];
            prefixFn = next;
            node = node.operand;
        }
        if (isTextualLiteral(node))
            return [formatPrimitive(prefixFn(node.text))];
        if (isNumericLiteral(node))
            return [formatPrimitive(prefixFn(+node.text))];
        if (isBigIntLiteral(node))
            return [formatPrimitive(prefixFn({base10Value: node.text.slice(0, -1), negative: false}))];
        if (node.kind === ts.SyntaxKind.NullKeyword)
            return [formatPrimitive(prefixFn(null))]; // tslint:disable-line:no-null-keyword
        if (isIdentifier(node) && node.originalKeywordKind === ts.SyntaxKind.UndefinedKeyword)
            return [formatPrimitive(prefixFn(undefined))];
        if (node.kind === ts.SyntaxKind.TrueKeyword)
            return [formatPrimitive(prefixFn(true))];
        if (node.kind === ts.SyntaxKind.FalseKeyword)
            return [formatPrimitive(prefixFn(false))];

        if (this.context.compilerOptions === undefined || !isStrictCompilerOptionEnabled(this.context.compilerOptions, 'strictNullChecks'))
            return [];
        const checker = this.program!.getTypeChecker();
        let type = checker.getTypeAtLocation(node);
        type = checker.getBaseConstraintOfType(type) || type;
        const result = new Set<string>();
        for (const t of unionTypeParts(type)) {
            // TODO handle intersection types
            if (isLiteralType(t)) {
                result.add(formatPrimitive(prefixFn(t.value)));
            } else if (t.flags & ts.TypeFlags.BooleanLiteral) {
                result.add(formatPrimitive(prefixFn(isBooleanLiteralType(t, true))));
            } else if (t.flags & ts.TypeFlags.Undefined) {
                result.add(formatPrimitive(prefixFn(undefined)));
            } else if (t.flags & ts.TypeFlags.Null) {
                result.add(formatPrimitive(prefixFn(null))); // tslint:disable-line:no-null-keyword
            } else {
                return [];
            }
        }
        return Array.from(result);
    }
}

type Primitive = string | number | boolean | undefined | null | ts.PseudoBigInt;

type ApplyPrefixFn = (v: Primitive) => Primitive;

function identity<T>(v: T): T {
    return v;
}

function makePrefixFn(node: ts.PrefixUnaryExpression, next: ApplyPrefixFn): ApplyPrefixFn | undefined {
    switch (node.operator) {
        case ts.SyntaxKind.PlusToken:
            return (v) => isBigInt(v) ? next(v) : next(+v!);
        case ts.SyntaxKind.MinusToken:
            // there's no '-0n'
            return (v) => isBigInt(v) ? next({...v, negative: !v.negative && v.base10Value !== '0'}) : next(-v!);
        case ts.SyntaxKind.TildeToken:
            return (v) => isBigInt(v) ? negateBigint(v) : next(~v!);
        case ts.SyntaxKind.ExclamationToken:
            return (v) => isBigInt(v) ? next(v.base10Value === '0') : next(!v);
        default:
            return;
    }
}

function isBigInt(v: Primitive): v is ts.PseudoBigInt {
    return typeof v === 'object' && v !== null;
}

function negateBigint(v: ts.PseudoBigInt): ts.PseudoBigInt {
    const digits = v.base10Value.split('');
    if (v.negative) {
        // negative values become positive and get decremented by 1
        for (let i = digits.length - 1; i >= 0; --i) {
            const current = +digits[i] - 1;
            if (current !== -1) {
                if (current === 0 && i === 0 && digits.length !== 1) {
                    // remove leading zero
                    digits.shift();
                } else {
                    digits[i] = `${current}`;
                }
                break;
            }
            digits[i] = '9';
        }
    } else {
        // positive values are incremented by one and become negative
        for (let i = digits.length - 1; i >= 0; --i) {
            const current = +digits[i] + 1;
            if (current !== 10) {
                digits[i] = `${current}`;
                break;
            }
            digits[i] = '0';
            if (i === 0) {
                digits.unshift('1');
                break;
            }
        }
    }
    return {base10Value: digits.join(''), negative: !v.negative};
}

function formatPrimitive(v: Primitive) {
    return isBigInt(v)
        ? formatPseudoBigInt(v)
        : typeof v === 'string'
            ? `"${v}"`
            : String(v);
}
