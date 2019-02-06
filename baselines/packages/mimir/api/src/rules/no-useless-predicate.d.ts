import { TypedRule } from '@fimbul/ymir';
export declare class Rule extends TypedRule {
    private strictNullChecks;
    apply(): void;
    private checkSwitch;
    private checkCondition;
    private checkNode;
    private maybeFail;
    private isTruthyFalsy;
    private isConstantComparison;
    private checkEquals;
    private getPrimitiveLiteral;
    private nullAwarePredicate;
    private executePredicate;
    private matchIntersectionType;
    private getTypeOfExpression;
    private isPropertyPresent;
}
