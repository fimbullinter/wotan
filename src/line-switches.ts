import * as ts from 'typescript';
import { getCommentAtPosition } from 'tsutils';

export const LINE_SWITCH_REGEX = /^\s*wotan-(enable|disable)((?:-next)?-line)?(\s+(?:(?:[\w-]+\/)?[\w-]+\s*,\s*)*(?:[\w-]+\/)?[\w-]+)?\s*$/;

export type DisableMap = Map<string, ts.TextRange[]>;

export function getDisabledRanges(enabledRules: string[], sourceFile: ts.SourceFile): DisableMap {
    const commentRegex =
        /\/[/*]\s*wotan-(enable|disable)((?:-next)?-line)?(\s+(?:(?:[\w-]+\/)?[\w-]+\s*,\s*)*(?:[\w-]+\/)?[\w-]+)?\s*(?:$|\r?\n|\*\/)/g;
    const result: DisableMap = new Map();

    for (let match = commentRegex.exec(sourceFile.text); match !== null; match = commentRegex.exec(sourceFile.text)) {
        const comment = getCommentAtPosition(sourceFile, match.index);
        if (comment === undefined || comment.pos !== match.index || comment.end !== match.index + lengthWithoutLineBreak(match[0]))
            continue;
        const rules = match[3] === undefined ? undefined : Array.from(new Set(match[3].trim().split(/\s*,\s*/g)));
        let pos = comment.pos;
        let end: number | undefined;
        switch (match[2]) {
            case '-line': {
                const lineStarts = sourceFile.getLineStarts();
                let {line} = ts.getLineAndCharacterOfPosition(sourceFile, comment.pos);
                pos = lineStarts[line];
                ++line;
                if (lineStarts.length !== line) // no need to switch back if there is no next line
                    end = lineStarts[line];
                break;
            }
            case '-next-line': {
                const lineStarts = sourceFile.getLineStarts();
                let line = ts.getLineAndCharacterOfPosition(sourceFile, comment.pos).line + 1;
                if (lineStarts.length === line)
                    continue; // no need to switch if there is no next line
                pos = lineStarts[line];
                ++line;
                if (lineStarts.length > line) // no need to switch back if there is no next line
                    end = lineStarts[line];
            }
        }
        switchRules(result, enabledRules, rules, match[1] === 'disable', pos, end);
    }

    return result;
}

function switchRules(map: DisableMap, enabledRules: string[], rules = enabledRules, disable: boolean, pos: number, end = Infinity) {
    for (const rule of rules) {
        if (!enabledRules.includes(rule))
            continue;
        const existing = map.get(rule);
        if (existing === undefined) {
            if (disable)
                map.set(rule, [{pos, end}]);
            continue;
        }
        const last = existing[existing.length - 1];
        if (disable) {
            if (last.end !== Infinity)
                existing.push({pos, end});
            continue;
        }
        if (last.end === Infinity) {
            last.end = pos;
            if (end !== Infinity)
                existing.push({pos: end, end: Infinity});
        }
    }
}

function lengthWithoutLineBreak(str: string): number {
    const length = str.length;
    return str[length - 1] !== '\n'
        ? length
        : length - (str[length - 2] === '\r' ? 2 : 1);
}
