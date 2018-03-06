/** Some comment */
export function nonGenericJs() {}

/**
 * @template T lorem ipsum
 * @param {T} [p1]
 * @return {T}
 */
export function fn(p1){
    return p1;
}

/**
 * @template T
 * @param {Array<T>} [p1]
 * @return {T}
 */
export function arrayFn(p1){
    return p1[0];
}

/** @function */
/**
 * @template T, U, V
 *
 * @param {T} [a]
 * @param {U} [b]
 * @param {V} [c]
 */
export function multiParam(a, b, c) {}

/** @template T */
/**
 * @template U, V
 *
 * @param {T} [a]
 * @param {U} [b]
 * @param {V} [c]
 */
export function weirdMultiParam(a, b, c) {}

fn();
fn(1);
fn({});
arrayFn();
arrayFn([]);
arrayFn([1]);
arrayFn([{}]);
multiParam();

/**
 * @template T
 * @param {T} [param]
 * @class
 */
export function JsClass(param) {
    this.value = param;
}
JsClass.prototype.doStuff = function() {
    return this.value;
}
