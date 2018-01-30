"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const wotan_1 = require("@fimbul/wotan");
const path = require("path");
const parse5 = require("parse5/lib");
class Processor extends wotan_1.AbstractProcessor {
    constructor() {
        super(...arguments);
        this.range = this.initRange();
    }
    static getSuffixForFile(name, _settings, readFile) {
        if (path.extname(name) !== '.vue')
            return '';
        let suffix = '.js';
        const content = readFile();
        const parser = new parse5.SAXParser();
        parser.on('startTag', (tagName, attr) => {
            if (tagName === 'script') {
                const lang = attr.find((a) => a.name === 'lang');
                if (lang !== undefined)
                    suffix = `.${lang.value}`;
            }
        });
        parser.write(content);
        parser.end();
        return suffix;
    }
    initRange() {
        const range = {
            start: 0,
            end: 0,
            line: 0,
        };
        if (path.extname(this.sourceFileName) === '.vue') {
            const parsed = parse5.parseFragment(this.source, { locationInfo: true });
            const script = parsed.childNodes.find((n) => n.nodeName === 'script');
            if (script !== undefined) {
                const { startTag, endTag } = script.__location;
                range.start = startTag.endOffset;
                range.end = endTag.startOffset;
            }
            const match = this.source.substring(0, range.start).match(/(\r?\n)/g);
            if (match !== null)
                range.line = match.length;
        }
        return range;
    }
    preprocess() {
        return this.source.substring(this.range.start, this.range.end);
    }
    updateSource(newSource, changeRange) {
        const diff = newSource.length - this.source.length;
        this.range.end += diff;
        this.source = newSource;
        return {
            transformed: this.preprocess(),
            changeRange: {
                span: {
                    start: changeRange.span.start - this.range.start,
                    length: changeRange.span.length,
                },
                newLength: changeRange.newLength,
            },
        };
    }
    postprocess(failures) {
        return failures.map((f) => (Object.assign({}, f, { start: {
                character: f.start.character,
                line: f.start.line + this.range.line,
                position: f.start.position + this.range.start,
            }, end: {
                character: f.end.character,
                line: f.end.line + this.range.line,
                position: f.end.position + this.range.start,
            }, fix: f.fix === undefined
                ? undefined
                : {
                    replacements: f.fix.replacements.map((r) => ({
                        start: r.start + this.range.start,
                        end: r.end + this.range.start,
                        text: r.text,
                    })),
                } })));
    }
}
exports.Processor = Processor;
//# sourceMappingURL=index.js.map