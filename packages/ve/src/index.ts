import { AbstractProcessor, GlobalSettings, ProcessorUpdateResult, Failure } from '@fimbul/wotan';
import * as path from 'path';
import * as parse5 from 'parse5/lib'; // tslint:disable-line
import * as ts from 'typescript';

export class Processor extends AbstractProcessor {
    public static getSuffixForFile(name: string, _settings: GlobalSettings, readFile: () => string) {
        if (path.extname(name) !== '.vue')
            return '';
        let suffix = '.js';
        const content = readFile();
        const parser = new parse5.SAXParser();
        parser.on('startTag', (tagName, attr) => {
            if (tagName === 'script') {
                const lang = attr.find((a) => a.name === 'lang');
                if (lang !== undefined)
                    suffix = `.${lang.value}`;
            }
        });
        parser.write(content);
        parser.end();
        return suffix;
    }

    private range = this.initRange();

    private initRange() {
        const range = {
            start: 0,
            end: 0,
            line: 0,
        };
        if (path.extname(this.sourceFileName) === '.vue') {
            // wotan-disable-next-line no-useless-assertion
            const parsed = <parse5.AST.Default.DocumentFragment>parse5.parseFragment(this.source, {locationInfo: true});
            const script = parsed.childNodes.find((n): n is parse5.AST.Default.Element => n.nodeName === 'script');
            if (script !== undefined) {
                const {startTag, endTag} = script.__location!;
                range.start = startTag.endOffset;
                range.end = endTag.startOffset;
            }
            const match = this.source.substring(0, range.start).match(/(\r?\n)/g);
            if (match !== null)
                range.line = match.length;
        }
        return range;
    }

    public preprocess() {
        return this.source.substring(this.range.start, this.range.end);
    }

    public updateSource(newSource: string, changeRange: ts.TextChangeRange): ProcessorUpdateResult {
        const diff = newSource.length - this.source.length;
        this.range.end += diff;
        this.source = newSource;
        return {
            transformed: this.preprocess(),
            changeRange: {
                span: {
                    start: changeRange.span.start - this.range.start,
                    length: changeRange.span.length,
                },
                newLength: changeRange.newLength,
            },
        };
    }

    public postprocess(failures: Failure[]): Failure[] {
        return failures.map((f) => ({
            ...f,
            start: {
                character: f.start.character, // TODO handle first line different if these is no line break after <script>
                line: f.start.line + this.range.line,
                position: f.start.position + this.range.start,
            },
            end: {
                character: f.end.character,
                line: f.end.line + this.range.line,
                position: f.end.position + this.range.start,
            },
            fix: f.fix === undefined
                ? undefined
                : {
                    replacements: f.fix.replacements.map((r) => ({
                        start: r.start + this.range.start,
                        end: r.end + this.range.start,
                        text: r.text,
                    })),
                },
        }));
    }
}
