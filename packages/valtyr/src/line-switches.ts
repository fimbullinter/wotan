import { injectable } from 'inversify';
import { LineSwitchParser, LineSwitchParserContext, LineSwitch, LineSwitchMap } from '@fimbul/wotan';
import * as ts from 'typescript';

@injectable()
export class TslintLineSwitchParser implements LineSwitchParser {
    public parse(sourceFile: ts.SourceFile, enabledRules: ReadonlyArray<string>, context: LineSwitchParserContext): LineSwitchMap {
        const result = new Map<string, LineSwitch[]>();
        const re = /\/[/*]\s*tslint:(enable|disable)(-line|-next-line)?($|[ *:])/gm;
        for (let match = re.exec(sourceFile.text); match !== null; match = re.exec(sourceFile.text)) {
            const comment = context.getCommentAtPosition(match.index);
            if (comment === undefined || comment.pos !== match.index)
                continue;
            const rules = sourceFile.text
                .substring(
                    comment.pos + match[0].length,
                    comment.kind === ts.SyntaxKind.SingleLineCommentTrivia ? comment.end : comment.end - 2,
                )
                .trim();
            let switchedRules: ReadonlyArray<string>;
            if (rules === '') {
                if (match[3] === ':')
                    continue;
                switchedRules = enabledRules;
            } else {
                switchedRules = rules.split(/\s+/);
                if (switchedRules.includes('all'))
                    switchedRules = enabledRules;
            }
            const enable = match[1] === 'enable';
            switch (match[2]) {
                default:
                    this.switch(result, enabledRules, switchedRules, {enable, position: comment.pos});
                    break;
                case '-line': {
                    const lineStarts = sourceFile.getLineStarts();
                    let {line} = ts.getLineAndCharacterOfPosition(sourceFile, comment.pos);
                    this.switch(result, enabledRules, switchedRules, {enable, position: lineStarts[line]});
                    ++line;
                    if (lineStarts.length !== line) // no need to switch back if there is no next line
                        this.switch(result, enabledRules, switchedRules, {enable: !enable, position: lineStarts[line]});
                    break;
                }
                case '-next-line': {
                    const lineStarts = sourceFile.getLineStarts();
                    let line = ts.getLineAndCharacterOfPosition(sourceFile, comment.pos).line + 1;
                    if (lineStarts.length === line)
                        continue; // no need to switch if there is no next line
                    this.switch(result, enabledRules, switchedRules, {enable, position: lineStarts[line]});
                    ++line;
                    if (lineStarts.length > line) // no need to switch back if there is no next line
                        this.switch(result, enabledRules, switchedRules, {enable: !enable, position: lineStarts[line]});
                }
            }
        }
        return result;
    }

    private switch(map: Map<string, LineSwitch[]>, enabled: ReadonlyArray<string>, rules: ReadonlyArray<string>, s: LineSwitch) {
        for (const rule of rules) {
            if (!enabled.includes(rule))
                continue;
            const existing = map.get(rule);
            if (existing === undefined) {
                map.set(rule, [s]);
            } else {
                existing.push(s);
            }
        }
    }
}
