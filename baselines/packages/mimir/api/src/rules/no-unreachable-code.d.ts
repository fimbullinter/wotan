import { AbstractRule } from '@fimbul/ymir';
export declare class Rule extends AbstractRule {
    apply(): void;
    private checkBlock;
    private checkIfStatement;
    private checkConstantIterationCondition;
    private report;
}
