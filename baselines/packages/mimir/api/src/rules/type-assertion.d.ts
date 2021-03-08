import { ConfigurableRule } from '@fimbul/ymir';
export interface Options {
    style: 'classic' | 'as';
}
export declare class Rule extends ConfigurableRule<Options> {
    parseOptions(options: Partial<Options> | null | undefined): Options;
    apply(): void;
}
