declare enum E {}
export declare const enum CE {}
declare type T = any;
export declare interface I {}
declare class C {}

export declare class C3 {}

enum E2 {}
const enum CE2 {}
type T2 = any;
interface I2 {}
class C2 {}

namespace ns {
    declare enum E {}
    declare const enum CE {}
    declare type T = any;
    declare interface I {}
    declare class C {}
}

namespace ns.sub {
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

module 'baz';

declare global {
    declare type T = any;
}

type declare = any;
let declare: declare;
