interface Empty {}
class Foo {
    dontSpreadTypeParam<T extends object>(param: T, param2: T | undefined) {
        Object.assign({}, param);
        Object.assign({}, param2);
    }
    dontSpreadNonObject(param: number | boolean) {
        return Object.assign({}, param);
    }
    spreadObjectFalsyUnion(param: object | undefined | '' | 0 | false | null | void) {
        return {...param};
    }
    dontSpreadObjectTruthyUnion(param: object | true, param2: object | 1, param3: object | "foo") {
        Object.assign({}, param);
        Object.assign({}, param2);
        Object.assign({}, param3);
    }
    dontSpreadAllFalsyUnion(param: undefined | '' | null | 0 | false | void) {
        return Object.assign({}, param);
    }
    spreadEmptyObject(param: {}) {
        return {...param};
    }
    spreadEmptyInterfaceType(param: Empty) {
        return {...param};
    }
    spreadAny(param: any) {
        return {...param};
    }
    dontSpreadThis() {
        return Object.assign({}, this);
    }
}

declare let assign: any;
assign({}, {});
assign.assign({}, {});
assign.Object({}, {});
({...Object.assign});

Object.assign;
Object.assign();
({});

// Object.assign
({});
// Object.assign
obj;
({});
({});
({});
({});

(() => ({}));
(() => ({}));

let obj = {};
obj = {prop: 1, ...obj};
obj = Object.assign(obj, {prop: 1});
obj = Object.assign({}, ...[obj, obj]);
obj = {prop: 1,prop: 2,...obj,}
obj = {};

obj = {...Boolean() && {prop: 1}, ...Boolean() ? {prop2: 1} : {prop3: 1}};
