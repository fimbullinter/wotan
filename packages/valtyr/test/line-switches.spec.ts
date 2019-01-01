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
/*tslint:enable\tbaz*/
"/*tslint:disable";
// /* tslint:enable*/
/* // tslint:disable */
`;
    t.deepEqual(
        new TslintLineSwitchParser().parse(createParserContext(source)),
        [
            {
                rules: [],
                enable: false,
                pos: 1,
                end: undefined,
                location: {pos: 1, end: 19},
            },
            {
                rules: [{predicate: /^/}],
                enable: false,
                pos: 20,
                end: undefined,
                location: {pos: 20, end: 37},
            },
            {
                rules: [{predicate: /^/, location: {pos: 56, end: 59}, fixLocation: {pos: 56, end: 59}}],
                enable: false,
                pos: 38,
                end: undefined,
                location: {pos: 38, end: 59},
            },
            {
                rules: [
                    {predicate: 'foo', location: {pos: 77, end: 80}, fixLocation: {pos: 76, end: 80}},
                    {predicate: /^/, location: {pos: 81, end: 84}, fixLocation: {pos: 80, end: 84}},
                    {predicate: 'baz', location: {pos: 85, end: 88}, fixLocation: {pos: 84, end: 88}},
                ],
                enable: true,
                pos: 60,
                end: undefined,
                location: {pos: 60, end: 88},
            },
            {
                rules: [{predicate: 'foo', location: {pos: 116, end: 119}, fixLocation: {pos: 115, end: 119}}],
                enable: true,
                pos: 120,
                end: 149,
                location: {pos: 89, end: 119},
            },
            {
                rules: [{predicate: 'bar', location: {pos: 143, end: 146}, fixLocation: {pos: 142, end: 146}}],
                enable: false,
                pos: 120,
                end: 149,
                location: {pos: 120, end: 148},
            },
            {
                rules: [{predicate: 'baz', location: {pos: 165, end: 168}, fixLocation: {pos: 164, end: 168}}],
                enable: true,
                pos: 149,
                end: undefined,
                location: {pos: 149, end: 170},
            },
        ],
    );
});

test("doesn't throw on EOF", (t) => {
    const parser = new TslintLineSwitchParser();
    t.deepEqual(
        parser.parse(createParserContext('//tslint:disable-line')),
        [{rules: [{predicate: /^/}], enable: false, pos: 0, end: undefined, location: {pos: 0, end: 21}}],
    );
    t.deepEqual(
        parser.parse(createParserContext('//tslint:disable-next-line')),
        [{rules: [{predicate: /^/}], enable: false, pos: 27, end: undefined, location: {pos: 0, end: 26}}],
    );
    t.deepEqual(
        parser.parse(createParserContext('//tslint:disable-next-line\n')),
        [{rules: [{predicate: /^/}], enable: false, pos: 27, end: undefined, location: {pos: 0, end: 26}}],
    );
});

function createParserContext(content: string): LineSwitchParserContext {
    const sourceFile = ts.createSourceFile('file.ts', content, ts.ScriptTarget.Latest);
    return {
        sourceFile,
        getCommentAtPosition(pos) {
            return getCommentAtPosition(sourceFile, pos);
        },
    };
}
