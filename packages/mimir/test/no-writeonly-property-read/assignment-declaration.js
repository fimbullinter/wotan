const obj = {};
Object.defineProperty(obj, 'foo', {value: 1});
Object.defineProperty(obj, 'bar', {get: () => 1});
Object.defineProperty(obj, 'baz', {set: (/** @type {number} */ v) => {}});
obj.foo + obj.bar + obj.baz;
