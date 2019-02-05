import { AbstractRule } from '@fimbul/ymir';
export declare class Rule extends AbstractRule {
    private strictFile;
    apply(): void;
    private checkUseStrictDirective;
    private isInStrictContext;
    private hasUseStrictDirective;
}
