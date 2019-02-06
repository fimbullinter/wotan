import { TypedRule } from '@fimbul/ymir';
export declare class Rule extends TypedRule {
    private readonly usage;
    apply(): void;
    private checkForStatement;
    private isIterationPossible;
    private isIterationProtocolAvailable;
    private isArrayLike;
    private isDeclaredInDefaultLib;
    private isIterable;
}
