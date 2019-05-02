import { injectable } from 'inversify';
import { CachedFileSystem } from './services/cached-file-system';
import { StaticProgramState } from './program-state';
import { safeLoad, safeDump } from 'js-yaml';
import debug = require('debug');
import { DirectoryService } from '@fimbul/ymir';

const log = debug('wotan:statePersistence');

interface CacheFileContent {
    version: string;
    projects: Record<string, StaticProgramState>;
}

const CACHE_VERSION = '1';

@injectable()
export class StatePersistence {
    constructor(private fs: CachedFileSystem, private dir: DirectoryService) {}

    public loadState(project: string): StaticProgramState | undefined {
        const content = this.loadExisting();
        return content && content.projects[project]; // TODO resolve all paths
    }

    public saveState(project: string, state: StaticProgramState) {
        const content = this.loadExisting() || {version: CACHE_VERSION, projects: {}};
        content.projects[project] = state; // TODO make all paths relative
        this.fs.writeFile(this.dir.getCurrentDirectory() + '/.fimbullintercache.yaml', safeDump(content, {indent: 2, sortKeys: true}));
    }

    private loadExisting(): CacheFileContent | undefined {
        const fileName = this.dir.getCurrentDirectory() + '/.fimbullintercache.yaml';
        if (!this.fs.isFile(fileName)) {
            log('%s does not exist', fileName);
            return;
        }
        const content = safeLoad(this.fs.readFile(fileName))!;
        if (content.version !== CACHE_VERSION) {
            log('cache version mismatch');
            return;
        }
        return content;
    }
}
