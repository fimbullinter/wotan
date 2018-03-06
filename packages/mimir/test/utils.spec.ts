import test from 'ava';
import { isStrictNullChecksEnabled, isStrictPropertyInitializationEnabled } from '../src/utils';

test('isStrictNullChecksEnabled', (t) => {
    t.true(isStrictNullChecksEnabled({strict: true}));
    t.true(isStrictNullChecksEnabled({strictNullChecks: true}));
    t.true(isStrictNullChecksEnabled({strict: false, strictNullChecks: true}));
    t.false(isStrictNullChecksEnabled({strict: false}));
    t.false(isStrictNullChecksEnabled({strict: true, strictNullChecks: false}));
    t.false(isStrictNullChecksEnabled({strict: false, strictNullChecks: false}));
});

test('isStrictPropertyInitializationEnabled', (t) => {
    t.true(isStrictPropertyInitializationEnabled({strict: true}));
    t.true(isStrictPropertyInitializationEnabled({strict: false, strictNullChecks: true, strictPropertyInitialization: true}));
    t.true(isStrictPropertyInitializationEnabled({strict: true, strictPropertyInitialization: true}));
    t.false(isStrictPropertyInitializationEnabled({strictPropertyInitialization: true}));
    t.false(isStrictPropertyInitializationEnabled({strictNullChecks: true}));
    t.false(isStrictPropertyInitializationEnabled({strict: false, strictPropertyInitialization: true}));
    t.false(isStrictPropertyInitializationEnabled({strict: false, strictNullChecks: true}));
    t.false(isStrictPropertyInitializationEnabled({strict: false}));
    t.false(isStrictPropertyInitializationEnabled({strict: true, strictPropertyInitialization: false}));
    t.false(isStrictPropertyInitializationEnabled({strict: false, strictPropertyInitialization: false}));
    t.false(isStrictPropertyInitializationEnabled({strict: true, strictNullChecks: false}));
});
