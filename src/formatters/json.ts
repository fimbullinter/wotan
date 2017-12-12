import { AbstractFormatter, Failure } from '../types';

export class Formatter extends AbstractFormatter {
    public format(failures: Failure[]) {
        return JSON.stringify(failures);
    }
}
