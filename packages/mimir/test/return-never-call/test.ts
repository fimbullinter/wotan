export {};

declare function get<T>(): T;
declare let n: never;

n;

get<string>();
get<number>();
get<never>();

function test<T extends never>(param: T) {
    get<T>();
    get<typeof param>();
    return param;
}

test(get<never>());

function inferredByTs(fn: () => never) {
    fn();
    return fn();
}

function returned() {
    get<never>();
    return get<never>();
}

function thrown() {
    get<never>();
    throw get<never>();
}

function last() {
    console.log('foo');
    if (Boolean())
        get<never>();
    get<never>();
}

if (Boolean()) {
    get<never>();
} else {
    get<never>();
}

declare let obj: { neverReturns(): never; }

obj.neverReturns;
obj.neverReturns();

let otherObj = obj;
otherObj.neverReturns();
otherObj?.neverReturns();

namespace ns {
    get<never>();
    function fn() {
        get<never>();
    }
}

function inTry() {
    try {
        get<never>();
    } catch {
        get<never>();
    } finally {
        get<never>();
    }
}
