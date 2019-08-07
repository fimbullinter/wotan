import { ConfigurableTypedRule } from '@fimbul/ymir';
interface RawOptions {
    allowPrimitive?: boolean;
    allowNull?: boolean;
    allowUndefined?: boolean;
    allowNumber?: boolean;
    allowBoolean?: boolean;
    allowNever?: boolean;
}
interface Options {
    allowNever: boolean;
    mask: Type;
}
declare enum Type {
    String = 1,
    Number = 2,
    Boolean = 4,
    Null = 8,
    Undefined = 16,
    NonPrimitive = 32,
    Any = 64,
    Symbol = 128
}
export declare class Rule extends ConfigurableTypedRule<Options> {
    parseOptions(options: RawOptions | null | undefined): {
        allowNever: boolean;
        mask: number;
    };
    apply(): void;
}
export {};
