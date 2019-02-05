import { TypedRule } from '@fimbul/ymir';
export declare class Rule extends TypedRule {
    private reported;
    apply(): void;
    private visitStatement;
    private checkReturnExpression;
}
