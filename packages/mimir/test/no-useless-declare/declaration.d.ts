declare enum E {}
export declare const enum CE {}
declare type T = any;
declare interface I {}
export declare interface I2 {}
declare class C {}
export declare class C2 {}

type T2 = any;
interface I3 {}

declare var v: any;
export declare var v2: any;
export var v3: any;

export namespace namespace {}

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
