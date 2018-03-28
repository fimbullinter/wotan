export {};

declare let foo: number;
declare const bar: string;

declare namespace ns {
    let foo: number;
    let bar: string;
    export {foo};
}

namespace ns {
    declare namespace sub {
        var something: boolean;
        namespace sub.sub {
            var something: boolean;
        }
        namespace sub {
            namespace sub2 {
                var something: boolean;
            }
        }
    }
    namespace sub.sub {
        var something: boolean;
    }
    namespace sub2 {
        var something: boolean;
        namespace sub2 {
            var something: boolean;
        }
    }
    var something: boolean;
    export var exported: boolean;
}

declare global {
    let globalVar: string;
}

let exported: boolean;
export {exported};

let {destructured} = {} as any, regularVariable: number, initialized = 0;

regularVariable === 0;

var initializedLater: typeof regularVariable;
{
    initializedLater = 1;
}

function fn(param, {d}) {
    let fnLocal: string;
    return fnLocal;
}

var merged: any;
var merged: any = 1;
namespace merged {}
interface merged {}

type T = typeof merged;
