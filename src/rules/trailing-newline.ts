import * as ts from 'typescript';
import { RuleFailure } from '../linter';

export class Rule {
    public apply(sourceFile: ts.SourceFile): RuleFailure[] {
        if (sourceFile.end === 0 || sourceFile.end === 1 && sourceFile.text[0] === '\UFEFF' || sourceFile.text[sourceFile.end - 1] === '\n')
            return [];
        const lines = sourceFile.getLineStarts();
        return [{
            start: sourceFile.end,
            end: sourceFile.end,
            message: 'File must end with a newline.',
            fix: {
                start: sourceFile.end,
                end: sourceFile.end,
                text: lines.length === 0 || sourceFile.text[lines[1] - 2] !== '\r' ? '\n' : '\r\n',
            },
        }];
    }
}
