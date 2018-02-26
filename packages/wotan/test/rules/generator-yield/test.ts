(function() {
    function *foo() {
        if (Boolean()) {
            yield;
        }
        (function *() {})
    }
    function *bar() {
        (function *() {})
        yield;
    }
    function *baz() {
        (function *() {
            yield;
        })
    }
    function *bas() {
        yield function *() {};
    }
});

const key = 'foo';
class Foo {
    method() {}
    public *generator() {}
    private generatorProp = function *() {};
}
{
    let obj = {
        *[key]() {},
        *'name'() {},
        *"method'name"() {},
    };
}
