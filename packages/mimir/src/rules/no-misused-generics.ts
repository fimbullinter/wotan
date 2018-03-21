import { AbstractRule } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isSignatureDeclaration, collectVariableUsage, VariableInfo } from 'tsutils';

export class Rule extends AbstractRule {
    public static supports(sourceFile: ts.SourceFile) {
        return /\.tsx?$/.test(sourceFile.fileName);
    }

    private usage: Map<ts.Identifier, VariableInfo> | undefined;

    public apply() {
        for (const node of this.context.getFlatAst())
            if (isSignatureDeclaration(node) && node.typeParameters !== undefined)
                for (const typeParameter of node.typeParameters)
                    if (!this.isUsedInSignatureExceptReturnType(typeParameter, node))
                        this.addFailureAtNode(
                            typeParameter,
                            `TypeParameter '${typeParameter.name.text}' cannot be inferred from any parameter.`,
                        );
    }

    private isUsedInSignatureExceptReturnType(typeParameter: ts.TypeParameterDeclaration, signature: ts.SignatureDeclaration): boolean {
        if (this.usage === undefined)
            this.usage = collectVariableUsage(this.sourceFile);
        for (const use of this.usage.get(typeParameter.name)!.uses)
            if (use.location.pos < signature.parameters.end)
                return true;
        return false;
    }
}
