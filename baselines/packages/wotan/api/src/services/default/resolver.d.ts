import { Resolver, DirectoryService } from '@fimbul/ymir';
import { CachedFileSystem } from '../cached-file-system';
export declare class NodeResolver implements Resolver {
    constructor(fs: CachedFileSystem, directories: DirectoryService);
    getDefaultExtensions(): ReadonlyArray<string>;
    resolve(id: string, basedir?: string, extensions?: ReadonlyArray<string>, paths?: ReadonlyArray<string>): string;
    require(id: string, options?: {
        cache?: boolean;
    }): any;
}
