import { TypedRule } from '@fimbul/ymir';
export declare class Rule extends TypedRule {
    private strictNullChecks;
    apply(): void;
    private checkDefiniteAssignmentAssertion;
    private checkDefiniteAssignmentAssertionProperty;
    private checkNonNullAssertion;
    private checkTypeAssertion;
    private reportUselessTypeAssertion;
    private getSafeContextualType;
}
