import { AbstractRule } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isTextualLiteral, isNumericLiteral, isPrefixUnaryExpression, isIdentifier } from 'tsutils';

export class Rule extends AbstractRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    public apply() {
        for (const node of this.context.getFlatAst())
            if (node.kind === ts.SyntaxKind.CaseBlock)
                this.checkCases(<ts.CaseBlock>node);
    }

    private checkCases({clauses}: ts.CaseBlock) {
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
            this.getLiteralValue(clause.expression, (v) => {
                if (valuesSeen.has(v))
                    return this.addFailureAtNode(clause.expression, `Duplicate 'case ${format(v)}'.`);
                valuesSeen.add(v);
            });
        }
    }

    private getLiteralValue(node: ts.Expression, cb: (v: Primitive) => void) {
        let prefixFn: ApplyPrefixFn = identity;
        while (isPrefixUnaryExpression(node)) {
            const next = makePrefixFn(node, prefixFn);
            if (next === undefined)
                return;
            prefixFn = next;
            node = node.operand;
        }
        if (isTextualLiteral(node))
            return cb(prefixFn(node.text));
        if (isNumericLiteral(node))
            return cb(prefixFn(+node.text));
        if (node.kind === ts.SyntaxKind.NullKeyword)
            return cb(prefixFn(null)); // tslint:disable-line:no-null-keyword
        if (isIdentifier(node) && node.originalKeywordKind === ts.SyntaxKind.UndefinedKeyword)
            return cb(prefixFn(undefined));
        if (node.kind === ts.SyntaxKind.TrueKeyword)
            return cb(prefixFn(true));
        if (node.kind === ts.SyntaxKind.FalseKeyword)
            return cb(prefixFn(false));
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

function format(v: Primitive): string {
    if (typeof v === 'string')
        return '"' + v + '"';
    if (Object.is(v, -0))
        return '-0';
    return String(v);
}
