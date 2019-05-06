class Base {
    get prop() { return 1; }
    get prop2() { return 1; }
    get prop3() { return 1; }
    get prop4() { return 1; }
}
const prop4 = 'prop4';
class Derived extends Base {
    prop = 1;
    'prop2' = 1;
    'prop3' = 1;
    [prop4] = 1;
}
