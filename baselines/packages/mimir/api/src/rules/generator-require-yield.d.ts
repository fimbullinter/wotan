import { AbstractRule } from '@fimbul/ymir';
export declare class Rule extends AbstractRule {
    private containsYield;
    apply(): void;
    private iterate;
    private visitNode;
    private shouldFail;
    private fail;
}
