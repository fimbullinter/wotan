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

exports.jsIterable = {
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
    /**
     * @param {boolean} param
     */
    [Symbol.iterator](param) {
        return {
            next,
        }
    }
}
