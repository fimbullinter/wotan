import { injectable } from 'inversify';
import { LineSwitchParser, RawLineSwitch, LineSwitchParserContext, RawLineSwitchRule } from '@fimbul/wotan';
import * as ts from 'typescript';
import { getCommentAtPosition } from 'tsutils';

const matchAll = /^/;

@injectable()
export class TslintLineSwitchParser implements LineSwitchParser {
    public parse({sourceFile}: LineSwitchParserContext) {
        const result: RawLineSwitch[] = [];
        const re = /\/[/*]\s*tslint:(enable|disable)(-line|-next-line)?(:)?/gm;
        for (let match = re.exec(sourceFile.text); match !== null; match = re.exec(sourceFile.text)) {
            // not using `context.getCommentAtPosition` here is intentional, because it doesn't benefit from caching the converted AST
            const comment = getCommentAtPosition(sourceFile, match.index);
            if (comment === undefined || comment.pos !== match.index)
                continue;
            const ruleNames = sourceFile.text.substring(
                comment.pos + match[0].length,
                comment.kind === ts.SyntaxKind.SingleLineCommentTrivia ? comment.end : {pos: comment.pos, end: comment.end}.end - 2,
            );
            let rules: RawLineSwitch['rules'];
            if (/\S/.test(ruleNames)) {
                rules = parseRules(ruleNames, comment.pos + match[0].length);
            } else {
                rules = match[3] === ':' ? [] : [{predicate: matchAll}];
            }
            const enable = match[1] === 'enable';
            switch (match[2]) {
                case '-line': {
                    const lineStarts = sourceFile.getLineStarts();
                    const {line} = ts.getLineAndCharacterOfPosition(sourceFile, comment.pos);
                    result.push({
                        rules,
                        enable,
                        pos: lineStarts[line],
                        // no need to switch back if there is no next line
                        end: lineStarts.length === line + 1 ? undefined : lineStarts[line + 1],
                        location: {pos: comment.pos, end: comment.end},
                    });
                    break;
                }
                case '-next-line': {
                    const lineStarts = sourceFile.getLineStarts();
                    const line = ts.getLineAndCharacterOfPosition(sourceFile, comment.pos).line + 1;
                    if (lineStarts.length === line) {
                        // there is no next line, return an out-of-range switch that can be reported
                        result.push({
                            rules, enable,
                            pos: sourceFile.end + 1,
                            end: undefined,
                            location: {pos: comment.pos, end: comment.end},
                        });
                    } else {
                        result.push({
                            rules,
                            enable,
                            pos: lineStarts[line],
                            // no need to switch back if there is no next line
                            end: lineStarts.length === line + 1 ? undefined : lineStarts[line + 1],
                            location: {pos: comment.pos, end: comment.end},
                        });
                    }
                    break;
                }
                default:
                    result.push({rules, enable, pos: comment.pos, end: undefined, location: {pos: comment.pos, end: comment.end}});
            }
        }
        return result;
    }
}

function parseRules(raw: string, offset: number) {
    const re = /(\s+|$)/g;
    const skippedWhitespace = raw.search(/\S/);
    offset += skippedWhitespace;
    raw = raw.substr(skippedWhitespace);
    let pos = 0;
    let fixPos = -skippedWhitespace;
    const result: RawLineSwitchRule[] = [];
    for (let match = re.exec(raw)!; ; match = re.exec(raw)!) {
        const rule = raw.slice(pos, match.index);
        result.push({
            predicate: rule === 'all' ? matchAll : rule,
            location: {pos: pos + offset, end: match.index + offset},
            fixLocation: {pos: fixPos + offset, end: match.index + offset},
        });
        if (match[0].length === 0)
            break;
        pos = re.lastIndex;
        fixPos = match.index; // fix always removes the preceeding comma
    }
    return result;
}
