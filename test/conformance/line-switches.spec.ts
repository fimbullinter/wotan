import test from 'ava';
import * as ts from 'typescript';
import { getDisabledRanges, DisableMap } from '../../src/line-switches';
import { convertAst } from 'tsutils';

test('getDisabledRanges', (t) => {
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
        getDisabledRanges(['foobar'], sourceFile),
        expected,
        'without WrappedAst',
    );

    t.deepEqual(
        getDisabledRanges(['foobar'], sourceFile, convertAst(sourceFile).wrapped),
        expected,
        'with WrappedAst',
    );
});
