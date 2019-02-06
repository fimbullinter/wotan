import { ConfigurableRule } from '@fimbul/ymir';
export interface Options {
    allowNew: boolean;
    allowShortCircuit: boolean;
    allowTaggedTemplate: boolean;
    allowTernary: boolean;
}
export declare class Rule extends ConfigurableRule<Options> {
    parseOptions(input: Partial<Options> | {} | null | undefined): Options;
    apply(): void;
}
