import { AbstractRule } from '@fimbul/ymir';
export declare class Rule extends AbstractRule {
    apply(): void;
    private checkObjectDestructuring;
    private checkBindingPattern;
    private checkFunctionParameters;
    private fail;
    private removeUndefinedFromType;
}
