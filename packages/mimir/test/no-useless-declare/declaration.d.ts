declare enum E {}
export declare const enum CE {}
declare type T = any;
export declare interface I {}
declare class C {}

type T2 = any;
interface I2 {}

declare namespace ns.sub {
    declare enum E {}
    declare const enum CE {}
    declare type T = any;
    declare interface I {}
    declare class C {}
}

declare namespace ambient {
    declare type T = any;
    interface I {}
}

declare module 'foo' {
    declare type T = any;
}

declare module 'bar';

declare module 'baz';

declare global {
    declare type T = any;
}
