import { AbstractCommandRunner, LintCommand } from './base';
import { injectable, ContainerModule } from 'inversify';
import { Runner } from '../runner';
import { FormatterLoader } from '../services/formatter-loader';
import { MessageHandler } from '@fimbul/ymir';
import { CachedFileSystem } from '../services/cached-file-system';

@injectable()
class LintCommandRunner extends AbstractCommandRunner {
    constructor(
        private runner: Runner,
        private formatterLoader: FormatterLoader,
        private logger: MessageHandler,
        private fs: CachedFileSystem,
    ) {
        super();
    }
    public run(options: LintCommand) {
        const formatter = new (this.formatterLoader.loadFormatter(options.formatter === undefined ? 'stylish' : options.formatter))();
        const result = this.runner.lintCollection(options);
        let success = true;
        if (formatter.prefix !== undefined)
            this.logger.log(formatter.prefix);
        for (const [file, summary] of result) {
            if (summary.findings.some((f) => f.severity === 'error'))
                success = false;
            const formatted = formatter.format(file, summary);
            if (formatted !== undefined)
                this.logger.log(formatted);
            if (options.fix && summary.fixes)
                this.fs.writeFile(file, summary.content);
        }
        if (formatter.flush !== undefined) {
            const formatted = formatter.flush();
            if (formatted !== undefined)
                this.logger.log(formatted);
        }
        return success;
    }
}

export const module = new ContainerModule((bind) => {
    bind(AbstractCommandRunner).to(LintCommandRunner);
});
