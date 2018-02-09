import { AbstractProcessor, GlobalSettings, ProcessorUpdateResult, Failure, Replacement } from '@fimbul/wotan';
import * as path from 'path';
import * as parse5 from 'parse5/lib';
import * as ts from 'typescript';
import * as voidElements from 'void-elements';

export class Processor extends AbstractProcessor {
    public static getSuffixForFile(name: string, _settings: GlobalSettings, readFile: () => string) {
        if (path.extname(name) !== '.vue')
            return '';
        let suffix = '';
        const parser = new parse5.SAXParser();
        let depth = 0;
        parser.on('startTag', (tagName, attr, selfClosing) => {
            if (selfClosing || voidElements[tagName])
                return;
            ++depth;
            if (depth === 1 && tagName === 'script') {
                const lang = attr.find(isLangAttr);
                suffix = lang === undefined ? '.js' : `.${lang.value}`;
            }
        });
        parser.on('endTag', () => {
            --depth;
        });
        parser.write(readFile());
        parser.end();
        return suffix;
    }

    private range = this.initRange();

    private initRange() {
        const range = {
            start: 0,
            end: Infinity,
            line: 0,
        };
        if (path.extname(this.sourceFileName) === '.vue') {
            const parser = new parse5.SAXParser({locationInfo: true});
            let depth = 0;
            parser.on('startTag', (tagName, _attr, selfClosing, location) => {
                if (selfClosing || voidElements[tagName])
                    return;
                ++depth;
                if (depth === 1 && tagName === 'script')
                    range.start = location!.endOffset;
            });
            parser.on('endTag', (tagName, location) => {
                --depth;
                if (depth === 0 && tagName === 'script')
                    range.end = location!.startOffset;
            });
            parser.write(this.source);
            parser.end();
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
        return failures.map(this.mapFailure, this);
    }

    private mapFailure(f: Failure): Failure {
        return {
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
                    replacements: f.fix.replacements.map(this.mapReplacement, this),
                },
        };
    }

    private mapReplacement(r: Replacement): Replacement {
        return {
            start: r.start + this.range.start,
            end: r.end + this.range.start,
            text: r.text,
        };
    }
}

function isLangAttr(attr: parse5.AST.Default.Attribute) {
    return attr.name === 'lang';
}
