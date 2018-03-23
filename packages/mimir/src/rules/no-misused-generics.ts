import { AbstractRule, typescriptOnly } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isSignatureDeclaration, collectVariableUsage, VariableInfo, isFunctionWithBody } from 'tsutils';

@typescriptOnly
export class Rule extends AbstractRule {
    private usage: Map<ts.Identifier, VariableInfo> | undefined;

    public apply() {
        for (const node of this.context.getFlatAst())
            if (isSignatureDeclaration(node) && node.typeParameters !== undefined)
                this.checkTypeParameters(node.typeParameters, node);
    }

    private checkTypeParameters(typeParameters: ReadonlyArray<ts.TypeParameterDeclaration>, signature: ts.SignatureDeclaration) {
        if (this.usage === undefined)
            this.usage = collectVariableUsage(this.sourceFile);
        outer: for (const typeParameter of typeParameters) {
            let usedInParameters = false;
            let usedInReturnOrExtends = isFunctionWithBody(signature);
            for (const use of this.usage.get(typeParameter.name)!.uses) {
                if (use.location.pos > signature.parameters.pos && use.location.pos < signature.parameters.end) {
                    if (usedInParameters)
                        continue outer;
                    usedInParameters = true;
                } else if (!usedInReturnOrExtends) {
                    usedInReturnOrExtends = use.location.pos > signature.parameters.end || isUsedInConstraint(use.location, typeParameters);
                }
            }
            if (!usedInParameters) {
                this.addFailureAtNode(
                    typeParameter,
                    `TypeParameter '${typeParameter.name.text}' cannot be inferred from any parameter.`,
                );
            } else if (!usedInReturnOrExtends && !this.isConstrainedByOtherTypeParameter(typeParameter, typeParameters)) {
                this.addFailureAtNode(
                    typeParameter,
                    `TypeParameter '${typeParameter.name.text}' is not used to enforce a constraint between types and can be replaced with \
'${typeParameter.constraint ? typeParameter.constraint.getText(this.sourceFile) : 'any'}'.`,
                );
            }
        }
    }

    private isConstrainedByOtherTypeParameter(current: ts.TypeParameterDeclaration, all: ReadonlyArray<ts.TypeParameterDeclaration>) {
        if (current.constraint === undefined)
            return false;
        for (const typeParameter of all) {
            if (typeParameter === current)
                continue;
            for (const use of this.usage!.get(typeParameter.name)!.uses)
                if (use.location.pos >= current.constraint.pos && use.location.pos < current.constraint.end)
                    return true;
        }
        return false;
    }
}

function isUsedInConstraint(use: ts.Identifier, typeParameters: ReadonlyArray<ts.TypeParameterDeclaration>) {
    for (const typeParameter of typeParameters)
        if (typeParameter.constraint !== undefined && use.pos >= typeParameter.constraint.pos && use.pos < typeParameter.constraint.end)
            return true;
    return false;
}
