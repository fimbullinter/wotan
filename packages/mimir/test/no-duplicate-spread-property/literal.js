export const emptyLiteral = {};
emptyLiteral.a = 1;
Object.defineProperty(emptyLiteral, 'b', {value: 1});

export const literal = {a: 1, b: 1};

({
    ...emptyLiteral,
    a: 1,
    b: 1,
});

({
    a: 1,
    b: 1,
    c: 1,
    ...emptyLiteral,
});

({
    ...literal,
    a: 1,
    b: 1,
});

({
    a: 1,
    b: 1,
    c: 1,
    ...literal,
});

