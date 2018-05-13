import { ConfigurableRule, typescriptOnly, excludeDeclarationFiles, RuleContext, Replacement } from '@fimbul/ymir';
import * as ts from 'typescript';
import { WrappedAst, getWrappedNodeAtPosition, isAsExpression, isTypeAssertion } from 'tsutils';

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
            style: ((options && options.style) === 'classic') ? 'classic' : 'as',
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
            Replacement.append(node.getStart(context.sourceFile), node.expression.getText(context.sourceFile)),
            Replacement.delete(node.expression.end, node.end),
        ]);
    }
}

function enforceAsTypeAssertion(context: RuleContext) {
    for (const node of context.getFlatAst()) {
        if (isTypeAssertion(node)) {
            const needsParens = node.expression.kind === ts.SyntaxKind.YieldExpression || false /* TODO use parens detection logic*/;
            const start = node.getStart(context.sourceFile);
            context.addFailure(start, node.expression.pos, "Use 'obj as T' instead.", [
                Replacement.replace(start, node.expression.getStart(context.sourceFile), needsParens ? '(' : ''),
                Replacement.append(node.end, `${needsParens ? ')' : ''} as ${node.type.getText(context.sourceFile)}`)
            ]);
        }
    }
}
