// @ts-check
const {AbstractProcessor} = require('../../../../src/types');

class Processor extends AbstractProcessor {
    static getSuffixForFile() {
        return '.ts';
    }

    constructor(context) {
        super(context);
        this._init();
    }

    _init() {
        this.lines = this.source.split(/\n/g);
    }

    preprocess() {
        return this.lines.map((line) => line.substr(5)).join('\n');
    }

    updateSource(source) {
        this.source = source;
        this._init();
        return {
            transformed: this.preprocess(),
        }
    }

    postprocess(failures) {
        return failures.map((failure) => {
            failure = Object.assign({}, failure);
            failure.start.character += 5;
            failure.start.position += (failure.start.line + 1) * 5;
            failure.end.character += 5;
            failure.end.position += (failure.end.line + 1) * 5;
            if (failure.fix !== undefined) {
                failure.fix = {
                    replacements: failure.fix.replacements.map((replacement) => ({
                        text: replacement.text,
                        start: replacement.start + this.getOffset(replacement.start),
                        end: replacement.end + this.getOffset(replacement.end),
                    })),
                }
            }
            return failure;
        });
    }

    getOffset(pos) {
        let lineEnd = 0;
        let offset = 0;
        for (let i = 0; i < this.lines.length; ++i) {
            lineEnd += this.lines[i].length - 5;
            offset += 5;
            if (pos <= lineEnd)
                break;
        }
        return offset;
    }
}

exports.Processor = Processor;
