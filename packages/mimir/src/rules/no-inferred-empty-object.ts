import { TypedRule, excludeDeclarationFiles, typescriptOnly } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isTypeLiteralNode, getJsDoc } from 'tsutils';

const typescriptPre270 = /^2\.[456]\./.test(ts.version);

@excludeDeclarationFiles
@typescriptOnly // in .js files TypeParameters default to `any`
export class Rule extends TypedRule {
    private scanner: ts.Scanner | undefined = undefined;

    public apply() {
        for (const node of this.context.getFlatAst()) {
            if (node.kind === ts.SyntaxKind.CallExpression && (<ts.CallExpression>node).typeArguments === undefined) {
                this.checkCallExpression(<ts.CallExpression>node);
            } else if (node.kind === ts.SyntaxKind.NewExpression && (<ts.NewExpression>node).typeArguments === undefined) {
                this.checkNewExpression(<ts.NewExpression>node);
            }
        }
    }

    private checkCallExpression(node: ts.CallExpression) {
        const signature = this.checker.getResolvedSignature(node);
        // wotan-disable-next-line no-useless-predicate
        if (signature.declaration !== undefined)
            return this.checkSignature(signature, signature.declaration, node);
    }

    private checkNewExpression(node: ts.NewExpression) {
        const signature = this.checker.getResolvedSignature(node);
        // wotan-disable-next-line no-useless-predicate
        if (signature.declaration !== undefined)
            // There is an explicitly declared construct signature
            return this.checkSignature(signature, signature.declaration, node);

        // Otherwise look up the TypeParameters of the ClassDeclaration
        const {symbol} = this.checker.getTypeAtLocation(node.expression);
        if (symbol === undefined || symbol.declarations === undefined)
            return;
        // collect all TypeParameters and their defaults from all merged declarations
        const typeParameterResult = [];
        for (const {typeParameters} of <ts.DeclarationWithTypeParameters[]>symbol.declarations) {
            if (typeParameters === undefined)
                continue;
            for (let i = 0; i < typeParameters.length; ++i)
                // wotan-disable-next-line no-useless-predicate
                if (typeParameterResult[i] === undefined || typeParameters[i].default !== undefined)
                    typeParameterResult[i] = typeParameters[i];
        }
        if (typeParameterResult.length !== 0)
            return this.checkInferredTypeParameters(signature, typeParameterResult, node);
    }

    private checkSignature(signature: ts.Signature, declaration: ts.SignatureDeclaration | ts.ClassLikeDeclaration, node: ts.Expression) {
        const typeParameters = declaration.typeParameters !== undefined
            ? declaration.typeParameters
            : declaration.flags & ts.NodeFlags.JavaScriptFile
                ? getTemplateTags(declaration)
                : undefined;
        if (typeParameters !== undefined)
            return this.checkInferredTypeParameters(signature, typeParameters, node);
    }

    private checkInferredTypeParameters(
        signature: ts.Signature,
        typeParameters: ReadonlyArray<ts.TypeParameterDeclaration>,
        node: ts.Expression,
    ) {
        // for compatibility with typescript@<2.7.0
        if (typescriptPre270)
            return this.scannerFallback(signature, typeParameters, node);

        const {typeArguments} = <ts.ExpressionWithTypeArguments><any>this.checker.signatureToSignatureDeclaration(
            signature,
            ts.SyntaxKind.CallExpression,
            undefined,
            ts.NodeBuilderFlags.WriteTypeArgumentsOfSignature | ts.NodeBuilderFlags.IgnoreErrors,
        );

        if (typeArguments === undefined)
            return;

        for (let i = 0; i < typeArguments.length; ++i) {
            const typeArgument = typeArguments[i];
            if (isTypeLiteralNode(typeArgument) && typeArgument.members.length === 0)
                this.handleEmptyTypeParameter(typeParameters[i], node);
        }
    }

    private scannerFallback(signature: ts.Signature, typeParameters: ReadonlyArray<ts.TypeParameterDeclaration>, node: ts.Expression) {
        const scanner = this.scanner || (this.scanner = ts.createScanner(ts.ScriptTarget.ESNext, true));
        scanner.setText(
            this.checker.signatureToString(
                signature,
                undefined,
                ts.TypeFormatFlags.WriteTypeArgumentsOfSignature | ts.TypeFormatFlags.NoTruncation,
            ),
            1, // start at 1 because we know 0 is '<'
        );
        let param = 0;
        let token = scanner.scan();
        if (token === ts.SyntaxKind.OpenBraceToken && scanner.scan() === ts.SyntaxKind.CloseBraceToken) {
            token = scanner.scan();
            if (token === ts.SyntaxKind.CommaToken || token === ts.SyntaxKind.GreaterThanToken)
                this.handleEmptyTypeParameter(typeParameters[0], node);
        }
        let level = 0;
        /* Scan every token until we get to the closing '>'.
           We need to keep track of nested type arguments, because we are only interested in the top level. */
        while (true) {
            switch (token) {
                case ts.SyntaxKind.CommaToken:
                    if (level === 0) {
                        ++param;
                        token = scanner.scan();
                        if (token === ts.SyntaxKind.OpenBraceToken && scanner.scan() === ts.SyntaxKind.CloseBraceToken) {
                            token = scanner.scan();
                            if (token === ts.SyntaxKind.CommaToken || token === ts.SyntaxKind.GreaterThanToken)
                                this.handleEmptyTypeParameter(typeParameters[param], node);
                        }
                        continue;
                    }
                    break;
                case ts.SyntaxKind.GreaterThanToken:
                    if (level === 0)
                        return;
                    --level;
                    break;
                case ts.SyntaxKind.LessThanToken:
                    ++level;
            }
            token = scanner.scan();
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

function getTemplateTags(node: ts.HasJSDoc): ReadonlyArray<ts.TypeParameterDeclaration> | undefined {
    // only the first @template tag is used
    for (const jsDoc of getJsDoc(node))
        if (jsDoc.tags !== undefined)
            for (const tag of jsDoc.tags)
                if (tag.kind === ts.SyntaxKind.JSDocTemplateTag)
                    return (<ts.JSDocTemplateTag>tag).typeParameters;
    return;
}
