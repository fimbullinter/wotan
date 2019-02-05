import { TypedRule } from '@fimbul/ymir';
export declare class Rule extends TypedRule {
    apply(): void;
    private checkCallExpression;
    private checkNewExpression;
    private checkInferredTypeParameters;
    private handleEmptyTypeParameter;
}
