import { AbstractFormatter, LintResult } from '../types';

export class Formatter extends AbstractFormatter {
    public format(result: LintResult) {
        const allFailures = [];
        for (const [fileName, {failures}] of result)
            for (const failure of failures)
                allFailures.push({
                    fileName,
                    ...failure,
                });
        return JSON.stringify(allFailures);
    }
}
