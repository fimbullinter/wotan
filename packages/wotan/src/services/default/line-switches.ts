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
    RawLineSwitchRule,
    FindingPosition,
    Severity,
    Replacement,
} from '@fimbul/ymir';
import { assertNever } from '../../utils';

export const LINE_SWITCH_REGEX = /^ *wotan-(enable|disable)((?:-next)?-line)?( +(?:(?:[\w-]+\/)*[\w-]+ *, *)*(?:[\w-]+\/)*[\w-]+)? *$/;

const enum SwitchState {
    NoChange,
    Redundant,
    NoMatch,
    Unused,
    Used,
}
interface RuleSwitch {
    state: SwitchState;
    location?: ts.TextRange;
    fixLocation?: ts.TextRange;
}
interface Switch {
    location: ts.TextRange;
    enable: boolean;
    rules: RuleSwitch[];
}

@injectable()
export class LineSwitchFilterFactory implements FindingFilterFactory {
    constructor(private parser: LineSwitchParser) {}

    public create(context: FindingFilterContext): FindingFilter {
        const {disables, switches} = this.getDisabledRanges(context);
        return new Filter(disables, switches, context.sourceFile);
    }

    public getDisabledRanges(context: FindingFilterContext) {
        const {sourceFile, ruleNames} = context;
        let wrappedAst: WrappedAst | undefined;
        const raw = this.parser.parse({
            sourceFile,
            getCommentAtPosition(pos) {
                const wrap = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = context.getWrappedAst()), pos);
                if (wrap === undefined)
                    return;
                return getCommentAtPosition(sourceFile, pos, wrap.node);
            },
        });

        const switches = [];
        const result: DisableMap = new Map();
        for (const lineSwitch of raw) {
            const currentSwitch: Switch = {
                location: lineSwitch.location,
                enable: lineSwitch.enable,
                rules: [],
            };
            switches.push(currentSwitch);
            const rules = new Map<string, RuleSwitch>();
            for (const switchedName of lineSwitch.rules) {
                const ruleSwitch: RuleSwitch = {
                    location: switchedName.location,
                    fixLocation: switchedName.fixLocation || switchedName.location,
                    state: SwitchState.NoChange,
                };
                currentSwitch.rules.push(ruleSwitch);
                switch (typeof switchedName.predicate) {
                    case 'string':
                        if (!ruleNames.includes(switchedName.predicate)) {
                            ruleSwitch.state = SwitchState.NoMatch;
                        } else if (rules.has(switchedName.predicate)) {
                            ruleSwitch.state = SwitchState.Redundant;
                        } else {
                            rules.set(switchedName.predicate, ruleSwitch);
                        }
                        break;
                    case 'function': {
                        let matched = false;
                        let added = false;
                        for (const rule of ruleNames) {
                            if (switchedName.predicate(rule)) {
                                matched = true;
                                if (!rules.has(rule)) {
                                    added = true;
                                    rules.set(rule, ruleSwitch);
                                }
                            }
                        }
                        if (!matched) {
                            ruleSwitch.state = SwitchState.NoMatch;
                        } else if (!added) {
                            ruleSwitch.state = SwitchState.Redundant;
                        }
                        break;
                    }
                    default:
                        throw assertNever(switchedName.predicate);
                }
            }
            for (const [rule, ruleSwitch] of rules) {
                const ranges = result.get(rule);
                if (ranges === undefined) {
                    if (lineSwitch.enable)
                        continue; // rule is already enabled
                    result.set(
                        rule,
                        [{pos: lineSwitch.pos, end: lineSwitch.end === undefined ? Infinity : lineSwitch.end, switch: ruleSwitch}],
                    );
                } else {
                    const last = ranges[ranges.length - 1];
                    if (last.end === Infinity) {
                        if (!lineSwitch.enable)
                            continue; // rule is already disabled
                        last.end = lineSwitch.pos;
                        if (lineSwitch.end !== undefined)
                            ranges.push({pos: lineSwitch.end, end: Infinity, switch: ruleSwitch});
                    } else if (lineSwitch.enable || lineSwitch.pos < last.end) {
                        // rule is already enabled
                        // or disabled range is nested inside the previous range
                        continue;
                    } else {
                        ranges.push({
                            pos: lineSwitch.pos,
                            end: lineSwitch.end === undefined ? Infinity : lineSwitch.end,
                            switch: ruleSwitch,
                        });
                    }
                }
                ruleSwitch.state = SwitchState.Unused;
            }
        }
        return {switches, disables: result};
    }
}

interface DisabledRange extends ts.TextRange {
    switch: RuleSwitch;
}

type DisableMap = Map<string, DisabledRange[]>;

class Filter implements FindingFilter {
    constructor(private disables: DisableMap, private switches: Switch[], private sourceFile: ts.SourceFile) {}

    public filter(finding: Finding) {
        const ruleDisables = this.disables.get(finding.ruleName);
        if (ruleDisables !== undefined) {
            const {start: {position: pos}, end: {position: end}} = finding;
            for (const disabledRange of ruleDisables) {
                if (end > disabledRange.pos && pos < disabledRange.end) {
                    disabledRange.switch.state = SwitchState.Used;
                    return false;
                }
            }
        }
        return true;
    }

    public reportUseless(severity: Severity) {
        const result: Finding[] = [];
        for (const current of this.switches) {
            if (current.rules.length === 0) {
                result.push(
                    this.createFinding(
                        `${current.enable ? 'Enable' : 'Disable'} switch doesn't specify any rule names.`,
                        severity,
                        current.location,
                    ),
                );
                continue;
            }
            const counts = current.rules.reduce<Partial<Record<Exclude<SwitchState, SwitchState.Redundant>, number>>>(
                (acc, {state}) => {
                    if (state !== SwitchState.Redundant)
                        acc[state] = (acc[state] || 0) + 1;
                    return acc;
                },
                {},
            );
            if (!counts[SwitchState.Used] && (!current.enable || !counts[SwitchState.Unused])) {
                const states = [];
                if (counts[SwitchState.NoChange])
                    states.push('are already ' + (current.enable ? 'enabled' : 'disabled'));
                if (counts[SwitchState.NoMatch])
                    states.push("don't match any rules enabled for this file");
                if (counts[SwitchState.Unused])
                    states.push('have no failures to disable');
                result.push(
                    this.createFinding(
                        `${current.enable ? 'Enable' : 'Disable'} switch has no effect. All specified rules ${join(states)}.`,
                        severity,
                        current.location,
                    ),
                );
                continue;
            }
            for (const ruleSwitch of current.rules) {
                if (
                    ruleSwitch.location === undefined ||
                    ruleSwitch.state === SwitchState.Used ||
                    current.enable && ruleSwitch.state === SwitchState.Unused
                )
                    continue;
                let message: string;
                switch (ruleSwitch.state) {
                    case SwitchState.Redundant:
                        message = `was already specified in this ${current.enable ? 'enable' : 'disable'} switch`;
                        break;
                    case SwitchState.NoMatch:
                        message = "doesn't match any rules enabled for this file";
                        break;
                    case SwitchState.NoChange:
                        message = `is already ${current.enable ? 'enabled' : 'disabled'}`;
                        break;
                    case SwitchState.Unused:
                        message = 'has no failures to disable';
                        break;
                    default:
                        throw assertNever(ruleSwitch.state);
                }
                result.push(this.createFinding(`This rule ${message}.`, severity, ruleSwitch.location));
            }
        }
        return result;
    }

    private createPosition(pos: number): FindingPosition {
        return {
            position: pos,
            ...ts.getLineAndCharacterOfPosition(this.sourceFile, pos),
        };
    }

    private createFinding(message: string, severity: Severity, location: ts.TextRange, fixLocation = location): Finding {
        return {
            ruleName: 'useless-line-switch',
            severity, // tslint:disable-line:object-shorthand-properties-first
            message, // tslint:disable-line:object-shorthand-properties-first
            start: this.createPosition(location.pos),
            end: this.createPosition(location.end),
            fix: {replacements: [Replacement.delete(fixLocation.pos, fixLocation.end)]},
        };
    }
}

function join(parts: string[]): string {
    if (parts.length === 1)
        return parts[0];
    return parts.slice(0, -1).join(', ') + ' or ' + parts[parts.length - 1];
}

@injectable()
export class DefaultLineSwitchParser implements LineSwitchParser {
    public parse(context: LineSwitchParserContext) {
        const {sourceFile} = context;
        const result: RawLineSwitch[] = [];
        // tslint:disable-next-line:max-line-length
        const commentRegex = /(\/[/*] *wotan-(enable|disable)((?:-next)?-line)?)( +(?:(?:[\w-]+\/)*[\w-]+ *, *)*(?:[\w-]+\/)*[\w-]+)? *(?:$|\*\/)/mg;

        for (let match = commentRegex.exec(sourceFile.text); match !== null; match = commentRegex.exec(sourceFile.text)) {
            const comment = context.getCommentAtPosition(match.index);
            if (comment === undefined || comment.pos !== match.index || comment.end !== match.index + match[0].length)
                continue;
            // wotan-disable-next-line no-useless-predicate
            const rules = match[4] === undefined ? [{predicate: () => true}] : parseRules(match[4], match[1].length);
            const enable = match[2] === 'enable';
            switch (match[3]) {
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

function parseRules(raw: string, offset: number) {
    const result: RawLineSwitchRule[] = [];
    const re = /( *, *|$)/g;
    let pos = raw.search(/[^ ]/);
    let fixPos = pos;
    for (let match = re.exec(raw)!; ; match = re.exec(raw)!) {
        result.push({
            predicate: raw.slice(pos, match.index),
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
