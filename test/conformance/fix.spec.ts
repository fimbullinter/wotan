import 'reflect-metadata';
import { test } from 'ava';
import { applyFixes } from '../../src/fix';
import { Replacement } from '../../src/types';

test('Fixer', (t) => {
    t.deepEqual(
        applyFixes('abc', [
            {replacements: [Replacement.delete(0, 1)]},
            {replacements: [Replacement.delete(1, 2)]},
        ]),
        {
            result: 'bc',
            fixed: 1,
            range: {
                span: {
                    start: 0,
                    length: 1,
                },
                newLength: 0,
            },
        },
        'discards adjacent fixes',
    );

    t.deepEqual(
        applyFixes('abc', [
            {replacements: [Replacement.delete(0, 1)]},
            {replacements: [Replacement.delete(2, 3)]},
        ]),
        {
            result: 'b',
            fixed: 2,
            range: {
                span: {
                    start: 0,
                    length: 3,
                },
                newLength: 1,
            },
        },
        'applies multiple non-overlapping fixes',
    );

    t.deepEqual(
        applyFixes('abc', [
            {replacements: [Replacement.delete(0, 1), Replacement.delete(1, 2), Replacement.append(1, 'd')]},
        ]),
        {
            result: 'dc',
            fixed: 1,
            range: {
                span: {
                    start: 0,
                    length: 2,
                },
                newLength: 1,
            },
        },
        'merges replacements of a fix',
    );

    t.deepEqual(
        applyFixes('abc', [
            {replacements: [Replacement.delete(0, 1), Replacement.deleteAt(2, 1), Replacement.append(2, 'd')]},
        ]),
        {
            result: 'bd',
            fixed: 1,
            range: {
                span: {
                    start: 0,
                    length: 3,
                },
                newLength: 2,
            },
        },
        'merges replacements of a fix',
    );

    t.throws(
        () => applyFixes('', [{replacements: [Replacement.append(0, 'a'), Replacement.append(0, 'b')]}]),
        'Multiple insertion replacements at the same position.',
    );
    t.throws(
        () => applyFixes('', [{replacements: [Replacement.deleteAt(1, 3), Replacement.replaceAt(1, 3, 'b')]}]),
        'Replacements of fix overlap.',
    );
    t.throws(
        () => applyFixes('', [{replacements: [Replacement.delete(1, 4), Replacement.replaceAt(2, 3, 'b')]}]),
        'Replacements of fix overlap.',
    );
    t.throws(
        () => applyFixes('', [{replacements: [Replacement.delete(1, 4), Replacement.append(2, 'a')]}]),
        'Replacements of fix overlap.',
    );

    t.deepEqual(
        applyFixes('abcdefghij', [
            {replacements: [Replacement.delete(0, 1), Replacement.delete(4, 5)]},
            // this one will be discarded because of conflict with the following
            {replacements: [Replacement.delete(2, 3), Replacement.delete(7, 8)]},
            {replacements: [Replacement.delete(6, 7)]},
        ]),
        {
            result: 'bcdfhij',
            fixed: 2,
            range: {
                span: {
                    start: 0,
                    length: 7,
                },
                newLength: 4,
            },
        },
        'rolls back all replacements of conflicting fixes',
    );

    t.deepEqual(
        applyFixes('abcdefghij', [
            // the first replacement is applied, rollback happens at the second replacement
            {replacements: [Replacement.delete(0, 1), Replacement.delete(3, 4)]},
            // the first replacement is applied, rollback happens at the second replacement, after the first fix is rolled back
            {replacements: [Replacement.delete(2, 3), Replacement.delete(7, 8)]},
            {replacements: [Replacement.delete(6, 7)]},
        ]),
        {
            result: 'abcdefhij',
            fixed: 1,
            range: {
                span: {
                    start: 6,
                    length: 1,
                },
                newLength: 0,
            },
        },
        'rolls back all replacements of conflicting fixes',
    );
});
