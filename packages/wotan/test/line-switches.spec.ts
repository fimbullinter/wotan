import 'reflect-metadata';
import test from 'ava';
import * as ts from 'typescript';
import { convertAst } from 'tsutils';
import { LineSwitchFilterFactory, DefaultLineSwitchParser } from '../src/services/default/line-switches';
import { Failure } from '@fimbul/ymir';

test('getDisabledRanges', (t) => {
    const source = `#! shebang
// wotan-disable
"/* wotan-enable */" /*wotan-enable*/;
let foo /* wotan-disable-line */ = true;
//wotan-disable-line foobaz`;
    const sourceFile = ts.createSourceFile('/foo.ts', source, ts.ScriptTarget.ESNext);
    const {wrapped} = convertAst(sourceFile);

    const lineSwitchService = new LineSwitchFilterFactory(new DefaultLineSwitchParser());
    const expected = new Map([['foobar', [
        {
            pos: 11,
            end: 49,
        },
        {
            pos: 67,
            end: 108,
        },
    ]]]);
    t.deepEqual(
        lineSwitchService.getDisabledRanges({sourceFile, ruleNames: ['foobar'], getWrappedAst: () => wrapped}),
        expected,
        'without WrappedAst',
    );

    const filter = lineSwitchService.create({sourceFile, ruleNames: ['foobar'], getWrappedAst: () => wrapped});
    t.true(filter.filter(createFailure('foobaz', 0, 100)));
    t.false(filter.filter(createFailure('foobar', 0, 100)));
    t.true(filter.filter(createFailure('foobar', 0, 11)));
    t.false(filter.filter(createFailure('foobar', 0, 12)));
    t.false(filter.filter(createFailure('foobar', 48, 50)));
    t.true(filter.filter(createFailure('foobar', 49, 50)));

    t.deepEqual(
        new LineSwitchFilterFactory({
            parse(context) {
                t.is(context.getCommentAtPosition(-1), undefined); // should not throw here
                return new Map([
                    ['foo', [{enable: true, position: 0}]], // is discarded, because unnecessary
                    ['bar', []], // is ignored
                    ['baz', [{enable: true, position: 10}, {enable: false, position: 5}]], // is correctly sorted
                ]);
            },
        }).getDisabledRanges({sourceFile, ruleNames: ['foo', 'baz'], getWrappedAst: () => wrapped}),
        new Map([['baz', [{pos: 5, end: 10}]]]),
    );

    function createFailure(ruleName: string, start: number, end: number): Failure {
        return {
            ruleName,
            message: '',
            severity: 'error',
            start: {
                position: start,
                ...ts.getLineAndCharacterOfPosition(sourceFile, start),
            },
            end: {
                position: end,
                ...ts.getLineAndCharacterOfPosition(sourceFile, end),
            },
            fix: undefined,
        };
    }
});
