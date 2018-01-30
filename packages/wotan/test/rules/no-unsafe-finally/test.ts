export {};
function test(x: any) {
    let foo: {finally: boolean} = { finally: true };
    if (foo.finally) {
        return;
    }
    try {
        return;
    } catch {
        return;
    }
    try {
        return;
    } catch {
        return;
    } finally {
    }
    try {
    } catch {
        return;
    } /* finally {} */ finally {
        return;
    }
    try {
    } finally /* some comment */ {
        throw 'foo';
    }
    for (;;) {
        try {
        } finally {
            break;
        }
        try {
        } finally {
            continue;
        }
    }
    outer: for (;;) {
        try {
        } catch {
            return;
        } finally {
            function foo() {
                if (x)
                    return x;
                throw 'foo';
            }
            inner: for (;;) {
                switch (x) {
                    case 'foo':
                        break;
                    case 'bar':
                        continue;
                    case 'baz':
                        break inner;
                    case 'bas':
                        continue inner;
                    case 'foobar':
                        break outer;
                    case 'foobaz':
                        continue outer;
                    case 'foobas':
                        return;
                    default:
                        throw 'foobarbaz';
                }
            }
            try {
                if (x)
                    return;
                throw x;
            } catch {
                return;
            } finally {
                if (x)
                    // duplicate error on the next line, because it's inside two finally blocks. should be a very rare case not worth fixing
                    return;
            }
        }
    }
}
