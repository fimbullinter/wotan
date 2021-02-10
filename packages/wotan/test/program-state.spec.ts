import 'reflect-metadata';
import { DirectoryJSON, Volume } from 'memfs';
import * as path from 'path';
import { mapDefined, unixifyPath } from '../src/utils';
import * as ts from 'typescript';
import { Dirent } from 'fs';
import { ProgramStateFactory, ProgramStateHost } from '../src/services/program-state';
import { DependencyResolverFactory, DependencyResolverHost } from '../src/services/dependency-resolver';
import { StatePersistence, StaticProgramState } from '@fimbul/ymir';
import test from 'ava';
import * as yaml from 'js-yaml';

function identity<T>(v: T) {
    return v;
}

function setup(fileContents: DirectoryJSON, options: { subdir?: string, initialState?: StaticProgramState, caseSensitive?: boolean} = {}) {
    const {root} = path.parse(unixifyPath(process.cwd()));
    const cwd = options.subdir ? unixifyPath(path.join(root, options.subdir)) + '/' : root;
    const vol = Volume.fromJSON(fileContents, cwd);
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
            cwd,
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

    const tsconfigPath =  cwd + 'tsconfig.json';
    const commandLine = ts.getParsedCommandLineOfConfigFile(tsconfigPath, {}, {
        fileExists,
        readFile,
        readDirectory,
        getCurrentDirectory() { return cwd; },
        useCaseSensitiveFileNames: !!options.caseSensitive,
        onUnRecoverableConfigFileDiagnostic(d) {
            throw new Error(<string>d.messageText);
        },
    })!;
    const resolutionCache = ts.createModuleResolutionCache(cwd, identity, commandLine.options);
    const compilerHost: ts.CompilerHost & DependencyResolverHost & ProgramStateHost = {
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
        getCanonicalFileName: options.caseSensitive ? identity : (f) => f.toLowerCase(),
        getCurrentDirectory() {
            return cwd;
        },
        getNewLine() {
            return '\n';
        },
        useCaseSensitiveFileNames() {
            return !!options.caseSensitive;
        },
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
    const persistence: StatePersistence = {
        loadState() { return options.initialState; },
        saveState() {},
    };
    const factory = new ProgramStateFactory(new DependencyResolverFactory(), persistence);
    const programState = factory.create(program, compilerHost, tsconfigPath);
    return {vol, compilerHost, program, programState, cwd, persistence, tsconfigPath, factory};
}

function generateOldState(configHash: string, ...args: Parameters<typeof setup>) {
    const {program, programState, persistence} = setup(...args);
    for (const file of program.getSourceFiles())
        programState.setFileResult(file.fileName, configHash, []);
    let savedState!: StaticProgramState;
    persistence.saveState = (_, state) => savedState = state;
    programState.save();
    return savedState;
}

test('saves old state', (t) => {
    let {programState, persistence, tsconfigPath, cwd, program, vol, compilerHost, factory} = setup({
        'tsconfig.json': JSON.stringify({compilerOptions: {strict: true}}),
        'a.ts': 'import "./b"; import "./d";',
        'b.ts': 'import "./c";',
        'c.ts': 'export {}',
        'd.ts': 'export {}',
    }, {subdir: 'foo'});
    let savedState: StaticProgramState | undefined;
    persistence.saveState = (project, state) => {
        t.is(project, tsconfigPath);
        const {ts: tsVersion, ...rest} = state;
        t.is(tsVersion, ts.version);
        t.snapshot(yaml.dump(rest, {sortKeys: true}));
        savedState = state;
    };
    persistence.loadState = (project) => {
        t.is(project, tsconfigPath);
        return savedState;
    };
    t.is(programState.getUpToDateResult(cwd + 'a.ts', ''), undefined);

    programState.setFileResult(cwd + 'a.ts', '1234', []);
    programState.setFileResult(cwd + 'b.ts', '1234', []);
    programState.setFileResult(cwd + 'c.ts', '1234', []);
    programState.setFileResult(cwd + 'd.ts', '1234', []);

    vol.writeFileSync(cwd + 'd.ts', 'import "./c";');
    program = ts.createProgram({
        oldProgram: program,
        options: program.getCompilerOptions(),
        rootNames: program.getRootFileNames(),
        host: compilerHost,
    });
    programState.update(program, cwd + 'd.ts');

    programState.save();
    t.not(savedState, undefined);

    programState = factory.create(program, compilerHost, tsconfigPath);
    t.is(programState.getUpToDateResult(cwd + 'a.ts', '1234'), undefined);
    t.deepEqual(programState.getUpToDateResult(cwd + 'b.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'c.ts', '1234'), []);
    t.is(programState.getUpToDateResult(cwd + 'd.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'b.ts', '5678'), undefined);

    vol.writeFileSync(cwd + 'd.ts', 'import "./e"; declare module "./e" {}');
    vol.writeFileSync(cwd + 'e.ts', '');
    program = ts.createProgram({
        oldProgram: program,
        options: program.getCompilerOptions(),
        rootNames: program.getRootFileNames(),
        host: compilerHost,
    });
    programState.update(program, cwd + 'd.ts');
    t.is(programState.getUpToDateResult(cwd + 'a.ts', '1234'), undefined);
    t.deepEqual(programState.getUpToDateResult(cwd + 'b.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'c.ts', '1234'), []);
    t.is(programState.getUpToDateResult(cwd + 'd.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'e.ts', '1234'), undefined);

    programState.save();

    vol.writeFileSync(cwd + 'e.ts', 'var v: import("e");');
    program = ts.createProgram({
        oldProgram: program,
        options: program.getCompilerOptions(),
        rootNames: program.getRootFileNames(),
        host: compilerHost,
    });
    programState.update(program, cwd + 'e.ts');

    t.is(programState.getUpToDateResult(cwd + 'a.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'b.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'c.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'd.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'e.ts', '1234'), undefined);

    savedState = undefined;
    programState.save();
    t.not(savedState, undefined);
});

test('can start with a warm cache', (t) => {
    const state = generateOldState(
        '1234',
        {
            'tsconfig.json': '{}',
            'A.ts': '',
            'b.ts': '',
            'C.ts': '',
            'd.ts': '',
        },
    );
    const {programState, cwd} = setup(
        {
            'tsconfig.json': '{}',
            'A.ts': '',
            'b.ts': '',
            'c.ts': '',
            'D.ts': '',
        },
        {
            subdir: 'foo',
            initialState: state,
        },
    );
    t.deepEqual(programState.getUpToDateResult(cwd + 'A.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'b.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'c.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'D.ts', '1234'), []);
});

test('can handle case-sensitive old state on case-insensitive system', (t) => {
    const state = generateOldState(
        '1234',
        {
            'tsconfig.json': '{}',
            'A.ts': '',
            'b.ts': '',
        },
        {
            caseSensitive: true,
        },
    );
    const {programState, cwd} = setup(
        {
            'tsconfig.json': '{}',
            'a.ts': '',
            'b.ts': '',
        },
        {
            caseSensitive: false,
            initialState: state,
        },
    );
    t.deepEqual(programState.getUpToDateResult(cwd + 'a.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'b.ts', '1234'), []);
});

test('can handle case-insensitive old state on case-sensitive system', (t) => {
    const state = generateOldState(
        '1234',
        {
            'tsconfig.json': '{}',
            'a.ts': '',
            'b.ts': '',
        },
        {
            caseSensitive: false,
        },
    );
    const {programState, cwd} = setup(
        {
            'tsconfig.json': '{}',
            'A.ts': '',
            'b.ts': '',
        },
        {
            caseSensitive: true,
            initialState: state,
        },
    );
    t.deepEqual(programState.getUpToDateResult(cwd + 'A.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'b.ts', '1234'), []);
});

test("doesn't discard results from old state", (t) => {
    const state = generateOldState(
        '1234',
        {
            'tsconfig.json': '{}',
            'a.ts': 'export {};',
            'b.ts': 'export {};',
            'c.ts': 'var v;',
        },
    );
    let {programState, cwd, persistence, vol, program, compilerHost} = setup(
        {
            'tsconfig.json': '{}',
            'a.ts': 'export {};',
            'b.ts': 'export {};',
            'c.ts': 'var v;',
        },
        {
            initialState: state,
        },
    );

    persistence.saveState = (_, s) => t.deepEqual(s, state);
    programState.save();

    vol.writeFileSync(cwd + 'b.ts', 'import "./c";');
    program = ts.createProgram({
        oldProgram: program,
        options: program.getCompilerOptions(),
        rootNames: program.getRootFileNames(),
        host: compilerHost,
    });
    programState.update(program, cwd + 'b.ts');

    persistence.saveState = (_, {ts: _ts, ...rest}) => t.snapshot(yaml.dump(rest, {sortKeys: true}));
    programState.save();

    vol.writeFileSync(cwd + 'c.ts', 'var v = 1;');
    program = ts.createProgram({
        oldProgram: program,
        options: program.getCompilerOptions(),
        rootNames: program.getRootFileNames(),
        host: compilerHost,
    });
    programState.update(program, cwd + 'c.ts');

    programState.save();
});

test('uses relative paths for compilerOptions', (t) => {
    const files = {
        'tsconfig.json': JSON.stringify({compilerOptions: {outDir: './dist', rootDirs: ['./src', './lib']}}),
        'a.ts': '',
    };
    const state = generateOldState('', files, {subdir: 'a'});
    t.deepEqual(generateOldState('', files, {subdir: 'b/c'}), state);

    t.notDeepEqual(
        generateOldState('', {
            'tsconfig.json': JSON.stringify({compilerOptions: {outDir: './out', rootDirs: ['./src', './lib']}}),
            'a.ts': '',
        }, {subdir: 'a'}),
        state,
    );
});

test('handles assumeChangesOnlyAffectDirectDependencies', (t) => {
    const state = generateOldState('1234', {
        'tsconfig.json': JSON.stringify({compilerOptions: {assumeChangesOnlyAffectDirectDependencies: true}}),
        'a.ts': 'import "./b";',
        'b.ts': 'import "./c";',
        'c.ts': 'export {};',
        'global.ts': 'declare global {}; import "./b";',
    });

    const {programState, cwd} = setup(
        {
            'tsconfig.json': JSON.stringify({compilerOptions: {assumeChangesOnlyAffectDirectDependencies: true}}),
            'a.ts': 'import "./b";',
            'b.ts': 'import "./c";',
            'c.ts': 'export {}; foo;', // <-- change here
            'global.ts': 'declare global {}; import "./b";',
        },
        {
            initialState: state,
        },
    );
    t.deepEqual(programState.getUpToDateResult(cwd + 'a.ts', '1234'), []);
    t.is(programState.getUpToDateResult(cwd + 'b.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'c.ts', '1234'), undefined);
    t.deepEqual(programState.getUpToDateResult(cwd + 'global.ts', '1234'), []);
});

test('handles circular dependencies', (t) => {
    const files = {
        'tsconfig.json': '{}',
        'a.ts': 'import "./b"; import "./c"; import "./d"; import "./e";',
        'b.ts': 'import "./a"; import "./c"; import "./d";',
        'c.ts': 'import "./d";',
        'd.ts': 'import "./b"; import "./e";',
        'e.ts': 'export {};',
    };
    const state = generateOldState('1234', files);

    let {programState, cwd, vol, program, compilerHost, persistence} = setup(files, {initialState: state});

    t.deepEqual(programState.getUpToDateResult(cwd + 'a.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'b.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'c.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'd.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'e.ts', '1234'), []);

    vol.appendFileSync(cwd + 'c.ts', 'foo;');
    program = ts.createProgram({
        oldProgram: program,
        options: program.getCompilerOptions(),
        rootNames: program.getRootFileNames(),
        host: compilerHost,
    });
    programState.update(program, cwd + 'c.ts');

    t.is(programState.getUpToDateResult(cwd + 'a.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'b.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'c.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'd.ts', '1234'), undefined);
    t.deepEqual(programState.getUpToDateResult(cwd + 'e.ts', '1234'), []);

    persistence.saveState = (_, {ts: _ts, ...rest}) => t.snapshot(yaml.dump(rest, {sortKeys: true}));
    programState.save();
});
