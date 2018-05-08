import { AbstractRule, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isTextualLiteral, isNumericLiteral, isPrefixUnaryExpression, isIdentifier, isLiteralType, unionTypeParts } from 'tsutils';
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
                    this.addFailureAtNode(clause.expression, `Duplicate 'case ${text}'.`);
                    continue;
                }
                expressionsSeen.add(text);
                const literals = this.getLiteralValue(clause.expression);
                switch (literals.length) {
                    case 0:
                        break;
                    case 1:
                        if (valuesSeen.has(literals[0]))
                            this.addFailureAtNode(clause.expression, `Duplicate 'case ${formatPrimitive(literals[0])}'.`);
                        valuesSeen.add(literals[0]);
                        break;
                    default:
                        // union of literal types, do not add these to `valuesSeen`, but display an error if all literals were already seen
                        if (literals.every((v) => valuesSeen.has(v)))
                            this.addFailureAtNode(clause.expression, `Duplicate 'case ${literals.map(formatPrimitive).join(' | ')}'.`);
                }
            }
        }
    }

    private getLiteralValue(node: ts.Expression): Primitive[] {
        let prefixFn: ApplyPrefixFn = identity;
        while (isPrefixUnaryExpression(node)) {
            const next = makePrefixFn(node, prefixFn);
            if (next === undefined)
                return [];
            prefixFn = next;
            node = node.operand;
        }
        if (isTextualLiteral(node))
            return [prefixFn(node.text)];
        if (isNumericLiteral(node))
            return [prefixFn(+node.text)];
        if (node.kind === ts.SyntaxKind.NullKeyword)
            return [prefixFn(null)]; // tslint:disable-line:no-null-keyword
        if (isIdentifier(node) && node.originalKeywordKind === ts.SyntaxKind.UndefinedKeyword)
            return [prefixFn(undefined)];
        if (node.kind === ts.SyntaxKind.TrueKeyword)
            return [prefixFn(true)];
        if (node.kind === ts.SyntaxKind.FalseKeyword)
            return [prefixFn(false)];

        if (this.program === undefined)
            return [];
        const checker = this.program.getTypeChecker();
        let type = checker.getTypeAtLocation(node);
        type = checker.getBaseConstraintOfType(type) || type;
        const result = new Set<Primitive>();
        for (const t of unionTypeParts(type)) {
            if (isLiteralType(t)) {
                result.add(prefixFn(t.value));
            } else if (t.flags & ts.TypeFlags.BooleanLiteral) {
                result.add(prefixFn((<{intrinsicName: string}><{}>t).intrinsicName === 'true'));
            } else if (t.flags & ts.TypeFlags.Undefined) {
                result.add(prefixFn(undefined));
            } else if (t.flags & ts.TypeFlags.Null) {
                result.add(prefixFn(null)); // tslint:disable-line:no-null-keyword
            } else {
                return [];
            }
        }
        return Array.from(result);
    }
}

type Primitive = string | number | boolean | undefined | null;

type ApplyPrefixFn = (v: Primitive) => Primitive;

function identity<T>(v: T): T {
    return v;
}

function makePrefixFn(node: ts.PrefixUnaryExpression, next: ApplyPrefixFn): ApplyPrefixFn | undefined {
    switch (node.operator) {
        case ts.SyntaxKind.PlusToken:
            return (v) => next(+v!);
        case ts.SyntaxKind.MinusToken:
            return (v) => next(-v!);
        case ts.SyntaxKind.TildeToken:
            return (v) => next(~v!);
        case ts.SyntaxKind.ExclamationToken:
            return (v) => next(!v);
        default:
            return;
    }
}

function formatPrimitive(v: Primitive) {
    return typeof v === 'string' ? `"${v}"` : String(v);
}
