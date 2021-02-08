import 'reflect-metadata';
import test from 'ava';
import { Dirent } from 'fs';
import { DirectoryJSON, Volume } from 'memfs';
import * as ts from 'typescript';
import { DependencyResolverFactory, DependencyResolverHost } from '../src/services/dependency-resolver';
import { mapDefined, unixifyPath } from '../src/utils';
import * as path from 'path';

function identity<T>(v: T) {
    return v;
}

function setup(fileContents: DirectoryJSON, useSourceOfProjectReferenceRedirect?: boolean) {
    const {root} = path.parse(unixifyPath(process.cwd()));
    const vol = Volume.fromJSON(fileContents, root);
    function fileExists(f: string) {
        try {
            return vol.statSync(f).isFile();
        } catch {
            return false;
        }
    }
    function readFile(f: string) {
        try {
            return vol.readFileSync(f, {encoding: 'utf8'}).toString();
        } catch {
            return;
        }
    }
    function readDirectory(
        rootDir: string,
        extensions: readonly string[],
        excludes: readonly string[] | undefined,
        includes: readonly string[],
        depth?: number,
    ) {
        return ts.matchFiles(
            rootDir,
            extensions,
            excludes,
            includes,
            true,
            root,
            depth,
            (dir) => {
                const files: string[] = [];
                const directories: string[] = [];
                const result: ts.FileSystemEntries = {files, directories};
                let entries;
                try {
                    entries = <Dirent[]>vol.readdirSync(dir, {withFileTypes: true, encoding: 'utf8'});
                } catch {
                    return result;
                }
                for (const entry of entries)
                    (entry.isFile() ? files : directories).push(entry.name);
                return result;
            },
            identity,
        );
    }

    const commandLine = ts.getParsedCommandLineOfConfigFile(root + 'tsconfig.json', {}, {
        fileExists,
        readFile,
        readDirectory,
        getCurrentDirectory() { return root; },
        useCaseSensitiveFileNames: true,
        onUnRecoverableConfigFileDiagnostic() {},
    })!;
    const resolutionCache = ts.createModuleResolutionCache(root, identity, commandLine.options);
    const compilerHost: ts.CompilerHost & DependencyResolverHost = {
        fileExists,
        readFile,
        readDirectory,
        directoryExists(d) {
            try {
                return vol.statSync(d).isDirectory();
            } catch {
                return false;
            }
        },
        getCanonicalFileName: identity,
        getCurrentDirectory() {
            return root;
        },
        getNewLine() {
            return '\n';
        },
        useCaseSensitiveFileNames() {
            return true;
        },
        useSourceOfProjectReferenceRedirect: useSourceOfProjectReferenceRedirect === undefined
            ? undefined
            : () => useSourceOfProjectReferenceRedirect,
        getDefaultLibFileName: ts.getDefaultLibFilePath,
        getSourceFile(fileName, languageVersion) {
            const content = readFile(fileName);
            return content === undefined ? undefined : ts.createSourceFile(fileName, content, languageVersion, true);
        },
        writeFile() {
            throw new Error('not implemented');
        },
        realpath: identity,
        getDirectories(d) {
            return mapDefined(<string[]>vol.readdirSync(d, {encoding: 'utf8'}), (f) => {
                return this.directoryExists!(d + '/' + f) ? f : undefined;
            });
        },
        resolveModuleNames(modules, containingFile, _, redirectedReference, o) {
            return modules.map(
                (m) => ts.resolveModuleName(m, containingFile, o, this, resolutionCache, redirectedReference).resolvedModule);
        },
    };
    const program = ts.createProgram({
        host: compilerHost,
        options: commandLine.options,
        rootNames: commandLine.fileNames,
        projectReferences: commandLine.projectReferences,
    });
    const dependencyResolver = new DependencyResolverFactory().create(compilerHost, program);
    return {vol, compilerHost, program, dependencyResolver, root};
}

test('resolves imports', (t) => {
    let {dependencyResolver, program, compilerHost, vol, root} = setup({
        'tsconfig.json': JSON.stringify({compilerOptions: {moduleResolution: 'node', allowJs: true}, exclude: ['excluded.ts']}),
        'a.ts': 'import * as a from "./a"; import {b} from "./b"; import {c} from "c"; import {d} from "d"; import {e} from "e"; import {f} from "f"; import {f1} from "f1"; import {f2} from "f2"; import {g} from "g";',
        'b.ts': 'export const b = 1;',
        'node_modules/c/index.d.ts': 'export const c = 1;',
        'node_modules/f1/index.d.ts': 'export const f1 = 1;',
        'node_modules/g/index.d.ts': 'export const g = 1;',
        'empty.js': '',
        'ambient.ts': 'declare module "d" {export const d: number;} declare module "g" {}',
        'global.ts': 'declare var v = 1;',
        'other.ts': 'export {}; declare module "c" { export let other: number; }; declare module "d" {}; declare module "f1" {}; declare module "f2" {}; declare module "goo" {}; declare module "g" {};',
        'pattern.ts': 'declare module "f*"; declare module "goo*oo";',
        'declare-global.ts': 'export {}; declare global {}',
        'umd.d.ts': 'export let stuff: number; export as namespace Stuff;',
        'excluded.ts': 'declare module "e" {}; declare module "d" {};',
    });

    t.deepEqual(dependencyResolver.getFilesAffectingGlobalScope(), [root + 'declare-global.ts', root + 'global.ts', root + 'umd.d.ts']);
    t.deepEqual(dependencyResolver.getDependencies(root + 'a.ts'), new Map([
        ['./a', [root + 'a.ts']],
        ['./b', [root + 'b.ts']],
        ['c', [root + 'node_modules/c/index.d.ts', root + 'other.ts']],
        ['d', [root + 'ambient.ts', root + 'other.ts']],
        ['e', null],
        ['f', [root + 'pattern.ts', root + 'other.ts']],
        ['f1', [root + 'node_modules/f1/index.d.ts', root + 'other.ts']],
        ['f2', [root + 'pattern.ts', root + 'other.ts']],
        ['g', [root + 'ambient.ts', root + 'other.ts']],
    ]));
    t.deepEqual(dependencyResolver.getDependencies(root + 'b.ts'), new Map());
    t.deepEqual(dependencyResolver.getDependencies(root + 'node_modules/c/index.d.ts'), new Map([['\0', [root + 'other.ts']]]));
    t.deepEqual(dependencyResolver.getDependencies(root + 'node_modules/f1/index.d.ts'), new Map([['\0', [root + 'other.ts']]]));
    t.deepEqual(dependencyResolver.getDependencies(root + 'empty.js'), new Map());
    t.deepEqual(dependencyResolver.getDependencies(root + 'ambient.ts'), new Map([
        ['d', [root + 'ambient.ts', root + 'other.ts']],
        ['g', [root + 'ambient.ts', root + 'other.ts']],
    ]));
    t.deepEqual(dependencyResolver.getDependencies(root + 'global.ts'), new Map());
    t.deepEqual(dependencyResolver.getDependencies(root + 'declare-global.ts'), new Map());
    t.deepEqual(dependencyResolver.getDependencies(root + 'other.ts'), new Map([
        ['c', [root + 'node_modules/c/index.d.ts', root + 'other.ts']],
        ['d', [root + 'ambient.ts', root + 'other.ts']],
        ['f1', [root + 'node_modules/f1/index.d.ts', root + 'other.ts']],
        ['f2', [root + 'pattern.ts', root + 'other.ts']],
        ['goo', null],
        ['g', [root + 'ambient.ts', root + 'other.ts']],
    ]));
    t.deepEqual(dependencyResolver.getDependencies(root + 'pattern.ts'), new Map([
        ['f*', [root + 'pattern.ts', root + 'other.ts']],
        ['goo*oo', [root + 'pattern.ts']],
    ]));
    t.deepEqual(dependencyResolver.getDependencies(root + 'umd.d.ts'), new Map());

    vol.writeFileSync(root + 'empty.js', '/** @type {import("./b").b} */ var f = require("e");', {encoding: 'utf8'});
    program = ts.createProgram({
        oldProgram: program,
        host: compilerHost,
        options: program.getCompilerOptions(),
        rootNames: program.getRootFileNames(),
    });
    dependencyResolver.update(program, root + 'empty.js');

    t.deepEqual(dependencyResolver.getDependencies(root + 'empty.js'), new Map([
        ['./b', [root + 'b.ts']],
        ['e', null],
    ]));
    t.deepEqual(
        dependencyResolver.getFilesAffectingGlobalScope(),
        [root + 'declare-global.ts', root + 'empty.js', root + 'global.ts', root + 'umd.d.ts'],
    );

    vol.appendFileSync(root + 'b.ts', 'import "./excluded";');
    program = ts.createProgram({
        oldProgram: program,
        host: compilerHost,
        options: program.getCompilerOptions(),
        rootNames: program.getRootFileNames(),
    });
    dependencyResolver.update(program, root + 'b.ts');

    t.deepEqual(dependencyResolver.getDependencies(root + 'b.ts'), new Map([['./excluded', [root + 'excluded.ts']]]));
    t.deepEqual(dependencyResolver.getDependencies(root + 'a.ts'), new Map([
        ['./a', [root + 'a.ts']],
        ['./b', [root + 'b.ts']],
        ['c', [root + 'node_modules/c/index.d.ts', root + 'other.ts']],
        ['d', [root + 'excluded.ts', root + 'ambient.ts', root + 'other.ts']],
        ['e', [root + 'excluded.ts']],
        ['f', [root + 'pattern.ts', root + 'other.ts']],
        ['f1', [root + 'node_modules/f1/index.d.ts', root + 'other.ts']],
        ['f2', [root + 'pattern.ts', root + 'other.ts']],
        ['g', [root + 'ambient.ts', root + 'other.ts']],
    ]));
    t.deepEqual(dependencyResolver.getDependencies(root + 'ambient.ts'), new Map([
        ['d', [root + 'excluded.ts', root + 'ambient.ts', root + 'other.ts']],
        ['g', [root + 'ambient.ts', root + 'other.ts']],
    ]));
});

test('handles useSourceOfProjectReferenceRedirect', (t) => {
    const {dependencyResolver, root} = setup(
        {
            'tsconfig.json': JSON.stringify({references: [{path: 'a'}, {path: 'b'}, {path: 'c'}], include: ['src']}),
            'src/a.ts': 'export * from "../a/decl/src/a"; export * from "../a/decl/src/b"; export * from "../a/decl/src/c"; export * from "../a/decl/src/d";',
            'src/b.ts': 'export * from "../b/dist/file";',
            'src/c.ts': 'import "../c/dist/outfile',
            'src/d.ts': 'import "../d/file',
            'a/tsconfig.json': JSON.stringify(
                {compilerOptions: {composite: true, allowJs: true, outDir: 'dist', declarationDir: 'decl'}, include: ['src']},
            ),
            'a/src/a.ts': 'export {}',
            'a/src/b.tsx': 'export {}',
            'a/src/c.js': 'export {}',
            'a/src/d.jsx': 'export {}',
            'b/tsconfig.json': JSON.stringify({compilerOptions: {composite: true, outDir: 'dist', rootDir: 'src'}}),
            'b/src/file.ts': 'export {};',
            'c/tsconfig.json': JSON.stringify({compilerOptions: {composite: true, outFile: 'dist/outfile.js'}, files: ['a.ts', 'b.ts']}),
            'c/a.ts': 'namespace foo {}',
            'c/b.ts': 'namespace foo {}',
            'd/tsconfig.json': JSON.stringify({compilerOptions: {composite: true}, files: ['file.ts']}),
            'd/file.ts': 'export {}',
        },
        true,
    );

    t.deepEqual(dependencyResolver.getDependencies(root + 'src/a.ts'), new Map([
        ['../a/decl/src/a', [root + 'a/src/a.ts']],
        ['../a/decl/src/b', [root + 'a/src/b.tsx']],
        ['../a/decl/src/c', [root + 'a/src/c.js']],
        ['../a/decl/src/d', [root + 'a/src/d.jsx']],
    ]));
    t.deepEqual(dependencyResolver.getDependencies(root + 'src/b.ts'), new Map([['../b/dist/file', [root + 'b/src/file.ts']]]));
    t.deepEqual(dependencyResolver.getDependencies(root + 'src/c.ts'), new Map([['../c/dist/outfile', [root + 'c/a.ts']]]));
    t.deepEqual(dependencyResolver.getDependencies(root + 'src/d.ts'), new Map([['../d/file', [root + 'd/file.ts']]]));
});

test('handles disableSourceOfProjectReferenceRedirect', (t) => {
    const {dependencyResolver, root} = setup(
        {
            'tsconfig.json': JSON.stringify(
                {references: [{path: 'a'}], compilerOptions: {disableSourceOfProjectReferenceRedirect: true}, include: ['src']},
            ),
            'src/a.ts': 'export * from "../a/dist/file";',
            'a/tsconfig.json': JSON.stringify({compilerOptions: {composite: true, outDir: 'dist', rootDir: 'src'}}),
            'a/src/file.ts': 'export {};',
            'a/dist/file.d.ts': 'export {};',
        },
        true,
    );

    t.deepEqual(dependencyResolver.getDependencies(root + 'src/a.ts'), new Map([
        ['../a/dist/file', [root + 'a/dist/file.d.ts']],
    ]));
});
