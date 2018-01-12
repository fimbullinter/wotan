const {AbstractProcessor} = require('../../../../src/types');

class Processor extends AbstractProcessor {
    static transformName(name) {
        return name + '.ts';
    }

    constructor(...args) {
        super(...args);
        // this is overly simplified and should never be used in production
        const match = /<script.*?>\r?\n/.exec(this.source);
        this.start = match.index + match[0].length;
        this.lineOffset = this.source.substring(0, this.start).match(/(\r?\n)/g).length;
    }

    preprocess() {
        return this.source.substring(this.start, this.source.indexOf('</script>', this.start));
    }

    updateSource(source, range) {
        this.source = source;
        return {
            transformed: this.preprocess(),
            changeRange: {
                span: {
                    start: range.span.start - this.start,
                    length: range.span.length,
                },
                newLength: range.newLength,
            },
        }
    }

    postprocess(failures) {
        const offset = this.start;
        const lineOffset = this.lineOffset;
        return failures.map((failure) => {
            failure = Object.assign({}, failure);
            failure.start.position += offset;
            failure.start.line += lineOffset;
            failure.end.position += offset;
            failure.end.line += lineOffset;
            if (failure.fix !== undefined) {
                failure.fix = {
                    replacements: failure.fix.replacements.map((replacement) => ({
                        text: replacement.text,
                        start: replacement.start + offset,
                        end: replacement.end + offset,
                    })),
                }
            }
            return failure;
        });
    }
}

exports.Processor = Processor;
