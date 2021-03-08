export declare namespace OptionParser {
    type MismatchCallback = (type: string) => void;
    type ParseFunction<T> = (value: any, report: MismatchCallback) => T;
    type ParsedOptions<T extends Record<string, ParseFunction<any>>> = {
        [K in keyof T]: ReturnType<T[K]>;
    };
    interface ParseConfig {
        validate?: boolean;
        context: string;
        exhaustive?: boolean;
    }
    function parse<T extends Record<string, ParseFunction<any>>>(options: Record<string, any> | undefined, specs: T, config: ParseConfig): ParsedOptions<T>;
    namespace Transform {
        function withDefault<T>(parseFn: ParseFunction<T | undefined>, defaultValue: T): ParseFunction<T>;
        function noDefault<T>(parseFn: ParseFunction<T>): ParseFunction<T | undefined>;
        function map<T extends ReadonlyArray<U> | undefined, U, V>(parseFn: ParseFunction<T>, cb: (item: U) => V): ParseFunction<{
            -readonly [K in keyof T]: V;
        }>;
        function transform<T, U>(parseFn: ParseFunction<T>, cb: (value: T) => U): ParseFunction<U>;
    }
    namespace Factory {
        type PrimitiveName = 'string' | 'number' | 'boolean';
        type PrimitiveMap<T extends PrimitiveName> = T extends 'string' ? string : T extends 'number' ? number : boolean;
        export function parsePrimitive<T extends PrimitiveName[]>(...types: T): ParseFunction<PrimitiveMap<T[number]> | undefined>;
        export function parsePrimitiveOrArray<T extends PrimitiveName>(type: T): ParseFunction<ReadonlyArray<PrimitiveMap<T>> | undefined>;
        export {};
    }
}
