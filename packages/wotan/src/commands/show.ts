import { ConfigurationManager } from '../services/configuration-manager';
import { AbstractCommandRunner, ShowCommand } from './base';
import { injectable, ContainerModule } from 'inversify';
import { MessageHandler, ConfigurationError } from '@fimbul/ymir';
import { format } from '../utils';

@injectable()
class ShowCommandRunner extends AbstractCommandRunner {
    constructor(private configManager: ConfigurationManager, private logger: MessageHandler) {
        super();
    }
    public run(options: ShowCommand) {
        const config = options.config === undefined
            ? this.configManager.find(options.file)
            : this.configManager.loadLocalOrResolved(options.config);
        if (config === undefined)
            throw new ConfigurationError(`Cannot find configuration for '${options.file}'.`);
        const reduced = this.configManager.reduce(config, options.file);
        this.logger.log(`${config.filename}\n${reduced === undefined ? 'File is excluded.' : format(reduced, options.format)}`);
        return true;
    }
}

export const module = new ContainerModule((bind) => {
    bind(AbstractCommandRunner).to(ShowCommandRunner);
});
