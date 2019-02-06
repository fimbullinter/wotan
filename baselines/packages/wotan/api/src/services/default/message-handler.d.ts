import { MessageHandler } from '@fimbul/ymir';
export declare class ConsoleMessageHandler implements MessageHandler {
    log(message: string): void;
    warn(message: string): void;
    error(e: Error): void;
}
