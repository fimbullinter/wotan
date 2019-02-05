import { TypedRule } from '@fimbul/ymir';
export declare class Rule extends TypedRule {
    apply(): void;
    private checkObjectDestructuring;
    private checkSignature;
    private checkObjectBindingPattern;
    private checkElementAccess;
    private checkSymbol;
    private checkStability;
}
