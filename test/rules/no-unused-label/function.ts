bar: foo: for (;;) {
    let fn = function foo() {
        while (true)
            break foo;
    }
    continue bar;
}
