import { AbstractRule, typescriptOnly } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isSignatureDeclaration, collectVariableUsage, VariableInfo } from 'tsutils';

@typescriptOnly
export class Rule extends AbstractRule {
    private usage: Map<ts.Identifier, VariableInfo> | undefined;

    public apply() {
        for (const node of this.context.getFlatAst())
            if (isSignatureDeclaration(node) && node.typeParameters !== undefined)
                for (const typeParameter of node.typeParameters)
                    if (!this.isUsedInParameterTypes(typeParameter, node.parameters))
                        this.addFailureAtNode(
                            typeParameter,
                            `TypeParameter '${typeParameter.name.text}' cannot be inferred from any parameter.`,
                        );
    }

    private isUsedInParameterTypes(typeParameter: ts.TypeParameterDeclaration, range: ts.TextRange): boolean {
        if (this.usage === undefined)
            this.usage = collectVariableUsage(this.sourceFile);
        for (const use of this.usage.get(typeParameter.name)!.uses)
            if (use.location.pos > range.pos && use.location.pos < range.end)
                return true;
        return false;
    }
}
