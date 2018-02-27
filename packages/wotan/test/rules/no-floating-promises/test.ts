// adapted from https://github.com/Microsoft/TypeScript/pull/15195

async function isAsync() {
    return 10;
}

function notAsync() {
    return 10;
}

declare function returnsPromise(): Promise<number>;
declare function returnsThenable(): {then(cb: (onfulfilled: (v: number) => void) => void): void};

class Foo {
    async isAsync() {
        return 10;
    }
    notAsync() {
        return 10;
    }
}

async function test() {
    isAsync();
    notAsync();
    returnsPromise();
    returnsThenable();
    let foo = new Foo();
    foo.isAsync();
    foo.notAsync();

    await isAsync();
    await notAsync();
    await returnsPromise();
    await returnsThenable();
    await foo.isAsync();
    await foo.notAsync();

    let v = isAsync();
    v = returnsPromise();
    v;

    function nested () {
        isAsync();
        notAsync();
    }
}

isAsync();
notAsync();
returnsPromise();
returnsThenable();
let foo = new Foo();
foo.isAsync();
foo.notAsync();
