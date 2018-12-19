import { injectable } from 'inversify';
import * as ts from 'typescript';
import { getCommentAtPosition, WrappedAst, getWrappedNodeAtPosition } from 'tsutils';
import {
    FindingFilterFactory,
    FindingFilter,
    Finding,
    FindingFilterContext,
    LineSwitchParser,
    LineSwitchParserContext,
    RawLineSwitch,
} from '@fimbul/ymir';

export const LINE_SWITCH_REGEX = /^\s*wotan-(enable|disable)((?:-next)?-line)?(\s+(?:(?:[\w-]+\/)*[\w-]+\s*,\s*)*(?:[\w-]+\/)*[\w-]+)?\s*$/;

@injectable()
export class LineSwitchFilterFactory implements FindingFilterFactory {
    constructor(private parser: LineSwitchParser) {}

    public create(context: FindingFilterContext): FindingFilter {
        return new Filter(this.getDisabledRanges(context));
    }

    public getDisabledRanges(context: FindingFilterContext) {
        const {sourceFile, ruleNames} = context;
        let wrappedAst: WrappedAst | undefined;
        const raw = this.parser.parse({
            sourceFile,
            ruleNames,
            getCommentAtPosition(pos) {
                const wrap = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = context.getWrappedAst()), pos);
                if (wrap === undefined)
                    return;
                return getCommentAtPosition(sourceFile, pos, wrap.node);
            },
        });

        const result: DisableMap = new Map();
        for (const [rule, switches] of raw) {
            if (!ruleNames.includes(rule))
                continue;
            const disables: ts.TextRange[] = [];
            let isDisabled = false;
            for (const s of switches.slice().sort(compareLineSwitches)) {
                if (s.enable) {
                    if (!isDisabled)
                        continue;
                    isDisabled = false;
                    disables[disables.length - 1].end = s.position;
                } else if (isDisabled) {
                    continue;
                } else {
                    isDisabled = true;
                    disables.push({pos: s.position, end: Infinity});
                }
            }
            if (disables.length !== 0)
                result.set(rule, disables);
        }
        return result;
    }
}

type DisableMap = Map<string, ts.TextRange[]>;

class Filter implements FindingFilter {
    constructor(private disables: DisableMap) {}

    public filter(finding: Finding) {
        const ruleDisables = this.disables.get(finding.ruleName);
        if (ruleDisables !== undefined) {
            const {start: {position: pos}, end: {position: end}} = finding;
            for (const disabledRange of ruleDisables)
                if (end > disabledRange.pos && pos < disabledRange.end)
                    return false;
        }
        return true;
    }
}

function compareLineSwitches(a: RawLineSwitch, b: RawLineSwitch): number {
    return a.position - b.position || (a.enable ? 0 : 1) - (b.enable ? 0 : 1);
}

@injectable()
export class DefaultLineSwitchParser implements LineSwitchParser {
    public parse(context: LineSwitchParserContext) {
        const {sourceFile, ruleNames} = context;
        const result = new Map<string, RawLineSwitch[]>();
        const commentRegex =
            /\/[/*]\s*wotan-(enable|disable)((?:-next)?-line)?(\s+(?:(?:[\w-]+\/)*[\w-]+\s*,\s*)*(?:[\w-]+\/)*[\w-]+)?\s*?(?:$|\*\/)/mg;

        for (let match = commentRegex.exec(sourceFile.text); match !== null; match = commentRegex.exec(sourceFile.text)) {
            const comment = context.getCommentAtPosition(match.index);
            if (comment === undefined || comment.pos !== match.index || comment.end !== match.index + match[0].length)
                continue;
            // wotan-disable-next-line no-useless-predicate
            const rules = match[3] === undefined ? undefined : new Set(match[3].trim().split(/\s*,\s*/g));
            const enable = match[1] === 'enable';
            switch (match[2]) {
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
                    break;
                }
                default:
                    this.switch(result, ruleNames, rules, {enable, position: comment.pos});
            }
        }
        return result;
    }

    private switch(map: Map<string, RawLineSwitch[]>, enabled: ReadonlyArray<string>, rules: Iterable<string> = enabled, s: RawLineSwitch) {
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
