import { TypedRule, excludeDeclarationFiles, typescriptOnly } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isTypeLiteralNode } from 'tsutils';

const typescriptPre290 = /^2\.[78]\./.test(ts.version);

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
            } else if (!typescriptPre290 && // type arguments on JSX elements and tagged templates was introduced in typescript@2.9.0
                       (
                           node.kind === ts.SyntaxKind.JsxOpeningElement ||
                           node.kind === ts.SyntaxKind.JsxSelfClosingElement ||
                           node.kind === ts.SyntaxKind.TaggedTemplateExpression
                        ) &&
                       (<ts.JsxOpeningLikeElement | ts.TaggedTemplateExpression>node).typeArguments === undefined) {
                this.checkCallExpression(<ts.JsxOpeningLikeElement>node);
            }
        }
    }

    private checkCallExpression(node: ts.CallExpression | ts.JsxOpeningLikeElement | ts.TaggedTemplateExpression) {
        const signature = this.checker.getResolvedSignature(node)!;
        // wotan-disable-next-line no-useless-predicate
        if (signature.declaration !== undefined) {
            const typeParameters = ts.getEffectiveTypeParameterDeclarations(signature.declaration);
            if (typeParameters !== undefined && typeParameters.length !== 0) // wotan-disable-line no-useless-predicate
                return this.checkInferredTypeParameters(signature, typeParameters, node);
        }
    }

    private checkNewExpression(node: ts.NewExpression) {
        const signature = this.checker.getResolvedSignature(node)!;
        // wotan-disable-next-line no-useless-predicate
        if (signature.declaration !== undefined) {
            // There is an explicitly declared construct signature
            const typeParameters = ts.getEffectiveTypeParameterDeclarations(signature.declaration);
            // wotan-disable-next-line no-useless-predicate
            if (typeParameters !== undefined && typeParameters.length !== 0) // only check the signature if it declares type parameters
                return this.checkInferredTypeParameters(signature, typeParameters, node);
        }

        // Otherwise look up the TypeParameters of the ClassDeclaration
        const {symbol} = this.checker.getTypeAtLocation(node.expression)!;
        if (symbol === undefined || symbol.declarations === undefined)
            return;
        // collect all TypeParameters and their defaults from all merged declarations
        const typeParameterResult = [];
        for (const declaration of <ts.DeclarationWithTypeParameters[]>symbol.declarations) {
            const typeParameters = ts.getEffectiveTypeParameterDeclarations(declaration);
            if (typeParameters === undefined) // wotan-disable-line no-useless-predicate
                continue; // compatibility with typescript@<2.9.0
            for (let i = 0; i < typeParameters.length; ++i)
                // wotan-disable-next-line no-useless-predicate
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
        const {typeArguments} = <ts.ExpressionWithTypeArguments><any>this.checker.signatureToSignatureDeclaration(
            signature,
            ts.SyntaxKind.CallExpression,
            undefined,
            ts.NodeBuilderFlags.WriteTypeArgumentsOfSignature | ts.NodeBuilderFlags.IgnoreErrors,
        );

        if (typeArguments === undefined)
            return;

        for (let i = 0; i < typeParameters.length; ++i) {
            const typeArgument = typeArguments[i];
            if (isTypeLiteralNode(typeArgument) && typeArgument.members.length === 0)
                this.handleEmptyTypeParameter(typeParameters[i], node);
        }
    }

    private handleEmptyTypeParameter(typeParameter: ts.TypeParameterDeclaration, node: ts.Node) {
        if (typeParameter.default === undefined)
            this.addFailureAtNode(
                node,
                `TypeParameter '${typeParameter.name.text}' is inferred as '{}'. Consider adding type arguments to the call.`,
            );
    }
}
