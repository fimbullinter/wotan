import { ContentId, ContentIdHost } from '@fimbul/ymir';
export declare class ContentHasher implements ContentId {
    forFile(fileName: string, host: ContentIdHost): string;
}
