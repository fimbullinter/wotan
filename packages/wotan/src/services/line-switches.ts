import * as ts from 'typescript';
import { getCommentAtPosition, WrappedAst, getWrappedNodeAtPosition } from 'tsutils';
import { injectable } from 'inversify';
import { LineSwitchParser, LineSwitch } from '../types';

export type DisableMap = Map<string, ts.TextRange[]>;

@injectable()
export class LineSwitchService {
    constructor(private parser: LineSwitchParser) {}

    public getDisabledRanges(sourceFile: ts.SourceFile, enabledRules: ReadonlyArray<string>, getWrappedAst?: () => WrappedAst) {
        let wrappedAst: WrappedAst | undefined;
        const raw = this.parser.parse(sourceFile, enabledRules, {
            getCommentAtPosition(pos) {
                let parent: ts.Node | undefined;
                if (getWrappedAst !== undefined) {
                    if (wrappedAst === undefined)
                        wrappedAst = getWrappedAst();
                    const wrap = getWrappedNodeAtPosition(wrappedAst, pos);
                    if (wrap !== undefined)
                        parent = wrap.node;
                }
                return getCommentAtPosition(sourceFile, pos, parent);
            },
        });

        const result = new Map<string, ts.TextRange[]>();
        for (const [rule, switches] of raw) {
            if (!enabledRules.includes(rule))
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

    public isDisabled(disables: DisableMap, ruleName: string, range: ts.TextRange) {
        const ruleDisables = disables.get(ruleName);
        if (ruleDisables !== undefined)
            for (const disabledRange of ruleDisables)
                if (range.end > disabledRange.pos && range.pos < disabledRange.end)
                    return true;
        return false;
    }
}

function compareLineSwitches(a: LineSwitch, b: LineSwitch): number {
    return a.position - b.position || (a.enable ? 0 : 1) - (b.enable ? 0 : 1);
}
