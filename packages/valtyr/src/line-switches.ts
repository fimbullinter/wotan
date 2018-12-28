import { injectable } from 'inversify';
import { LineSwitchParser, RawLineSwitch, LineSwitchParserContext } from '@fimbul/wotan';
import * as ts from 'typescript';
import { getCommentAtPosition } from 'tsutils';

@injectable()
export class TslintLineSwitchParser implements LineSwitchParser {
    public parse({sourceFile}: LineSwitchParserContext) {
        const result: RawLineSwitch[] = [];
        const re = /\/[/*]\s*tslint:(enable|disable)(-line|-next-line)?($|[ *:])/gm;
        for (let match = re.exec(sourceFile.text); match !== null; match = re.exec(sourceFile.text)) {
            // not using `context.getCommentAtPosition` here is intentional, because it doesn't benefit from caching the converted AST
            const comment = getCommentAtPosition(sourceFile, match.index);
            if (comment === undefined || comment.pos !== match.index)
                continue;
            const rulesNames = sourceFile.text
                .substring(
                    comment.pos + match[0].length,
                    comment.kind === ts.SyntaxKind.SingleLineCommentTrivia ? comment.end : comment.end - 2,
                )
                .trim();
            let rules: RawLineSwitch['rules'];
            if (rulesNames === '') {
                rules = match[3] === ':' ? [] : [{predicate: matchAll}];
            } else {
                rules = rulesNames.split(/\s+/).map((rule) => ({predicate: rule === 'all' ? matchAll : rule}));
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
                        location: comment,
                    });
                    break;
                }
                case '-next-line': {
                    const lineStarts = sourceFile.getLineStarts();
                    const line = ts.getLineAndCharacterOfPosition(sourceFile, comment.pos).line + 1;
                    if (lineStarts.length === line)
                        continue; // no need to switch if there is no next line
                    result.push({
                        rules,
                        enable,
                        pos: lineStarts[line],
                        // no need to switch back if there is no next line
                        end: lineStarts.length === line + 1 ? undefined : lineStarts[line + 1],
                        location: comment,
                    });
                    break;
                }
                default:
                result.push({rules, enable, pos: comment.pos, end: undefined, location: comment});
            }
        }
        return result;
    }
}

function matchAll() {
    return true;
}
