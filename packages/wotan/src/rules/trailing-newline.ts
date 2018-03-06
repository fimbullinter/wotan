import { AbstractRule, Replacement } from '@fimbul/ymir';

export class Rule extends AbstractRule {
    public apply() {
        const sourceFile = this.sourceFile;
        const end = sourceFile.end;
        if (end === 0 || end === 1 && sourceFile.text[0] === '\uFEFF' || sourceFile.text[end - 1] === '\n')
            return;
        const lines = sourceFile.getLineStarts();
        this.addFailure(
            end,
            end,
            'File must end with a newline.',
            Replacement.append(end, lines.length === 0 || sourceFile.text[lines[1] - 2] !== '\r' ? '\n' : '\r\n'),
        );
    }
}
