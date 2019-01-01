import test from 'ava';
import * as cp from 'child_process';
import * as path from 'path';

function execCli(args: string[], cwd: string): Promise<{err: Error | null, stdout: string, stderr: string, code: number}> {
    interface ErrorWithCode extends Error {
        code: number;
    }
    return new Promise((r) => {
        cp.exec(
            `${path.resolve('./node_modules/.bin/wotan')} '${args.join("' '")}'`,
            {cwd},
            (err, stdout, stderr) => r({err, stdout, stderr, code: err ? (<ErrorWithCode>err).code : 0}),
        );
    });
}

test('can be used with --module flag', async (t) => {
    const result =
        await execCli(['-m', '.', '-f', 'prose', '--report-useless-directives', 'test/fixtures/*', 'test/fixtures/.*'], 'packages/valtyr');
    t.is(result.code, 2);
    t.is(result.stderr, '');
    t.is(result.stdout.trim(), `ERROR: ${resolve('.dotfile.ts')}:1:1 - test message
WARNING: ${resolve('.dotfile.ts')}:1:2 - ' should be "
ERROR: ${resolve('.dotfile.ts')}:2:26 - This rule has no failures to disable.
ERROR: ${resolve('.dotfile.ts')}:2:44 - This rule doesn't match any rules enabled for this file.
ERROR: ${resolve('.dotfile.ts')}:2:54 - This rule was already specified in this disable switch.
ERROR: ${resolve('.dotfile.ts')}:3:36 - This rule has no failures to disable.
ERROR: ${resolve('.dotfile.ts')}:4:30 - This rule was already specified in this disable switch.
WARNING: ${resolve('.dotjs.jsx')}:1:1 - test message
WARNING: ${resolve('.dotjs.jsx')}:1:3 - Missing semicolon
WARNING: ${resolve('myRuleRule.js')}:1:1 - test message
WARNING: ${resolve('myRuleRule.js')}:5:78 - Missing semicolon
WARNING: ${resolve('myRuleRule.js')}:7:2 - Missing semicolon
ERROR: ${resolve('test.tsx')}:1:1 - test message
WARNING: ${resolve('test.tsx')}:2:1 - ' should be "`);
});

test('load processor config from .fimbullinter.yaml', async (t) => {
    const result = await execCli(['-m', '../..', '-f', 'prose', '*.vue'], 'packages/valtyr/test/fixtures');
    t.is(result.stderr, '');
    t.is(result.code, 2);
    t.is(result.stdout.trim(), `ERROR: ${resolve('processed.vue')}:5:1 - test message
WARNING: ${resolve('processed.vue')}:5:17 - ' should be "
ERROR: ${resolve('processed2.vue')}:4:19 - test message
WARNING: ${resolve('processed2.vue')}:5:11 - ' should be "
ERROR: ${resolve('processed3.vue')}:1:19 - test message`);
});

function resolve(p: string) {
    return path.resolve(__dirname, 'fixtures', p).replace(/\\/g, '/');
}
