import { AbstractRule, excludeDeclarationFiles, Replacement } from '@fimbul/ymir';
import { WrappedAst, getWrappedNodeAtPosition } from 'tsutils';
import * as ts from 'typescript';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        const re = /(\\*)\\(?:[1-7][0-7]{0,2}|[0-7]{2,3})/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            if (match[1].length & 1) // only check if backslash is not escaped
                continue;
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            switch (node.kind) {
                case ts.SyntaxKind.StringLiteral:
                case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
                case ts.SyntaxKind.TemplateHead:
                case ts.SyntaxKind.TemplateMiddle:
                case ts.SyntaxKind.TemplateTail:
                    if (match.index >= node.getStart(this.sourceFile))
                        this.addFailure(
                            match.index + match[1].length,
                            re.lastIndex,
                            'Octal escapes are deprecated and not allowed in strict mode.',
                            Replacement.replace(
                                match.index + match[1].length + 1,
                                re.lastIndex,
                                `u${toUnicodeSequence(parseInt(match[0].substr(match[1].length + 1), 8))}`,
                            ),
                        );
            }
        }
    }
}

function toUnicodeSequence(num: number): string {
    const result = num.toString(16);
    return '0'.repeat(4 - result.length) + result;
}
