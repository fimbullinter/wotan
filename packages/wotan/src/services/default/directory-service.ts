import { injectable } from 'inversify';
import { DirectoryService } from '@fimbul/ymir';
import * as os from 'os';

@injectable()
export class NodeDirectoryService implements DirectoryService {
    public getCurrentDirectory() {
        return process.cwd();
    }
    public getHomeDirectory() {
        return os.homedir();
    }
}
