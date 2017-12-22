import * as ts from 'typescript';
import { Fix, Replacement } from './types';

export interface FixResult {
    result: string;
    fixed: number;
    range: ts.TextChangeRange;
}

/**
 * Tries to apply all fixes. The replacements of all fixes are sorted by index ascending.
 * They are then applied in order. If a replacement overlaps (or touches) the range of the previous replacement,
 * the process rolls back to the state before the first replacement of the offending fix was applied. The replacements
 * of this fix are not applied again.
 */
export function applyFixes(source: string, fixes: Fix[]): FixResult {
    interface FixWithState extends Fix {
        state: Record<'position' | 'index' | 'length', number> | undefined;
        skip: boolean;
    }
    let fixed = fixes.length;
    const replacements = [];
    for (const fix of fixes) {
        const state: FixWithState = {replacements: combineReplacements(fix.replacements), skip: false, state: undefined};
        for (const replacement of fix.replacements)
            replacements.push({fix: state, ...replacement});
    }
    const range: ts.TextChangeRange = {
        span: {
            start: 0,
            length: 0,
        },
        newLength: 0,
    };
    let output = '';
    let position = -1;
    replacements.sort(compareReplacements);
    for (let i = 0; i < replacements.length; ++i) {
        const replacement = replacements[i];
        if (replacement.fix.skip)
            continue; // there was a conflict, don't use replacements of this fix
        if (replacement.start <= position) {
            // ranges overlap (or have touching boundaries) -> don't fix to prevent unspecified behavior
            if (replacement.fix.state !== undefined) {
                // rollback to state before the first replacement of the fix was applied
                output = output.substring(0, replacement.fix.state.length);
                ({position, index: i} = replacement.fix.state);
            }
            replacement.fix.skip = true;
            --fixed;
            continue;
        }
        // only save the current state if the fix contains more replacements and there isn't already a state
        if (replacement.fix.replacements.length !== 1 && replacement.fix.state === undefined)
            replacement.fix.state = {position, index: i, length: output.length};
        if (position === -1) {
            // we are about to apply the first fix
            range.span.start = replacement.start;
            output = source.substring(0, replacement.start);
        } else {
            output += source.substring(position, replacement.start);
        }
        output += replacement.text;
        position = replacement.end;
    }
    output += source.substring(position);

    range.span.length = position - range.span.start;
    range.newLength = range.span.length + output.length - source.length;
    return {
        fixed,
        range,
        result: output,
    };
}

function compareReplacements(a: Replacement, b: Replacement): number {
    return a.start - b.start || a.end - b.end;
}

/** Combine adjacent replacements to avoid sorting replacements of other fixes between them. */
function combineReplacements(replacements: Replacement[]): Replacement[] {
    if (replacements.length === 1)
        return replacements;
    replacements = replacements.slice().sort(compareReplacements);
    const result = [];
    let current = replacements[0];
    let wasInsertion = current.start === current.end;
    for (let i = 1; i < replacements.length; ++i) {
        const replacement = replacements[i];
        if (current.end > replacement.start)
            throw new Error('Replacements of fix overlap.');
        const isInsertion = replacement.start === replacement.end;
        if (isInsertion && wasInsertion)
            throw new Error('Multiple insertion replacements at the same position.');
        wasInsertion = isInsertion;
        if (current.end === replacement.start) {
            current = {
                start: current.start,
                end: replacement.end,
                text: current.text + replacement.text,
            };
        } else {
            result.push(current);
            current = replacement;
        }
    }
    result.push(current);
    return result;
}
