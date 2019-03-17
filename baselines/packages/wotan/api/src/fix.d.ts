import * as ts from 'typescript';
import { Fix } from '@fimbul/ymir';
export interface FixResult {
    result: string;
    fixed: number;
    range: ts.TextChangeRange;
}
export declare function applyFixes(source: string, fixes: Fix[]): FixResult;
