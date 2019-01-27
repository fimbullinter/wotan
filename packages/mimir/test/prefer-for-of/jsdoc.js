/**
 * @param {any[]} params
 * @return {IteratorResult<any>}
 */
function next(...params) {
    return {
        value: 1,
        done: false,
    };
}

const key = Math.random();
/** @type {any} */
const value = null;

exports.jsIterable = {
    [key]: value,
    length: key + 1,
    /**
     * @param {number} defaultParam
     * @param {boolean} [optional]
     */
    [Symbol.iterator](defaultParam = 1, optional) {
        return {
            next,
        }
    }
}

exports.jsNotIterable = {
    [key]: value,
    length: key + 1,
    /**
     * @param {boolean} param
     */
    [Symbol.iterator](param) {
        return {
            next,
        }
    }
}
