"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ava_1 = require("ava");
const TSLint = require("tslint");
const src_1 = require("../src");
const wotan_1 = require("@fimbul/wotan");
ava_1.default('returns expected output', (t) => {
    testFormatter(TSLint.Formatters.FileslistFormatter, `/bar.ts
/baz.ts
`);
    testFormatter(TSLint.Formatters.ProseFormatter, `Fixed 2 error(s) in /foo.ts
Fixed 1 error(s) in /baz.ts

ERROR: /bar.ts[1, 1]: message
WARNING: /baz.ts[1, 1]: a
`);
    function testFormatter(ctor, expected) {
        const formatter = src_1.wrapTslintFormatter(ctor);
        const f = new formatter();
        t.is(f.format('/foo.ts', { fixes: 2, failures: [], content: '' }), undefined);
        t.is(f.format('/bar.ts', {
            fixes: 0,
            failures: [{
                    ruleName: 'foo',
                    severity: 'error',
                    message: 'message',
                    start: { position: 0, line: 0, character: 0 },
                    end: { position: 0, line: 0, character: 0 },
                    fix: undefined,
                }],
            content: '',
        }), undefined);
        t.is(f.format('/baz.ts', {
            fixes: 1,
            failures: [{
                    ruleName: 'rule',
                    severity: 'warning',
                    message: 'a',
                    start: { position: 0, line: 0, character: 1 },
                    end: { position: 1, line: 0, character: 1 },
                    fix: { replacements: [wotan_1.Replacement.delete(0, 1)] },
                }],
            content: 'a',
        }), undefined);
        t.is(f.flush(), expected);
    }
});
//# sourceMappingURL=formatter.spec.js.map