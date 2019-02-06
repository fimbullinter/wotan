import { ConfigurableRule } from '@fimbul/ymir';
import * as ts from 'typescript';
export interface Options {
    style: 'classic' | 'as';
}
export declare class Rule extends ConfigurableRule<Options> {
    static supports(sourceFile: ts.SourceFile): boolean;
    parseOptions(options: Partial<Options> | null | undefined): Options;
    apply(): void;
}
