import { injectable, ContainerModule } from 'inversify';
import { AbstractCommandRunner, LintCommand } from './base';
import { CachedFileSystem } from '../services/cached-file-system';
import { MessageHandler, DirectoryService, GlobalOptions, Format } from '@fimbul/ymir';
import { format } from '../utils';
import * as path from 'path';

@injectable()
class SaveCommandRunner extends AbstractCommandRunner {
    constructor(
        private fs: CachedFileSystem,
        private logger: MessageHandler,
        private directories: DirectoryService,
        private options: GlobalOptions,
    ) {
        super();
    }

    public run({command: _command, ...config}: LintCommand) {
        const newContent = format(
            {...this.options, ...config, fix: config.fix || undefined, references: config.references || undefined},
            Format.Yaml,
        );
        const filePath = path.join(this.directories.getCurrentDirectory(), '.fimbullinter.yaml');
        if (newContent.trim() === '{}') {
            try {
                this.fs.remove(filePath);
                this.logger.log("Removed '.fimbullinter.yaml'.");
            } catch {}
        } else {
            this.fs.writeFile(filePath, newContent);
            this.logger.log("Updated '.fimbullinter.yaml'.");
        }
        return true;
    }
}

export const module = new ContainerModule((bind) => {
    bind(AbstractCommandRunner).to(SaveCommandRunner);
});
