import { TypedRule } from '../types';
import * as ts from 'typescript';
import { isTypeLiteralNode } from 'tsutils';

export class Rule extends TypedRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile; // TODO exclude JS files as well?
    }

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
        if (signature.declaration !== undefined && signature.declaration.typeParameters !== undefined)
            return this.checkInferredTypeParameters(signature, signature.declaration.typeParameters, node);
    }

    private checkNewExpression(node: ts.NewExpression) {
        const signature = this.checker.getResolvedSignature(node);
        if (signature.declaration !== undefined) {
            // There is an explicitly declared construct signature
            if (signature.declaration.typeParameters !== undefined)
                return this.checkInferredTypeParameters(signature, signature.declaration.typeParameters, node);
        } else {
            const {symbol} = this.checker.getTypeAtLocation(node.expression);
            if (symbol !== undefined && symbol.declarations !== undefined &&
                (<ts.DeclarationWithTypeParameters>symbol.declarations[0]).typeParameters !== undefined)
                return this.checkInferredTypeParameters(
                    signature,
                    (<ts.DeclarationWithTypeParameters>symbol.declarations[0]).typeParameters!,
                    node,
                );
        }

    }

    private checkInferredTypeParameters(
        signature: ts.Signature,
        typeParameters: ts.NodeArray<ts.TypeParameterDeclaration>,
        node: ts.Expression,
    ) {
        const {typeArguments} = <ts.ExpressionWithTypeArguments><any>this.checker.signatureToSignatureDeclaration(
            signature,
            ts.SyntaxKind.CallExpression,
            undefined,
            ts.NodeBuilderFlags.WriteTypeArgumentsOfSignature,
        );

        // for compatibility with typescript@<2.7.0
        if (typeArguments === undefined)
            return this.scannerFallback(signature, typeParameters, node);

        for (let i = 0; i < typeArguments.length; ++i) {
            const typeArgument = typeArguments[i];
            if (isTypeLiteralNode(typeArgument) && typeArgument.members.length === 0)
                this.handleEmptyTypeParameter(typeParameters[i], node);
        }
    }

    private scannerFallback(
        signature: ts.Signature,
        typeParameters: ts.NodeArray<ts.TypeParameterDeclaration>,
        node: ts.Expression,
    ) {
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
