import { MessageHandler, ConfigurationError } from '@fimbul/ymir';
import { injectable } from 'inversify';

@injectable()
export class ConsoleMessageHandler implements MessageHandler {
    private warned = new Set<string>();

    public log(message: string) {
        console.log(message);
    }
    public warn(message: string) {
        if (!this.warned.has(message)) {
            this.warned.add(message);
            console.warn(message);
        }
    }
    public error(e: Error) {
        console.error(e instanceof ConfigurationError ? e.message : e);
    }
}
