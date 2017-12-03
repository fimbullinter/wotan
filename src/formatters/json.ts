import { Failure } from '../linter';

export class Formatter {
    public format(failures: Failure[]) {
        return JSON.stringify(failures);
    }
}
