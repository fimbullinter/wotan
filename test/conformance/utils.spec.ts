import test from 'ava';
import { calculateChangeRange, memoizeGetter } from '../../src/utils';

test('calculateChangeRange', (t) => {
    assertRange('', 'a', 0, 0, 1);
    assertRange('a', '', 0, 1, 0);
    assertRange('aabbcc', 'aaabbbccc', 2, 2, 5);
    assertRange('aaabbbccc', 'aabbcc', 2, 5, 2);
    assertRange('aabbcc', 'aaabbbcdc', 2, 3, 6);
    assertRange('abc', 'axbc', 1, 0, 1);
    assertRange('abc', 'ac', 1, 1, 0);
    assertRange('abc', 'c', 0, 2, 0);
    assertRange('abc', 'abcd', 3, 0, 1);
    assertRange('abc', 'axc', 1, 1, 1);
    assertRange('abc', 'xyz', 0, 3, 3);
    assertRange('abababab', 'abababab', 8, 0, 0);
    assertRange('abababab', 'ababab', 6, 2, 0);
    assertRange('ababab', 'abababab', 6, 0, 2);
    assertRange('abababab', 'ababcabab', 4, 0, 1);

    function assertRange(original: string, changed: string, start: number, length: number, newLength: number) {
        t.is(newLength, length + changed.length - original.length);
        t.deepEqual(
            calculateChangeRange(original, changed),
            {
                newLength,
                span: {
                    start,
                    length,
                },
            },
        );
        t.deepEqual(
            calculateChangeRange(changed, original), {
                span: {
                    start,
                    length: newLength,
                },
                newLength: length,
            },
        );
    }
});

test('memoizeGetter', (t) => {
    class HasGetter {
        constructor (private _foo: string, private _bar: string) {} // tslint:disable-line:naming-convention
        private fooCalled = false;
        @memoizeGetter
        public get foo() {
            t.false(this.fooCalled);
            this.fooCalled = true;
            return this._foo;
        }

        private barCalled = false;
        @memoizeGetter
        public get bar() {
            t.false(this.barCalled);
            this.barCalled = true;
            return this._bar;
        }
    }
    const obj = new HasGetter('foo', 'bar');
    t.is(obj.foo, 'foo');
    t.is(obj.foo, 'foo');
    t.is(obj.bar, 'bar');
    t.is(obj.bar, 'bar');

    t.is(new HasGetter('baz', 'bas').foo, 'baz');

    t.throws(
        () => {
            class Invalid {
                @memoizeGetter
                public getFoo() {
                    return 'foo';
                }
            }
            return Invalid;
        },
        '@memoizeGetter can only be used with get accessors.',
    );

    t.throws(
        () => {
            class Invalid {
                @memoizeGetter
                public set foo(_: string) {
                }
            }
            return Invalid;
        },
        '@memoizeGetter can only be used with get accessors.',
    );

    t.throws(
        () => {
            class Invalid {
                @memoizeGetter
                public setFoo(_v: string) {
                }
            }
            return Invalid;
        },
        '@memoizeGetter can only be used with get accessors.',
    );
});
