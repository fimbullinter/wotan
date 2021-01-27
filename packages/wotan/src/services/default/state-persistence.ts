import { injectable } from 'inversify';
import { CachedFileSystem } from '../cached-file-system';
import debug = require('debug');
import * as yaml from 'js-yaml';
import { StatePersistence, StaticProgramState } from '@fimbul/ymir';

const log = debug('wotan:statePersistence');

interface CacheFileContent {
    v: string;
    state: StaticProgramState;
}

const CACHE_VERSION = '1';

@injectable()
export class DefaultStatePersistence implements StatePersistence {
    constructor(private fs: CachedFileSystem) {}

    public loadState(project: string): StaticProgramState | undefined {
        const fileName = buildFilename(project);
        if (!this.fs.isFile(fileName))
            return;
        try {
            log("Loading cache from '%s'", fileName);
            const content = <CacheFileContent | undefined>yaml.load(this.fs.readFile(fileName));
            if (content?.v !== CACHE_VERSION) {
                log("Version mismatch: expected '%s', actual: '%s'", CACHE_VERSION, content?.v);
                return;
            }
            return content.state;
        } catch {
            log("Error loading cache '%s'", fileName);
            return;
        }
    }

    public saveState(project: string, state: StaticProgramState) {
        const fileName = buildFilename(project);
        log("Writing cache '%s'", fileName);
        try {
            const content: CacheFileContent = {v: CACHE_VERSION, state};
            this.fs.writeFile(fileName, yaml.dump(content, {indent: 2, sortKeys: true}));
        } catch {
            log("Error writing cache '%s'", fileName);
        }
    }
}

function buildFilename(tsconfigPath: string) {
    return tsconfigPath.replace(/.[^.]+$/, '.fimbullintercache');
}
