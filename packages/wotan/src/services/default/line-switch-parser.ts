import { injectable } from 'inversify';
import { LineSwitchParser, LineSwitchParserContext, LineSwitch } from '../../types';
import * as ts from 'typescript';

export const LINE_SWITCH_REGEX = /^\s*wotan-(enable|disable)((?:-next)?-line)?(\s+(?:(?:[\w-]+\/)*[\w-]+\s*,\s*)*(?:[\w-]+\/)*[\w-]+)?\s*$/;

@injectable()
export class DefaultLineSwitchParser implements LineSwitchParser {
    public parse(sourceFile: ts.SourceFile, ruleNames: ReadonlyArray<string>, context: LineSwitchParserContext) {
        const result = new Map<string, LineSwitch[]>();
        const commentRegex =
            /\/[/*]\s*wotan-(enable|disable)((?:-next)?-line)?(\s+(?:(?:[\w-]+\/)*[\w-]+\s*,\s*)*(?:[\w-]+\/)*[\w-]+)?\s*?(?:$|\*\/)/mg;

        for (let match = commentRegex.exec(sourceFile.text); match !== null; match = commentRegex.exec(sourceFile.text)) {
            const comment = context.getCommentAtPosition(match.index);
            if (comment === undefined || comment.pos !== match.index || comment.end !== match.index + match[0].length)
                continue;
            const rules = match[3] === undefined ? undefined : Array.from(new Set(match[3].trim().split(/\s*,\s*/g)));
            const enable = match[1] === 'enable';
            switch (match[2]) {
                case undefined:
                    this.switch(result, ruleNames, rules, {enable, position: comment.pos});
                    break;
                case '-line': {
                    const lineStarts = sourceFile.getLineStarts();
                    let {line} = ts.getLineAndCharacterOfPosition(sourceFile, comment.pos);
                    this.switch(result, ruleNames, rules, {enable, position: lineStarts[line]});
                    ++line;
                    if (lineStarts.length !== line) // no need to switch back if there is no next line
                        this.switch(result, ruleNames, rules, {enable: !enable, position: lineStarts[line]});
                    break;
                }
                case '-next-line': {
                    const lineStarts = sourceFile.getLineStarts();
                    let line = ts.getLineAndCharacterOfPosition(sourceFile, comment.pos).line + 1;
                    if (lineStarts.length === line)
                        continue; // no need to switch if there is no next line
                    this.switch(result, ruleNames, rules, {enable, position: lineStarts[line]});
                    ++line;
                    if (lineStarts.length > line) // no need to switch back if there is no next line
                        this.switch(result, ruleNames, rules, {enable: !enable, position: lineStarts[line]});
                }
            }
        }
        return result;
    }

    private switch(map: Map<string, LineSwitch[]>, enabled: ReadonlyArray<string>, rules = enabled, s: LineSwitch) {
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
