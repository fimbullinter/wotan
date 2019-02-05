declare let foo: number;
declare let NaNa: number;
declare let aNaN: number;
declare let obj: {NaN: number, Number: any};

foo = NaN;
foo += NaN;

foo == NaN;
foo!==NaN;
NaN != foo;
NaN===foo;

Number.NaN == foo;
foo != Number.NaN;

NaNa === foo;
aNaN === foo;
foo === NaNa;
foo === aNaN;

NaN === NaN;

foo === obj.NaN;

`${foo}` === "NaN";

/** this is NaN */
NaN;
Number.NaN;

isNaN(foo);

switch (foo) {
    case 1:
    case obj.NaN:
    case obj.Number.NaN:
    case NaN:
    case Number.NaN:
    case NaN.valueOf():
    case 2:
}
