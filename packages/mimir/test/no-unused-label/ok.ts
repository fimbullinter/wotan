foo: for (;;) {
    let foo;
    bar: switch (foo) {
        case bar:
            break bar;
        default: continue foo;
    }

    bar: {
        break bar;
    }

    bar: if (Boolean()) baz: {
        break baz;
    } else
        break bar;

    bar: break bar;
}
