import 'reflect-metadata';
import test from 'ava';
import * as ts from 'typescript';
import { LineSwitchService, DisableMap } from '../../src/services/line-switches';
import { DefaultLineSwitchParser } from '../../src/services/default/line-switch-parser';
import { convertAst } from 'tsutils';

test('getDisabledRanges', (t) => {
    const source = `#! shebang
// wotan-disable
"/* wotan-enable */" /*wotan-enable*/;
let foo /* wotan-disable-line */ = true;
//wotan-disable-line foobaz`;
    const sourceFile = ts.createSourceFile('/foo.ts', source, ts.ScriptTarget.ESNext);
    const {wrapped} = convertAst(sourceFile);

    const lineSwitchService = new LineSwitchService(new DefaultLineSwitchParser());
    const expected: DisableMap = new Map([['foobar', [
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
        lineSwitchService.getDisabledRanges(sourceFile, ['foobar']),
        expected,
        'without WrappedAst',
    );

    t.deepEqual(
        lineSwitchService.getDisabledRanges(sourceFile, ['foobar'], () => wrapped),
        expected,
        'with WrappedAst',
    );

    t.deepEqual(
        new LineSwitchService({
            parse(_source, _rules, context) {
                t.is(context.getCommentAtPosition(-1), undefined); // should not throw here
                return new Map([['foo', [{enable: true, position: 0}]], ['bar', []]]);
            },
        }).getDisabledRanges(sourceFile, ['foo'], () => wrapped),
        new Map(),
    );
});
