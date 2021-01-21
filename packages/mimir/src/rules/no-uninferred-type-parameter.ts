import { TypedRule, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';

const unknownType: CheckType = {
    display: 'unknown',
    predicate(type) {
        return type.kind === ts.SyntaxKind.UnknownKeyword;
    },
};
const anyType: CheckType = {
    display: 'any',
    predicate(type) {
        return type.kind === ts.SyntaxKind.AnyKeyword;
    },
};

@excludeDeclarationFiles
export class Rule extends TypedRule {
    private checkType = !/\.tsx?$/.test(this.sourceFile.fileName) ? anyType : unknownType;

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
                this.checkCallExpression(<ts.JsxOpeningLikeElement | ts.TaggedTemplateExpression>node);
            }
        }
    }

    /**
     * This function is necessary because higher order function type inference creates Signatures whose declaration has no type parameters.
     * @see https://github.com/Microsoft/TypeScript/issues/30296
     *
     * To work around this, we look for a single call signature on the called expression and use its type parameters instead.
     * As a bonus this also works for unified signatures from union types.
     */
    private getTypeParametersOfCallSignature(node: Exclude<ts.CallLikeExpression, ts.Decorator>) {
        let expr: ts.Expression;
        switch (node.kind) {
            case ts.SyntaxKind.CallExpression:
            case ts.SyntaxKind.NewExpression:
                expr = node.expression;
                break;
            case ts.SyntaxKind.TaggedTemplateExpression:
                expr = node.tag;
                break;
            default:
                expr = node.tagName;
        }
        const signatures = this.checker.getSignaturesOfType(
            this.checker.getTypeAtLocation(expr),
            node.kind === ts.SyntaxKind.NewExpression ? ts.SignatureKind.Construct : ts.SignatureKind.Call,
        );
        // abort if not all signatures have type parameters:
        //   higher order function type inference only works for a single call signature
        //   call signature unification puts type parameters on every resulting signature
        if (signatures.length === 0 || signatures.some((s) => s.typeParameters === undefined))
            return [];
        return signatures[0].typeParameters!.map(this.mapTypeParameter, this);
    }

    private mapTypeParameter(type: ts.TypeParameter): TypeParameter {
        // fall back to NodeBuilder for renamed TypeParameters, they have no declaration and therefore we cannot directly access the default
        return type.symbol.declarations === undefined
            ? mapTypeParameterDeclaration(this.checker.typeParameterToDeclaration(type, undefined, ts.NodeBuilderFlags.IgnoreErrors)!)
            : {
                name: type.symbol.name,
                hasDefault: (<ts.TypeParameterDeclaration>type.symbol.declarations[0]).default !== undefined,
            };
    }

    private checkCallExpression(node: ts.CallExpression | ts.JsxOpeningLikeElement | ts.TaggedTemplateExpression) {
        const signature = this.checker.getResolvedSignature(node)!;
        if (signature.declaration !== undefined) {
            let typeParameters = ts.getEffectiveTypeParameterDeclarations(signature.declaration).map(mapTypeParameterDeclaration);
            if (typeParameters.length === 0)
                typeParameters = this.getTypeParametersOfCallSignature(node);
            if (typeParameters.length !== 0)
                return this.checkInferredTypeParameters(signature, typeParameters, node);
        }
    }

    private checkNewExpression(node: ts.NewExpression) {
        const signature = this.checker.getResolvedSignature(node)!;
        if (signature.declaration !== undefined) {
            // There is an explicitly declared construct signature
            let typeParameters = ts.getEffectiveTypeParameterDeclarations(signature.declaration).map(mapTypeParameterDeclaration);
            if (typeParameters.length === 0)
                typeParameters = this.getTypeParametersOfCallSignature(node);
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
        const mergedTypeParameters: TypeParameter[] = [];
        for (const declaration of <ts.DeclarationWithTypeParameters[]>symbol.declarations) {
            const typeParameters = ts.getEffectiveTypeParameterDeclarations(declaration);
            for (let i = 0; i < typeParameters.length; ++i) {
                if (mergedTypeParameters.length === i)
                    mergedTypeParameters.push({name: typeParameters[i].name.text, hasDefault: false});
                if (typeParameters[i].default !== undefined)
                    mergedTypeParameters[i].hasDefault = true;
            }
        }
        if (mergedTypeParameters.length !== 0)
            return this.checkInferredTypeParameters(signature, mergedTypeParameters, node);
    }

    private checkInferredTypeParameters(
        signature: ts.Signature,
        typeParameters: readonly TypeParameter[],
        node: ts.Expression,
    ) {
        if (typeParameters.every((t) => t.hasDefault))
            return; // nothing to do here if every type parameter as a default

        const typeArguments = (<ts.ExpressionWithTypeArguments><any>this.checker.signatureToSignatureDeclaration(
            signature,
            ts.SyntaxKind.CallSignature,
            undefined,
            ts.NodeBuilderFlags.WriteTypeArgumentsOfSignature | ts.NodeBuilderFlags.IgnoreErrors,
        )).typeArguments!;

        for (let i = 0; i < typeParameters.length; ++i)
            if (!typeParameters[i].hasDefault)
                this.checkTypeArgument(typeArguments[i], typeParameters[i].name, node);
    }

    private checkTypeArgument(typeArgument: ts.TypeNode, name: string, errorNode: ts.Expression) {
        if (this.checkType.predicate(typeArgument))
            this.addFindingAtNode(
                errorNode,
                `TypeParameter '${name}' is inferred as '${this.checkType.display}'. Consider adding type arguments to the call.`,
            );
    }

}

interface CheckType {
    display: string;
    predicate: (type: ts.TypeNode) => boolean;
}

interface TypeParameter {
    name: string;
    hasDefault: boolean;
}

function mapTypeParameterDeclaration(node: ts.TypeParameterDeclaration): TypeParameter {
    return {name: node.name.text, hasDefault: node.default !== undefined};
}
