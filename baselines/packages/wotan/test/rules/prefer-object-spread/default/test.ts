class Foo {
    spreadTypeParam<T extends object>(param: T) {
        return {...param}; // requires TypeChecker
    }
    spreadNonObject(param: number | boolean) {
        return {...param}; // requires TypeChecker
    }
    spreadObjectFalsyUnion(param: object | undefined | '' | 0 | false | null) {
        return {...param}; // this could be spreaded
    }
    spreadObjectTruthyUnion(param: object | boolean) {
        return {...param}; // requires TypeChecker
    }
    spreadThis() {
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
