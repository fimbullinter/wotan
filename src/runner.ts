import * as glob from 'glob';
import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import { Configuration, findConfiguration, reduceConfigurationForFile } from './configuration';
import { lint } from './linter';

export interface RunnerOptions {
    files: string[];
    exclude: string[];
    project: string | undefined;
}

export function run(options: RunnerOptions): boolean {
    // TODO findup tsconfig.json
    const files = [];
    for (const pattern of options.files)
        files.push(...glob.sync(pattern, {
            ignore: options.exclude,
            absolute: true,
        }));
    let failures = false;
    let dir: string | undefined;
    let config: Configuration | undefined;
    for (const file of files) {
        const dirname = path.dirname(file);
        if (dir !== dirname) {
            config = findConfiguration(file);
            dir = dirname;
        }
        const effectiveConfig = config && reduceConfigurationForFile(config, file);
        if (effectiveConfig === undefined)
            continue;
        const content = fs.readFileSync(file, 'utf8');
        const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext, true);
        const result = lint(sourceFile, effectiveConfig);
        if (result.length !== 0) {
            failures = true;
            console.log(result);
        }
    }
    return failures;
}
