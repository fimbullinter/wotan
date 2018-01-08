import 'reflect-metadata';
import test from 'ava';
import { isCodeLine, createBaselineDiff } from '../../src/test';
import chalk, { Level } from 'chalk';

test.before(() => {
    chalk.enabled = true;
    chalk.level = Level.Basic;
});

test('isCodeLine', (t) => {
    t.true(isCodeLine(''));
    t.true(isCodeLine('a'));
    t.true(isCodeLine('~[]'));
    t.true(isCodeLine('~~nil'));
    t.true(isCodeLine('~nil '));
    t.true(isCodeLine('a = b'));
    t.true(isCodeLine('[error]'));
    t.true(isCodeLine('~ [foo'));
    t.true(isCodeLine('~~ '));
    t.false(isCodeLine('~nil'));
    t.false(isCodeLine(' ~nil'));
    t.false(isCodeLine('~~~~~~~~~~~'));
    t.false(isCodeLine('~~~~~~~~~~~ [a]'));
    t.false(isCodeLine(' ~nil     [error]'));
});

test('createBaselineDiff', (t) => {
    diff(
        '\uFEFFtest',
        'test',
        'BOM',
    );

    diff(
        'foo = bar;',
        'foo = bar;',
        'equal',
    );

    diff(
        'a\nc\n',
        'a\nb\nc\n',
        'missing code line',
    );

    diff(
        'a\r\n~ [error]\n',
        'a\n~ [erreur]\n',
        'CR',
    );

    diff(
        'a\n~nil\n',
        'a\n',
        'additional error line',
    );

    diff(
        '    ',
        '\t\t\t\t',
        'tabs vs spaces',
    );

    function diff(a: string, b: string, name: string) {
        t.snapshot(createBaselineDiff(a, b), <any>{id: `createBaselineDiff ${name}`});
    }
});
