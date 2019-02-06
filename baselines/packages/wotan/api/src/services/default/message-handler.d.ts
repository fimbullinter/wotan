import { MessageHandler } from '@fimbul/ymir';
export declare class ConsoleMessageHandler implements MessageHandler {
    private warned;
    log(message: string): void;
    warn(message: string): void;
    error(e: Error): void;
}
