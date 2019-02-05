import { TypedRule } from '@fimbul/ymir';
export declare class Rule extends TypedRule {
    apply(): void;
    private checkElementAccess;
    private checkSymbol;
    private getEnclosingClassFromThisParameter;
    private failVisibility;
    private findEnclosingClass;
    private printClass;
    private getDeclaredType;
}
