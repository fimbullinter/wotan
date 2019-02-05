import { TypedRule } from '@fimbul/ymir';
export declare class Rule extends TypedRule {
    apply(): void;
    private checkObject;
    private getPropertyInfo;
    private getPropertyInfoFromSpread;
}
