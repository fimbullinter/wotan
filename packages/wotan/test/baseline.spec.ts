import 'reflect-metadata';
import test from 'ava';
import { isCodeLine, createBaseline } from '../src/baseline';
import chalk, { Level } from 'chalk';
import { Failure, FileSummary } from '@fimbul/ymir';

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

test('createBaseline', (t) => {
    const content = `export {};
let foo = 'foo';
let bar = foo;
`;
    apply('valid', []);
    apply('multiline', [{
        ruleName: 'multiline',
        message: 'I am groot',
        severity: 'error',
        start: {
            position: 0,
            line: 0,
            character: 0,
        },
        end: {
            position: content.length,
            line: 3,
            character: 0,
        },
        fix: undefined,
    }]);
    apply('zero length', [{
        ruleName: 'rule',
        message: 'where is my squiggly tail',
        severity: 'warning',
        start: {
            position: 1,
            line: 0,
            character: 1,
        },
        end: {
            position: 1,
            line: 0,
            character: 1,
        },
        fix: undefined,
    }]);
    const mixed: Failure[] = [
        {
            ruleName: 'multiline',
            message: 'I am groot',
            severity: 'error',
            start: {
                position: 0,
                line: 0,
                character: 0,
            },
            end: {
                position: content.length,
                line: 3,
                character: 0,
            },
            fix: undefined,
        },
        {
            ruleName: 'rule',
            message: 'where is my squiggly tail',
            severity: 'warning',
            start: {
                position: 1,
                line: 0,
                character: 1,
            },
            end: {
                position: 1,
                line: 0,
                character: 1,
            },
            fix: undefined,
        },
        {
            ruleName: 'rule',
            message: 'where is my squiggly tail',
            severity: 'error',
            start: {
                position: 1,
                line: 0,
                character: 1,
            },
            end: {
                position: 1,
                line: 0,
                character: 1,
            },
            fix: undefined,
        },
        {
            ruleName: 'other',
            message: 'two lines',
            severity: 'warning',
            start: {
                position: 1,
                line: 0,
                character: 1,
            },
            end: {
                position: content.indexOf('foo'),
                line: 1,
                character: 4,
            },
            fix: undefined,
        },
        {
            ruleName: 'another',
            message: 'other two lines',
            severity: 'error',
            start: {
                position: content.indexOf('let'),
                line: 1,
                character: 0,
            },
            end: {
                position: content.indexOf('bar'),
                line: 2,
                character: 4,
            },
            fix: undefined,
        },
    ];
    apply('mixed', mixed);

    verify('no eofline', {
        content: 'let foo;',
        failures: [{
            ruleName: 'rule',
            message: 'where is my squiggly tail',
            severity: 'warning',
            start: {
                position: 1,
                line: 0,
                character: 1,
            },
            end: {
                position: 1,
                line: 0,
                character: 1,
            },
            fix: undefined,
        }],
        fixes: 0,
    });

    verify('CRLF', {
        content: 'foo;\r\nbar;\r\n',
        failures: [{
            ruleName: 'rule',
            message: 'some message',
            severity: 'error',
            start: {
                position: 0,
                line: 0,
                character: 0,
            },
            end: {
                position: 6,
                line: 1,
                character: 0,
            },
            fix: undefined,
        }],
        fixes: 0,
    });

    function apply(name: string, failures: Failure[]) {
        verify(name, {content, failures, fixes: 0});
    }

    function verify(name: string, summary: FileSummary) {
        t.snapshot(createBaseline(summary), {id: `createBaseline ${name}`});
    }
});
