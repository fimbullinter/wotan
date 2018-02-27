class Foo {
    spreadTypeParam<T extends object>(param: T) {
        return Object.assign({}, param); // requires TypeChecker
    }
    spreadNonObject(param: number | boolean) {
        return Object.assign({}, param); // requires TypeChecker
    }
    spreadObjectFalsyUnion(param: object | undefined | '' | 0 | false | null) {
        return Object.assign({}, param); // this could be spreaded
    }
    spreadObjectTruthyUnion(param: object | boolean) {
        return Object.assign({}, param); // requires TypeChecker
    }
    spreadThis() {
        return Object.assign({}, this);
    }
}

declare let assign: any;
assign({}, {});
assign.assign({}, {});
assign.Object({}, {});
Object.assign({}, Object.assign);

Object.assign;
Object.assign();
Object.assign({});

// Object.assign
Object.assign({}, {});
// Object.assign
obj;
Object.
    assign({}, {});
Object
    .assign({}, {});
Object. // eol comment
    assign({}, {});
Object./** inline comment*/ assign({}, {});

(() => Object.assign({}));
(() => Object.assign({}, {}));

let obj = Object.assign({}, {}, {});
obj = Object.assign({prop: 1}, obj);
obj = Object.assign(obj, {prop: 1});
obj = Object.assign({}, ...[obj, obj]);
obj = Object.assign({prop: 1}, {}, {}, {prop: 2}, {}, obj, {},)
obj = Object.assign({});

obj = Object.assign({}, Boolean() && {prop: 1}, Boolean() ? {prop2: 1} : {prop3: 1});
