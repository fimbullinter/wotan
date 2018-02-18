import 'reflect-metadata';
import test from 'ava';
import { LineSwitchParserContext } from '@fimbul/wotan';
import { TslintLineSwitchParser } from '../src/line-switches';
import * as ts from 'typescript';
import { getCommentAtPosition } from 'tsutils';

test('parses line switches correctly', (t) => {
    const source = `
// tslint:disable:
// tslint:disable
// tslint:disable:all
// tslint:enable foo all baz
// tslint:enable-next-line foo
/*tslint:disable-line: bar*/
/*tslint:enable baz*/
"/*tslint:disable";
// /* tslint:enable*/
/* // tslint:disable */
`;
    t.deepEqual(
        new TslintLineSwitchParser().parse(createParserContext(source, ['foo', 'bar', 'bas'])),
        new Map([
            ['foo', [
                {position: 20, enable: false},
                {position: 38, enable: false},
                {position: 60, enable: true},
                {position: 120, enable: true},
                {position: 149, enable: false},
            ]],
            ['bar', [
                {position: 20, enable: false},
                {position: 38, enable: false},
                {position: 60, enable: true},
                {position: 120, enable: false},
                {position: 149, enable: true},
            ]],
            ['bas', [
                {position: 20, enable: false},
                {position: 38, enable: false},
                {position: 60, enable: true},
            ]],
        ]),
    );
});

test("doesn't throw on EOF", (t) => {
    const parser = new TslintLineSwitchParser();
    t.deepEqual(
        parser.parse(createParserContext('//tslint:disable-line', ['foo'])),
        new Map([['foo', [{position: 0, enable: false}]]]),
    );
    t.deepEqual(
        parser.parse(createParserContext('//tslint:disable-next-line', ['foo'])),
        new Map(),
    );
    t.deepEqual(
        parser.parse(createParserContext('//tslint:disable-next-line\n', ['foo'])),
        new Map([['foo', [{position: 27, enable: false}]]]),
    );
});

function createParserContext(content: string, ruleNames: string[]): LineSwitchParserContext {
    const sourceFile = ts.createSourceFile('file.ts', content, ts.ScriptTarget.Latest);
    return {
        sourceFile,
        ruleNames,
        getCommentAtPosition(pos) {
            return getCommentAtPosition(sourceFile, pos);
        },
    };
}
