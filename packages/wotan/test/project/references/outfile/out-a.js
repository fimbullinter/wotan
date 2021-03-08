var foo;
(function (foo) {
    foo.a = "a";
})(foo || (foo = {}));
