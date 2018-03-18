declare let foo: any;

switch (foo) {
    case 1:
        const bar = 1;
        var baz = 2;
        let bas = 3;
        class C {}
        enum E {}
        const enum CE {}
        (class {});
        function f() {}
        if (Boolean()) {
            class NestedC {}
            enum NestedE {}
        }
    case 2: {
        let foobar = 1;
    }
    default:
        class Other {}
}
