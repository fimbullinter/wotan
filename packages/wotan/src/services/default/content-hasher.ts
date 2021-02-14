import { ContentId, ContentIdHost } from '@fimbul/ymir';
import { injectable } from 'inversify';
import { djb2 } from '../../utils';

@injectable()
export class ContentHasher implements ContentId {
    public forFile(fileName: string, host: ContentIdHost): string {
        const content = host.readFile(fileName);
        return content === undefined ? 'N/A' : '' + djb2(content);
    }
}
