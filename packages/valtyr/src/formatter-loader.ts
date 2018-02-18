import { injectable } from 'inversify';
import { FormatterLoaderHost, FormatterConstructor } from '@fimbul/wotan';
import * as TSLint from 'tslint';
import { wrapTslintFormatter } from '@fimbul/bifrost';

@injectable()
export class TslintFormatterLoaderHost implements FormatterLoaderHost {
    public loadCoreFormatter(name: string): FormatterConstructor | undefined {
        const result = TSLint.findFormatter(name);
        return result === undefined ? undefined : wrapTslintFormatter(result);
    }
    public loadCustomFormatter(): undefined {
        return;
    }
}
