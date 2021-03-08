import { CachedFileSystem } from '../cached-file-system';
import { StatePersistence, StaticProgramState } from '@fimbul/ymir';
export declare class DefaultStatePersistence implements StatePersistence {
    constructor(fs: CachedFileSystem);
    loadState(project: string): StaticProgramState | undefined;
    saveState(project: string, state: StaticProgramState): void;
}
