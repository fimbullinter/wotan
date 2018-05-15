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
        return Object.assign({}, param);
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
        return Object.assign({}, param);
    }
    spreadEmptyInterfaceType(param: Empty) {
        return Object.assign({}, param);
    }
    spreadAny(param: any) {
        return Object.assign({}, param);
    }
    dontSpreadThis() {
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

Object.assign({})! as {} + '';
Object.assign({method() {return [0];}}).method()[0]++ === 1 ? 'foo' : 'bar';
(Object.assign({})).toString();

console.log(Object.assign({}));
obj.toString(), Object.assign({});
