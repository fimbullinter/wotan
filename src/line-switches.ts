import * as ts from 'typescript';

export const LINE_SWITCH_REGEX = /\s*wotan:(enable|disable)((?:-next)-line)?(?:\s*$|:)/g;

export function getDisabledRanges(_ruleNames: string[]): Map<string, ts.TextRange[]> {
    const result = new Map<string, ts.TextRange[]>();

    return result; // tslint:disable-line
}
