import { ConfigurableRule } from '@fimbul/ymir';
export interface Options {
    destructuring: 'all' | 'any';
}
export declare class Rule extends ConfigurableRule<Options> {
    protected parseOptions(options: {
        destructuring?: string;
    } | null | undefined): Options;
    apply(): void;
}
