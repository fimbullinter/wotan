import { TypedRule, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import {
    isVariableDeclarationList,
    isNumericLiteral,
    isPrefixUnaryExpression,
    isPostfixUnaryExpression,
    isBinaryExpression,
    isIdentifier,
    isPropertyAccessExpression,
    collectVariableUsage,
    VariableUse,
    isElementAccessExpression,
    isReassignmentTarget,
    unionTypeParts,
    isIntersectionType,
    isTypeReference,
    isTypeFlagSet,
    isSymbolFlagSet,
} from 'tsutils';
import * as path from 'path';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    private get usage() {
        const usage = collectVariableUsage(this.sourceFile);
        Object.defineProperty(this, 'usage', {
            value: usage,
            writable: false,
        });
        return usage;
    }

    public apply() {
        for (const node of this.context.getFlatAst())
            if (node.kind === ts.SyntaxKind.ForStatement)
                this.checkForStatement(<ts.ForStatement>node);
    }

    private checkForStatement(node: ts.ForStatement) {
        if (node.initializer === undefined || node.condition === undefined || node.incrementor === undefined)
            return;
        const indexVariable = extractIndexVariable(node.initializer, node.incrementor);
        if (indexVariable === undefined)
            return;
        const arrayVariable = extractArrayVariable(node.condition, indexVariable.text);
        if (arrayVariable === undefined)
            return;
        if (!isReadonlyArrayAccess(this.usage.get(indexVariable)!.uses, arrayVariable.getText(this.sourceFile), node, this.sourceFile))
            return;
        if (this.isIterationPossible(arrayVariable))
            this.addFailure(
                node.getStart(this.sourceFile),
                node.statement.pos,
                `Prefer a 'for-of' loop over a 'for' loop for this simple iteration.`,
            );
    }

    private isIterationPossible(node: ts.Expression): boolean {
        const type = this.checker.getTypeAtLocation(node)!;
        return this.isIterationProtocolAvailable()
            ? this.isIterable(this.checker.getApparentType(type), node)
            : unionTypeParts(this.checker.getBaseConstraintOfType(type) || type).every(this.isArrayLike, this);
    }

    private isIterationProtocolAvailable(): boolean {
        return this.sourceFile.languageVersion >= ts.ScriptTarget.ES2015 || this.program.getCompilerOptions().downlevelIteration === true;
    }

    private isArrayLike(type: ts.Type): boolean {
        if (isTypeReference(type))
            type = type.target;
        if (type.getNumberIndexType() === undefined)
            return false;
        if (type.flags & ts.TypeFlags.StringLike)
            return this.sourceFile.languageVersion >= ts.ScriptTarget.ES5; // iterating string is only possible starting from ES5
        if (type.symbol !== undefined && /^(Concat|Readonly)?Array$/.test(<string>type.symbol.escapedName) &&
            type.symbol.declarations !== undefined && type.symbol.declarations.some(this.isDeclaredInDefaultLib, this))
            return true;
        if (isIntersectionType(type))
            return type.types.some(this.isArrayLike, this);
        const baseTypes = type.getBaseTypes();
        return baseTypes !== undefined && baseTypes.some(this.isArrayLike, this);
    }

    private isDeclaredInDefaultLib(node: ts.Node): boolean {
        // we assume it's the global array type if it comes from any lib.xxx.d.ts file
        return path.normalize(path.dirname(node.getSourceFile().fileName))
            === path.dirname(ts.getDefaultLibFilePath(this.program.getCompilerOptions()));
    }

    private isIterable(type: ts.Type, node: ts.Expression): boolean {
        const iteratorFn = type.getProperties().find((p) => p.escapedName === '__@iterator');
        if (!isPresentAndRequired(iteratorFn))
            return false;
        return checkReturnTypeAndRequireZeroArity(this.checker.getTypeOfSymbolAtLocation(iteratorFn, node), (iterator) => {
            const next = iterator.getProperty('next');
            return isPresentAndRequired(next) &&
                checkReturnTypeAndRequireZeroArity(this.checker.getTypeOfSymbolAtLocation(next, node), (iteratorResult) => {
                    const done = iteratorResult.getProperty('done');
                    return isPresentAndRequired(done) &&
                        unionTypeParts(this.checker.getTypeOfSymbolAtLocation(done, node))
                            .every((t) => isTypeFlagSet(t, ts.TypeFlags.BooleanLike)) &&
                        isPresentAndRequired(iteratorResult.getProperty('value'));
                });

        });
    }
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
    // TODO does this need to handle JSDoc tags?
    if (node.questionToken !== undefined || node.dotDotDotToken !== undefined)
        return true;
    if (node.initializer === undefined)
        return false;
    const parameters = node.parent!.parameters;
    const nextIndex = parameters.indexOf(node) + 1;
    if (nextIndex === parameters.length)
        return true;
    return isOptionalParameter(parameters[nextIndex]);
}

function isPresentAndRequired(symbol: ts.Symbol | undefined): symbol is ts.Symbol {
    return symbol !== undefined && !isSymbolFlagSet(symbol, ts.SymbolFlags.Optional);
}

function isReadonlyArrayAccess(uses: VariableUse[], arrayVariable: string, statement: ts.ForStatement, sourceFile: ts.SourceFile): boolean {
    let arrayAccess = false;
    for (const {location: use} of uses) {
        if (use.pos < statement.pos || use.end > statement.end)
            return false; // used outside of the loop
        if (use.pos < statement.statement.pos)
            continue; // uses in loop header are already checked
        const parent = use.parent!;
        if (!isElementAccessExpression(parent) ||
            parent.argumentExpression !== use ||
            parent.expression.getText(sourceFile) !== arrayVariable ||
            isReassignmentTarget(parent))
            return false;
        arrayAccess = true;
    }
    return arrayAccess; // needs at least one array access
}

function extractArrayVariable(condition: ts.Expression, indexVariable: string): ts.Expression | undefined {
    if (!isBinaryExpression(condition))
        return;
    let left: ts.Expression;
    let right: ts.Expression;
    switch (condition.operatorToken.kind) {
        case ts.SyntaxKind.LessThanToken:
            // i < foo.length
            ({left, right} = condition);
            break;
        case ts.SyntaxKind.GreaterThanToken:
            // foo.length > i
            ({left: right, right: left} = condition);
            break;
        default:
            return;
    }
    if (!isVariable(left, indexVariable) || !isPropertyAccessExpression(right) || right.name.text !== 'length')
        return;
    return right.expression;
}

function extractIndexVariable(initializer: ts.ForInitializer, incrementor: ts.Expression): ts.Identifier | undefined {
    // there must be only one variable declared
    if (!isVariableDeclarationList(initializer) ||
        initializer.declarations.length !== 1)
        return;
    const declaration = initializer.declarations[0];
    // variable must be initialized to 0
    if (declaration.name.kind !== ts.SyntaxKind.Identifier || declaration.initializer === undefined ||
        !isNumber(declaration.initializer, 0))
        return;
    // variable must be incremented by one
    if (!isIncrementedByOne(incrementor, declaration.name.text))
        return;
    return declaration.name;
}

function isIncrementedByOne(node: ts.Expression, name: string): boolean {
    if (isPostfixUnaryExpression(node) || isPrefixUnaryExpression(node))
        // ++var or var++
        return node.operator === ts.SyntaxKind.PlusPlusToken && isVariable(node.operand, name);
    if (!isBinaryExpression(node))
        return false;
    switch (node.operatorToken.kind) {
        case ts.SyntaxKind.PlusEqualsToken:
            // var += 1
            return isVariable(node.left, name) && isNumber(node.right, 1);
        case ts.SyntaxKind.EqualsToken:
            // var = var + 1 or var = 1 + var
            return isVariable(node.left, name) &&
                isBinaryExpression(node.right) && node.right.operatorToken.kind === ts.SyntaxKind.PlusToken &&
                (
                    isVariable(node.right.left, name) && isNumber(node.right.right, 1) ||
                    isNumber(node.right.left, 1) && isVariable(node.right.right, name)
                );
        default:
            return false;
    }
}

function isVariable(node: ts.Expression, name: string): boolean {
    return isIdentifier(node) && node.text === name;
}

function isNumber(node: ts.Expression, value: number): boolean {
    return isNumericLiteral(node) && node.text === String(value);
}
