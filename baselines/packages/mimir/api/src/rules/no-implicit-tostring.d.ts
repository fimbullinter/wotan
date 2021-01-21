import { ConfigurableTypedRule } from '@fimbul/ymir';
interface RawOptions {
    allowPrimitive?: boolean;
    allowNull?: boolean;
    allowUndefined?: boolean;
    allowNumber?: boolean;
    allowBigInt?: boolean;
    allowBoolean?: boolean;
}
declare enum Type {
    String = 1,
    Number = 2,
    BigInt = 4,
    Boolean = 8,
    Null = 16,
    Undefined = 32,
    NonPrimitive = 64,
    Any = 128,
    Symbol = 256,
    Unknown = 512,
    Void = 1024
}
export declare class Rule extends ConfigurableTypedRule<Type> {
    parseOptions(options: RawOptions | null | undefined): number;
    apply(): void;
}
export {};
