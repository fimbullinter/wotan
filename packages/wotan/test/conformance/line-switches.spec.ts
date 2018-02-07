import 'reflect-metadata';
import test from 'ava';
import * as ts from 'typescript';
import { LineSwitchService, DisableMap } from '../../src/services/line-switches';
import { DefaultLineSwitchParser } from '../../src/services/default/line-switch-parser';
import { convertAst } from 'tsutils';

test('getDisabledRanges', (t) => {
    const lineSwitchService = new LineSwitchService(new DefaultLineSwitchParser());
    const source = `#! shebang
// wotan-disable
"/* wotan-enable */" /*wotan-enable*/;
let foo /* wotan-disable-line */ = true;
//wotan-disable-line foobaz`;
    const sourceFile = ts.createSourceFile('/foo.ts', source, ts.ScriptTarget.ESNext);
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
        lineSwitchService.getDisabledRanges(sourceFile, ['foobar'], () => convertAst(sourceFile).wrapped),
        expected,
        'with WrappedAst',
    );
});
