import { injectable } from 'inversify';
import { Resolver } from '../../types';
import { CachedFileSystem } from '../cached-file-system';
import * as resolve from 'resolve';

@injectable()
export class NodeResolver implements Resolver {
    constructor(private fs: CachedFileSystem) {}

    public resolve(id: string, basedir: string, extensions: string[], paths?: string[]): string {
        return resolve.sync(id, {
            basedir,
            extensions,
            paths,
            isFile: (file) => this.fs.isFile(file),
            readFileSync: (file) => this.fs.readFile(file)!,
        });
    }

    public require(id: string, options?: {cache?: boolean}) {
        if (options !== undefined && options.cache === false)
            delete require.cache[id];
        return require(id);
    }
}
