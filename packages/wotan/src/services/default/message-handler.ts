import { MessageHandler, ConfigurationError } from '@fimbul/ymir';
import { injectable } from 'inversify';
import { addUnique } from '../../utils';

@injectable()
export class ConsoleMessageHandler implements MessageHandler {
    private warned: string[] = [];

    public log(message: string) {
        console.log(message);
    }
    public warn(message: string) {
        if (addUnique(this.warned, message))
            console.warn(message);
    }
    public error(e: Error) {
        console.error(e instanceof ConfigurationError ? e.message : e);
    }
}
