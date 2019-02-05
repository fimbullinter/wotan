declare let num: number;
declare function get<T>(): T;

"isNaN()";

Number.isNaN(1);
// isNaN
isNaN(num);
isNaN // isNaN()
    (1);
isNaN/* comment */(1);
isNaN(1 + 1);
!isNaN(get<1 | 2>());

Object.assign(isNaN /* comment */);

isNaN();
isNaN(get<any>());

Number.isFinite(1);
isFinite(1);
isFinite(get<any>());

foo.isFinite(1);

function generic<T extends number, U extends 1 | 2, V extends T | U, W>(p1: T, p2: U, p3: V, p4: W) {
    isNaN(p1);
    isNaN(p2);
    isNaN(p3);
    isNaN(p4);

    isFinite(p1);
    isFinite(p2);
    isFinite(p3);
    isFinite(p4);
}
