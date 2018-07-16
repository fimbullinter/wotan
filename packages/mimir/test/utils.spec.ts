import test from 'ava';
import { isStrictFlagEnabled } from '../src/utils';

test('isStrictNullChecksEnabled', (t) => {
    t.true(isStrictFlagEnabled({strict: true}, 'strictNullChecks'));
    t.true(isStrictFlagEnabled({strictNullChecks: true}, 'strictNullChecks'));
    t.true(isStrictFlagEnabled({strict: false, strictNullChecks: true}, 'strictNullChecks'));
    t.false(isStrictFlagEnabled({strict: false}, 'strictNullChecks'));
    t.false(isStrictFlagEnabled({strict: true, strictNullChecks: false}, 'strictNullChecks'));
    t.false(isStrictFlagEnabled({strict: false, strictNullChecks: false}, 'strictNullChecks'));
});

test('isStrictPropertyInitializationEnabled', (t) => {
    t.true(isStrictFlagEnabled({strict: true}, 'strictPropertyInitialization'));
    t.true(
        isStrictFlagEnabled({strict: false, strictNullChecks: true, strictPropertyInitialization: true}, 'strictPropertyInitialization'),
    );
    t.true(isStrictFlagEnabled({strict: true, strictPropertyInitialization: true}, 'strictPropertyInitialization'));
    t.false(isStrictFlagEnabled({strictPropertyInitialization: true}, 'strictPropertyInitialization'));
    t.false(isStrictFlagEnabled({strictNullChecks: true}, 'strictPropertyInitialization'));
    t.false(isStrictFlagEnabled({strict: false, strictPropertyInitialization: true}, 'strictPropertyInitialization'));
    t.false(isStrictFlagEnabled({strict: false, strictNullChecks: true}, 'strictPropertyInitialization'));
    t.false(isStrictFlagEnabled({strict: false}, 'strictPropertyInitialization'));
    t.false(isStrictFlagEnabled({strict: true, strictPropertyInitialization: false}, 'strictPropertyInitialization'));
    t.false(isStrictFlagEnabled({strict: false, strictPropertyInitialization: false}, 'strictPropertyInitialization'));
    t.false(isStrictFlagEnabled({strict: true, strictNullChecks: false}, 'strictPropertyInitialization'));
});
