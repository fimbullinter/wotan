import test from 'ava';
import * as cp from 'child_process';
import * as path from 'path';
import { unixifyPath } from '../../src/utils';

function execCli(args: string[]): Promise<{err: Error | null, stdout: string, stderr: string, code: number}> {
    interface ErrorWithCode extends Error {
        code: number;
    }
    return new Promise((resolve) => {
        cp.exec(`node src/cli '${args.join("' '")}'`, (err, stdout, stderr) => {
            return resolve({err, stdout, stderr, code: err ? (<ErrorWithCode>err).code : 0});
        });
    });
}

test.serial('exits with code 0 on success', async (t) => {
    t.is((await execCli(['show', 'src/index.ts'])).code, 0);
});

test.serial('prints version', async (t) => {
    const version = require('../../package.json').version; // tslint:disable-line:no-require-imports
    t.deepEqual(await execCli(['-v']), {stdout: `${version}\n`, stderr: '', code: 0, err: null}); // tslint:disable-line:no-null-keyword
    t.is((await execCli(['version'])).stdout, `${version}\n`);
});

test.serial('exits with code 1 on configuration error', async (t) => {
    const result = await execCli(['show', '--wrong-option']);
    t.is(result.code, 1);
    t.is(result.stderr, `Unknown option '--wrong-option'.\n`);
    t.is(result.stdout, '');
});

test.serial('exits with code 1 on exception and prints stack trace', async (t) => {
    const result = await execCli(['lint', __filename, '-c', 'test/fixtures/configuration/invalid-rule.yaml']);
    t.is(result.code, 1);
    t.true(result.stderr.startsWith(path.resolve('test/fixtures/invalid.js:')));
    t.regex(result.stderr, /SyntaxError:/);
    t.regex(result.stderr, /^\s+at [\w. ]+ \([\w.]+:\d+:\d+\)$/m);
    t.is(result.stdout, '');
});

test.serial('exits with code 2 on lint error', async (t) => {
    const result = await execCli(['lint', 'test/rules/trailing-newline/whitespace.ts', '--format', 'json']);
    t.is(result.code, 2);
    t.is(result.stderr, '');
    t.is(result.stdout, /* tslint:disable-next-line */ `[
{"ruleName":"trailing-newline","severity":"error","message":"File must end with a newline.","start":{"position":5,"line":0,"character":5},"end":{"position":5,"line":0,"character":5},"fix":{"replacements":[{"start":5,"end":5,"text":"\\n"}]},"fileName":"${unixifyPath(path.resolve('test/rules/trailing-newline/whitespace.ts'))}"}
]
`);
});
