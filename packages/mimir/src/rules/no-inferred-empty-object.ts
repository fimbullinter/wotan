import { TypedRule, excludeDeclarationFiles, typescriptOnly } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isTypeLiteralNode } from 'tsutils';

@excludeDeclarationFiles
@typescriptOnly // in .js files TypeParameters default to `any`
export class Rule extends TypedRule {
    public apply() {
        for (const node of this.context.getFlatAst()) {
            if (node.kind === ts.SyntaxKind.CallExpression) {
                if ((<ts.CallExpression>node).typeArguments === undefined)
                    this.checkCallExpression(<ts.CallExpression>node);
            } else if (node.kind === ts.SyntaxKind.NewExpression) {
                if ((<ts.NewExpression>node).typeArguments === undefined)
                    this.checkNewExpression(<ts.NewExpression>node);
            } else if (
                (
                    node.kind === ts.SyntaxKind.JsxOpeningElement ||
                    node.kind === ts.SyntaxKind.JsxSelfClosingElement ||
                    node.kind === ts.SyntaxKind.TaggedTemplateExpression
                ) &&
                (<ts.JsxOpeningLikeElement | ts.TaggedTemplateExpression>node).typeArguments === undefined
            ) {
                this.checkCallExpression(<ts.JsxOpeningLikeElement>node);
            }
        }
    }

    private checkCallExpression(node: ts.CallExpression | ts.JsxOpeningLikeElement | ts.TaggedTemplateExpression) {
        const signature = this.checker.getResolvedSignature(node)!;
        if (signature.declaration !== undefined) {
            const typeParameters = ts.getEffectiveTypeParameterDeclarations(signature.declaration);
            if (typeParameters.length !== 0)
                return this.checkInferredTypeParameters(signature, typeParameters, node);
        }
    }

    private checkNewExpression(node: ts.NewExpression) {
        const signature = this.checker.getResolvedSignature(node)!;
        if (signature.declaration !== undefined) {
            // There is an explicitly declared construct signature
            const typeParameters = ts.getEffectiveTypeParameterDeclarations(signature.declaration);
            if (typeParameters.length !== 0) // only check the signature if it declares type parameters
                return this.checkInferredTypeParameters(signature, typeParameters, node);
            if (signature.declaration.kind !== ts.SyntaxKind.Constructor)
                return; // don't look for type parameters on non-class parents
        }

        // Otherwise look up the TypeParameters of the ClassDeclaration
        const {symbol} = this.checker.getTypeAtLocation(node.expression)!;
        if (symbol === undefined || symbol.declarations === undefined)
            return;
        // collect all TypeParameters and their defaults from all merged declarations
        const typeParameterResult = [];
        for (const declaration of <ts.DeclarationWithTypeParameters[]>symbol.declarations) {
            const typeParameters = ts.getEffectiveTypeParameterDeclarations(declaration);
            for (let i = 0; i < typeParameters.length; ++i)
                if (typeParameterResult[i] === undefined || typeParameters[i].default !== undefined)
                    typeParameterResult[i] = typeParameters[i];
        }
        if (typeParameterResult.length !== 0)
            return this.checkInferredTypeParameters(signature, typeParameterResult, node);
    }

    private checkInferredTypeParameters(
        signature: ts.Signature,
        typeParameters: ReadonlyArray<ts.TypeParameterDeclaration>,
        node: ts.Expression,
    ) {
        const typeArguments = (<ts.ExpressionWithTypeArguments><any>this.checker.signatureToSignatureDeclaration(
            signature,
            ts.SyntaxKind.CallExpression,
            undefined,
            ts.NodeBuilderFlags.WriteTypeArgumentsOfSignature | ts.NodeBuilderFlags.IgnoreErrors,
        )).typeArguments!;

        for (let i = 0; i < typeParameters.length; ++i) {
            const typeArgument = typeArguments[i];
            if (isTypeLiteralNode(typeArgument) && typeArgument.members.length === 0)
                this.handleEmptyTypeParameter(typeParameters[i], node);
        }
    }

    private handleEmptyTypeParameter(typeParameter: ts.TypeParameterDeclaration, node: ts.Node) {
        if (typeParameter.default === undefined)
            this.addFindingAtNode(
                node,
                `TypeParameter '${typeParameter.name.text}' is inferred as '{}'. Consider adding type arguments to the call.`,
            );
    }
}
