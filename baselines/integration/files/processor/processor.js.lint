const {AbstractProcessor} = require('../../../src/types');

exports.Processor = class Processor extends AbstractProcessor {
    preprocess() {
        return this.source;
    }

    updateSource(source, changeRange) {
        return {
            transformed: source,
            changeRange: changeRange,
        };
    }

    postprocess(failures) {
        return failures;
    }
}

exports.Processor.transformName = function(name) {
    return name;
}
