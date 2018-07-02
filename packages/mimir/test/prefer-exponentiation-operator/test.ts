Math.pow(1, 2);
Math.pow((1), (2));
1 + Math.pow(1, 2);

2 ** Math.pow(3, 2);
Math.pow(2, 3) ** 2;
Math.pow(2, Math.pow(3, 2)); // TODO add parens

Math.pow({prop: 1}.prop, 2);

Math.pow(1 + 1,2 + 2);
<number>Math.pow(1, 2);
Math.pow(1, 2) as number;
Math.pow(<number>1, 2 as number);
Math.pow(1, Boolean() ? 1 : 2);
!Math.pow(1, 2);
Math.pow(1, 2).toString();
<number>Math.pow(1, 2);

-Math.pow(1 + 1, 2 + 2);

Math.pow(-1, 2); // TODO TS bug

declare var args: [number, number];
Math.pow(...args);
Math.pow(1);
Math.pow(1, ...[2]);

async function* fn() {
    Math.pow(await 1, await 2); // TODO TS bug
    await Math.pow(1, 2);
    await Math.pow(await 1, await 2); // TODO TS bug
    Math.pow(yield, yield); // TODO TS bug
    Math.pow(yield 1, yield 1); // TODO TS bug
    yield Math.pow(1, 2);
}

declare namespace foo {
    function pow(a: number, b: number): number;
}

foo.pow(1, 2);
