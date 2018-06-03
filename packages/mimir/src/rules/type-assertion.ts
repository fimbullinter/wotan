import { ConfigurableRule, typescriptOnly, excludeDeclarationFiles, RuleContext, Replacement } from '@fimbul/ymir';
import * as ts from 'typescript';
import { WrappedAst, getWrappedNodeAtPosition, isAsExpression, isTypeAssertion, isBinaryExpression } from 'tsutils';
import { expressionNeedsParensWhenReplacingNode } from '../utils';

export interface Options {
    style: 'classic' | 'as';
}

@typescriptOnly
@excludeDeclarationFiles
export class Rule extends ConfigurableRule<Options> {
    public static supports(sourceFile: ts.SourceFile) {
        return sourceFile.languageVariant === ts.LanguageVariant.Standard;
    }

    public parseOptions(options: Partial<Options> | null | undefined): Options {
        return {
            style: options && options.style === 'classic' ? 'classic' : 'as',
        };
    }

    public apply() {
        return this.options.style === 'classic' ? enforceClassicTypeAssertion(this.context) : enforceAsTypeAssertion(this.context);
    }
}

function enforceClassicTypeAssertion(context: RuleContext) {
    const re = /\bas\b/g;
    let wrappedAst: WrappedAst | undefined;
    for (let match = re.exec(context.sourceFile.text); match !== null; match = re.exec(context.sourceFile.text)) {
        const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = context.getWrappedAst()), match.index)!;
        if (!isAsExpression(node) || node.type.pos !== re.lastIndex)
            continue;
        context.addFailure(match.index, node.end, "Use the classic type assertion style '<T>obj' instead.", [
            Replacement.append(node.getStart(context.sourceFile), `<${node.type.getText(context.sourceFile)}>`),
            Replacement.delete(node.expression.end, node.end),
        ]);
    }
}

function enforceAsTypeAssertion(context: RuleContext) {
    for (const node of context.getFlatAst()) {
        if (isTypeAssertion(node)) {
            const assertionParens = assertionNeedsParens(node);
            const expressionParens = node.expression.kind === ts.SyntaxKind.YieldExpression ||
                !assertionParens && expressionNeedsParensWhenReplacingNode(node.expression, node);
            const start = node.getStart(context.sourceFile);
            context.addFailure(start, node.expression.pos, "Use 'obj as T' instead.", [
                Replacement.replace(
                    start,
                    node.expression.getStart(context.sourceFile),
                    charIf(expressionParens, '(') + charIf(assertionParens, '('),
                ),
                Replacement.append(
                    node.end,
                    `${charIf(expressionParens, ')')} as ${node.type.getText(context.sourceFile)}${charIf(assertionParens, ')')}`,
                ),
            ]);
        }
    }
}

function charIf(condition: boolean, char: string) {
    return condition ? char : '';
}

function assertionNeedsParens(node: ts.Expression) {
    let parent = node.parent!;
    // fixing unary expression like 'await <T>foo' to 'await foo as T' asserts the result of the entire expression, not just the operand
    switch (parent.kind) {
        case ts.SyntaxKind.PrefixUnaryExpression:
        case ts.SyntaxKind.TypeOfExpression:
        case ts.SyntaxKind.AwaitExpression:
        case ts.SyntaxKind.VoidExpression:
            return true;
    }
    // fixing '<T>foo & bar' to 'foo as T & bar' would parse 'T & bar' as intersection type, therefore we need to add parens
    while (isBinaryExpression(parent)) {
        if (node === parent.left) {
            switch (parent.operatorToken.kind) {
                case ts.SyntaxKind.AmpersandToken:
                case ts.SyntaxKind.BarToken:
                    return true;
                default:
                    return false;
            }
        }
        node = parent;
        parent = node.parent!;
    }
    return false;
}
