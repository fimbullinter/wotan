import { ConfigurableRule } from '@fimbul/ymir';
export interface Options {
    mode: Mode;
}
export declare enum Mode {
    Never = 0,
    WhenPossible = 1,
    Consistent = 2
}
export declare class Rule extends ConfigurableRule<Options> {
    protected parseOptions(options: {
        mode: string;
    } | null | undefined): Options;
    apply(): void;
    private checkConstructorParameters;
}
