declare let foo: number;
declare let NaNa: number;
declare let aNaN: number;
declare let obj: {NaN: number};

foo = NaN;
foo += NaN;

foo == NaN;
foo!==NaN;
NaN != foo;
NaN===foo;

NaNa === foo;
aNaN === foo;
foo === NaNa;
foo === aNaN;

NaN === NaN;

foo === obj.NaN;

`${foo}` === "NaN";

/** this is NaN */
NaN;

isNaN(foo);

switch (foo) {
    case 1:
    case obj.NaN:
    case NaN:
    case 2:
}
