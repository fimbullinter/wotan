import { injectable, ContainerModule } from 'inversify';
import { AbstractCommandRunner, ValidateCommand } from './base';

@injectable()
class ValidateCommandRunner extends AbstractCommandRunner {
    constructor() {
        super();
    }
    public run(_options: ValidateCommand) {
        return true;
    }
}

export const module = new ContainerModule((bind) => {
    bind(AbstractCommandRunner).to(ValidateCommandRunner);
});
