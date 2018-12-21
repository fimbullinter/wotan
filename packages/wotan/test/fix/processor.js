// @ts-check
const {AbstractProcessor} = require('@fimbul/ymir');

exports.Processor = class extends AbstractProcessor {
    preprocess() {
        return this.source;
    }
    postprocess(findings) {
        return findings;
    }
    updateSource(newSource, changeRange) {
        this.source = newSource;
        return {
            transformed: newSource,
            changeRange
        };
    }
}
