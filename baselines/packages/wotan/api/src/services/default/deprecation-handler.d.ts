import { DeprecationHandler, DeprecationTarget, MessageHandler } from '@fimbul/ymir';
export declare class DefaultDeprecationHandler implements DeprecationHandler {
    private logger;
    constructor(logger: MessageHandler);
    handle(target: DeprecationTarget, name: string, text?: string): void;
}
