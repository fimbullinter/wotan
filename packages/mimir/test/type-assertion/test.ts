declare let foo: any;
declare let bar: any;
declare let baz: any;
type T = any;

<T>foo;
foo as T;

<T['prop']>foo;
foo as T['prop'];

+<T>foo;
+(foo as T);

typeof <T>foo;
typeof (foo as T);

<T>typeof foo;
typeof foo as T;

void <T>foo;
void (foo as T);

<T>void foo;
void foo as T;

<T>foo && bar;
foo as T && bar;

<T>foo & bar;
(foo as T) & bar;

foo & <T>bar;
foo & bar as T;

1 as number ** 2;
(<number>1) ** 2;

1 ** 2 + 1 as number;
<number>(1 ** 2 + 1);

foo & <T>bar | baz;
foo & (bar as T) | baz;

<T>+foo & bar;
(+foo as T) & bar;

() => <T>{foo}.foo;
() => ({foo}.foo) as T;

() => <T>{foo}.foo & bar;
() => ({foo}.foo as T) & bar;

<T>() => foo;

async function* test() {
    <T> await foo;
    await foo as T;

    await <T>foo;
    await (foo as T);

    <T>(yield foo);
    (yield foo) as T;

    yield <T>foo;
    yield foo as T;
}

/**<T>foo*/<T>foo;
foo /*as*/ as 'as';
