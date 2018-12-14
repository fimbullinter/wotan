import { injectable } from 'inversify';
import { Resolver, DirectoryService } from '@fimbul/ymir';
import { CachedFileSystem } from '../cached-file-system';
import * as resolve from 'resolve';

@injectable()
export class NodeResolver implements Resolver {
    private defaultExtensions: ReadonlyArray<string> = Object.keys(require.extensions).filter((ext) => ext !== '.json' && ext !== '.node');

    constructor(private fs: CachedFileSystem, private directories: DirectoryService) {}

    public getDefaultExtensions() {
        return this.defaultExtensions;
    }

    public resolve(
        id: string,
        basedir = this.directories.getCurrentDirectory(),
        extensions = this.defaultExtensions,
        paths?: ReadonlyArray<string>,
    ): string {
        return resolve.sync(id, {
            basedir,
            extensions,
            paths,
            isFile: (file) => this.fs.isFile(file),
            readFileSync: (file) => this.fs.readFile(file),
        });
    }

    public require(id: string, options?: {cache?: boolean}) {
        if (options !== undefined && options.cache === false)
            delete require.cache[id];
        return require(id);
    }
}
