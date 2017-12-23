declare module 'is-negated-glob' {
    function isNegated(pattern: string): isNegated.Result;
    namespace isNegated {
        export interface Result {
            negated: boolean;
            original: string;
            pattern: string;
        }
    }
    export = isNegated;
}
