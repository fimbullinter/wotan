declare let num: number;
declare function get<T>(): T;

"isNaN";

Number.isNaN(1);
// isNaN
Number.isNaN(num);
Number.isNaN(1);
Number.isNaN(1 + 1);
!Number.isNaN(get<1 | 2>());

Object.assign(isNaN);

isNaN();
isNaN(get<any>());

function generic<T extends number, U extends 1 | 2, V extends T | U, W>(p1: T, p2: U, p3: V, p4: W) {
    Number.isNaN(p1);
    Number.isNaN(p2);
    Number.isNaN(p3);
    isNaN(p4);
}
