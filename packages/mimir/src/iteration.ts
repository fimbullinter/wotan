import {
    getIteratorYieldResultFromIteratorResult,
    getPropertyOfType,
    isCompilerOptionEnabled,
    isIntersectionType,
    isModifierFlagSet,
    isSymbolFlagSet,
    isTypeFlagSet,
    isTypeReference,
    isUnionType,
    removeOptionalityFromType,
    someTypePart,
    unionTypeParts,
} from 'tsutils';
import * as ts from 'typescript';
import { tryGetBaseConstraintType, typesAreEqual } from './utils';

function isIterationProtocolAvailable(compilerOptions: ts.CompilerOptions) {
    return compilerOptions.target! >= ts.ScriptTarget.ES2015 || isCompilerOptionEnabled(compilerOptions, 'downlevelIteration');
}

export function isExpressionIterable(
    node: ts.Expression,
    checker: ts.TypeChecker,
    compilerOptions: ts.CompilerOptions,
    matchIndexSignature: boolean,
): boolean {
    const type = checker.getTypeAtLocation(node);
    return isIterationProtocolAvailable(compilerOptions)
        ? isIterable(checker.getApparentType(type), checker, node, matchIndexSignature)
        : unionTypeParts(tryGetBaseConstraintType(type, checker)).every((t) => isArrayLike(t, compilerOptions));
}

function isArrayLike(type: ts.Type, compilerOptions: ts.CompilerOptions): boolean {
    if (isTypeReference(type))
        type = type.target;
    if (type.getNumberIndexType() === undefined)
        return false;
    if (type.flags & ts.TypeFlags.StringLike)
        return compilerOptions.target! >= ts.ScriptTarget.ES5; // iterating string is only possible starting from ES5
    if (type.symbol !== undefined && /^(?:Readonly)?Array$/.test(<string>type.symbol.escapedName) &&
        type.symbol.declarations?.some((node) => node.getSourceFile().hasNoDefaultLib))
        return true;
    if (isIntersectionType(type))
        return type.types.some((t) => isArrayLike(t, compilerOptions));
    return !!type.getBaseTypes()?.some((t) => isArrayLike(t, compilerOptions));
}

function isIterable(type: ts.Type, checker: ts.TypeChecker, node: ts.Node, matchIndexSignature: boolean): boolean {
    const indexType = type.getNumberIndexType() || type.getStringIndexType();
    if (indexType === undefined && matchIndexSignature)
        return false;
    const iteratorFn = getPropertyOfType(type, <ts.__String>'__@iterator');
    if (!isPresentPublicAndRequired(iteratorFn))
        return false;
    return checkReturnTypeAndRequireZeroArity(checker.getTypeOfSymbolAtLocation(iteratorFn, node), (iterator) => {
        const next = iterator.getProperty('next');
        return isPresentPublicAndRequired(next) &&
            checkReturnTypeAndRequireZeroArity(checker.getTypeOfSymbolAtLocation(next, node), (iteratorResult) => {
                const done = iteratorResult.getProperty('done');
                if (
                    !isPresentAndPublic(done) ||
                    someTypePart(
                        removeOptionalityFromType(checker, checker.getTypeOfSymbolAtLocation(done, node)),
                        isUnionType,
                        (t) => !isTypeFlagSet(t, ts.TypeFlags.BooleanLike),
                    )
                )
                    return false;
                const value = getIteratorYieldResultFromIteratorResult(iteratorResult, node, checker).getProperty('value');
                return isPresentAndPublic(value) &&
                    (
                        !matchIndexSignature ||
                        typesAreEqual(checker.getTypeOfSymbolAtLocation(value, node), indexType!, checker)
                    );
            });

    });
}

function checkReturnTypeAndRequireZeroArity(type: ts.Type, cb: (type: ts.Type) => boolean): boolean {
    let zeroArity = false;
    for (const signature of type.getCallSignatures()) {
        if (!cb(signature.getReturnType()))
            return false;
        if (signatureHasArityZero(signature))
            zeroArity = true;
    }
    return zeroArity;
}

function signatureHasArityZero(signature: ts.Signature): boolean {
    if (signature.parameters.length === 0)
        return true;
    const decl = <ts.ParameterDeclaration | undefined>signature.parameters[0].declarations![0];
    return decl !== undefined && isOptionalParameter(decl);
}

function isOptionalParameter(node: ts.ParameterDeclaration): boolean {
    if (node.questionToken !== undefined || node.dotDotDotToken !== undefined)
        return true;
    if (node.flags & ts.NodeFlags.JavaScriptFile && ts.getJSDocParameterTags(node).some((tag) => tag.isBracketed))
        return true;
    if (node.initializer === undefined)
        return false;
    const parameters = node.parent!.parameters;
    const nextIndex = parameters.indexOf(node) + 1;
    if (nextIndex === parameters.length)
        return true;
    return isOptionalParameter(parameters[nextIndex]);
}

function isPresentPublicAndRequired(symbol: ts.Symbol | undefined): symbol is ts.Symbol {
    return isPresentAndPublic(symbol) && !isSymbolFlagSet(symbol, ts.SymbolFlags.Optional);
}

function isPresentAndPublic(symbol: ts.Symbol | undefined): symbol is ts.Symbol {
    return symbol !== undefined &&
        (
            symbol.declarations === undefined ||
            symbol.declarations.every((d) => !isModifierFlagSet(d, ts.ModifierFlags.NonPublicAccessibilityModifier))
        );
}
