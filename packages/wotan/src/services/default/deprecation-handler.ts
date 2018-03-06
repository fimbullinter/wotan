import { DeprecationHandler, DeprecationTarget, MessageHandler } from '@fimbul/ymir';
import { injectable } from 'inversify';

@injectable()
export class DefaultDeprecationHandler implements DeprecationHandler {
    constructor(private logger: MessageHandler) {}

    public handle(target: DeprecationTarget, name: string, text?: string) {
        this.logger.warn(`${titlecase(target)} '${name}' is deprecated${text ? `: ${text}` : '.'}`);
    }
}

function titlecase(str: string) {
    return str.charAt(0).toUpperCase() + str.substr(1);
}
