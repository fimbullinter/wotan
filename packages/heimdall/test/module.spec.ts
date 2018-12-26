import test from 'ava';
import * as cp from 'child_process';
import * as path from 'path';

function execCli(...args: string[]): Promise<{err: Error | null, stdout: string, stderr: string, code: number}> {
    interface ErrorWithCode extends Error {
        code: number;
    }
    return new Promise((r) => {
        cp.exec(
            `${path.normalize('./node_modules/.bin/wotan')} '${args.join("' '")}'`,
            {cwd: 'packages/heimdall'},
            (err, stdout, stderr) => r({err, stdout, stderr, code: err ? (<ErrorWithCode>err).code : 0}),
        );
    });
}

test('can be used with --module flag', async (t) => {
    const result = await execCli('-m', './src', '-c', './test/fixtures/.wotanrc.yaml', '-f', 'prose', 'test/fixtures/*');
    t.is(result.stderr, '');
    t.is(result.code, 2);
    t.is(result.stdout.trim(), `ERROR: ${resolve('test/fixtures/my-rule.js')}:5:18 - Missing semicolon
ERROR: ${resolve('test/fixtures/my-rule.js')}:7:2 - Missing semicolon
WARNING: ${resolve('test/fixtures/myTslintRuleRule.js')}:3:1 - unused expression, expected an assignment or function call
ERROR: ${resolve('test/fixtures/myTslintRuleRule.js')}:9:2 - Missing semicolon`);
});

function resolve(p: string) {
    return path.resolve('packages/heimdall', p).replace(/\\/g, '/');
}
