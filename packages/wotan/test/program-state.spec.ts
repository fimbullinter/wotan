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
import { ContentHasher } from '../src/services/default/content-hasher';

function identity<T>(v: T) {
    return v;
}

function setup(
    fileContents: DirectoryJSON,
    options: {subdir?: string, initialState?: StaticProgramState, caseSensitive?: boolean, symlinks?: ReadonlyArray<[string, string]>} = {},
) {
    const {root} = path.parse(unixifyPath(process.cwd()));
    const cwd = options.subdir ? unixifyPath(path.join(root, options.subdir)) + '/' : root;
    const vol = Volume.fromJSON(fileContents, cwd);
    if (options.symlinks)
        for (const [from, to] of options.symlinks)
            vol.symlinkSync(cwd + to, cwd + from);

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
        realpath(f) {
            return root + (<string>vol.realpathSync(f, {encoding: 'utf8'})).substr(1);
        },
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
    const factory = new ProgramStateFactory(new DependencyResolverFactory(), persistence, new ContentHasher());
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

function prepareForSnapshot({ts: _ts, ...rest}: StaticProgramState) {
    return yaml.dump(rest, {sortKeys: true});
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
        t.is(state.ts, ts.version);
        t.snapshot(prepareForSnapshot(state));
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

    programState.setFileResult(cwd + 'e.ts', '1234', []);

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

    persistence.saveState = () => t.fail('should not save without changes');
    programState.save();

    vol.writeFileSync(cwd + 'b.ts', 'import "./c";');
    program = ts.createProgram({
        oldProgram: program,
        options: program.getCompilerOptions(),
        rootNames: program.getRootFileNames(),
        host: compilerHost,
    });
    programState.update(program, cwd + 'b.ts');

    programState.setFileResult(cwd + 'b.ts', '5678', []);

    persistence.saveState = (_, s) => t.snapshot(prepareForSnapshot(s));
    programState.save();

    vol.writeFileSync(cwd + 'c.ts', 'var v = 1;');
    program = ts.createProgram({
        oldProgram: program,
        options: program.getCompilerOptions(),
        rootNames: program.getRootFileNames(),
        host: compilerHost,
    });
    programState.update(program, cwd + 'c.ts');

    programState.setFileResult(cwd + 'c.ts', '5678', []);

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
        'root.ts': 'import "./a";',
        'a.ts': 'import "./e"; import "./d"; import "./c"; import "./b";',
        'b.ts': 'import "./d"; import "./c"; import "./a";',
        'c.ts': 'import "./d";',
        'd.ts': 'import "./e"; import "./b";',
        'e.ts': 'export {};',
    };
    const state = generateOldState('1234', files);

    let {programState, cwd, vol, program, compilerHost, persistence} = setup(files, {initialState: state});

    t.deepEqual(programState.getUpToDateResult(cwd + 'root.ts', '1234'), []);
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

    t.is(programState.getUpToDateResult(cwd + 'root.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'a.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'b.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'c.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'd.ts', '1234'), undefined);
    t.deepEqual(programState.getUpToDateResult(cwd + 'e.ts', '1234'), []);

    programState.setFileResult(cwd + 'c.ts', '5678', []);
    persistence.saveState = (_, s) => t.snapshot(prepareForSnapshot(s));
    programState.save();
});

test('handles multiple level of circular dependencies', (t) => {
    const files = {
        'tsconfig.json': '{}',
        'a.ts': 'import "./c"; import "./b";',
        'b.ts': 'import "./a";',
        'c.ts': 'import "./e"; import "./d";',
        'd.ts': 'import "./c";',
        'e.ts': 'import "./f";',
        'f.ts': 'import "./d";',
    };
    const state = generateOldState('1234', files);

    let {programState, cwd, vol, program, compilerHost} = setup(files, {initialState: state});

    t.deepEqual(programState.getUpToDateResult(cwd + 'a.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'b.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'c.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'd.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'e.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'f.ts', '1234'), []);

    vol.appendFileSync(cwd + 'b.ts', 'foo;');
    program = ts.createProgram({
        oldProgram: program,
        options: program.getCompilerOptions(),
        rootNames: program.getRootFileNames(),
        host: compilerHost,
    });
    programState.update(program, cwd + 'b.ts');

    t.is(programState.getUpToDateResult(cwd + 'a.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'b.ts', '1234'), undefined);
    t.deepEqual(programState.getUpToDateResult(cwd + 'c.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'd.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'e.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'f.ts', '1234'), []);

    ({programState, cwd, vol, program, compilerHost} = setup(files, {initialState: state}));
    vol.appendFileSync(cwd + 'f.ts', 'foo;');
    program = ts.createProgram({
        oldProgram: program,
        options: program.getCompilerOptions(),
        rootNames: program.getRootFileNames(),
        host: compilerHost,
    });
    programState.update(program, cwd + 'f.ts');
    t.is(programState.getUpToDateResult(cwd + 'a.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'b.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'c.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'd.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'e.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'f.ts', '1234'), undefined);
});

test('merges multiple level of circular dependencies', (t) => {
    const files = {
        'tsconfig.json': '{}',
        'a.ts': 'import "./c"; import "./b";',
        'b.ts': 'import "./a";',
        'c.ts': 'import "./e"; import "./d";',
        'd.ts': 'import "./c";',
        'e.ts': 'import "./f";',
        'f.ts': 'import "./g"; import "./b";',
        'g.ts': 'export {};',
    };
    const state = generateOldState('1234', files);

    let {programState, cwd, vol, program, compilerHost} = setup(files, {initialState: state});

    t.deepEqual(programState.getUpToDateResult(cwd + 'a.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'b.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'c.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'd.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'e.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'f.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'g.ts', '1234'), []);

    vol.appendFileSync(cwd + 'g.ts', 'foo;');
    program = ts.createProgram({
        oldProgram: program,
        options: program.getCompilerOptions(),
        rootNames: program.getRootFileNames(),
        host: compilerHost,
    });
    programState.update(program, cwd + 'g.ts');

    t.is(programState.getUpToDateResult(cwd + 'a.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'b.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'c.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'd.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'e.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'f.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'g.ts', '1234'), undefined);
});

test('merges multiple level of circular dependencies II', (t) => {
    const files = {
        'tsconfig.json': '{}',
        'a.ts': 'import "./e"; import "./b"; import "./a1";',
        'a1.ts': 'import "./a";',
        'b.ts':  'import "./b1";',
        'b1.ts': 'import "./c"; import "./b2"; import "./b";',
        'c.ts': 'import "./d";',
        'd.ts': 'import "./d2"; import "./d1";',
        'd1.ts': 'import "./d";',
        'd2.ts': 'import "./a";',
        'e.ts': 'export {};',
    };
    const state = generateOldState('1234', files);

    let {programState, cwd, vol, program, compilerHost} = setup(files, {initialState: state});

    t.deepEqual(programState.getUpToDateResult(cwd + 'a.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'a1.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'b.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'b1.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'c.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'd.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'd1.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'd2.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'e.ts', '1234'), []);

    vol.appendFileSync(cwd + 'e.ts', 'foo;');
    program = ts.createProgram({
        oldProgram: program,
        options: program.getCompilerOptions(),
        rootNames: program.getRootFileNames(),
        host: compilerHost,
    });
    programState.update(program, cwd + 'e.ts');

    t.is(programState.getUpToDateResult(cwd + 'a.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'a1.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'b.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'b1.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'c.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'd.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'd1.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'd2.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'e.ts', '1234'), undefined);
});

test('uses earliest circular dependency', (t) => {
    const files = {
        'tsconfig.json': '{}',
        'a.ts': 'import "./b"; import "./a1";',
        'a1.ts': 'import "./a2";',
        'a2.ts': 'import "./a3";',
        'a3.ts':  'import "./a1"; import "./a"; import "./a2";',
        'b.ts':  'export {};',
    };
    const state = generateOldState('1234', files);

    let {programState, cwd, vol, program, compilerHost} = setup(files, {initialState: state});

    t.deepEqual(programState.getUpToDateResult(cwd + 'a.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'a1.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'a2.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'a3.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'b.ts', '1234'), []);

    vol.appendFileSync(cwd + 'b.ts', 'foo;');
    program = ts.createProgram({
        oldProgram: program,
        options: program.getCompilerOptions(),
        rootNames: program.getRootFileNames(),
        host: compilerHost,
    });
    programState.update(program, cwd + 'b.ts');

    t.is(programState.getUpToDateResult(cwd + 'a.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'a1.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'a2.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'a3.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'b.ts', '1234'), undefined);
});

test('detects when all files are still the same, but resolution changed', (t) => {
    const files = {
        'tsconfig.json': JSON.stringify({exclude: ['deps'], compilerOptions: {moduleResolution: 'node'}}),
        'a.ts': 'import "x"; import "y";',
        'deps/x/index.ts': 'export let x;',
        'deps/y/index.ts': 'export let y;',
        'node_modules': null,
    };
    const state = generateOldState('1234', files, {symlinks: [
        ['node_modules/x', 'deps/x'],
        ['node_modules/y', 'deps/y'],
    ]});

    let {programState, cwd} = setup(files, {initialState: state, symlinks: [
        ['node_modules/x', 'deps/x'],
        ['node_modules/y', 'deps/y'],
    ]});

    t.deepEqual(programState.getUpToDateResult(cwd + 'a.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'deps/x/index.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'deps/y/index.ts', '1234'), []);

    ({programState, cwd} = setup(files, {initialState: state, symlinks: [
        ['node_modules/x', 'deps/y'],
        ['node_modules/y', 'deps/x'],
    ]}));

    t.is(programState.getUpToDateResult(cwd + 'a.ts', '1234'), undefined);
    t.deepEqual(programState.getUpToDateResult(cwd + 'deps/x/index.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'deps/y/index.ts', '1234'), []);
});

test('detects added module augmentation', (t) => {
    const files = {
        'tsconfig.json': '{}',
        'a.ts': 'export {};',
        'b.ts': 'export {};',
        'c.ts': 'import "./a";',
    };
    const state = generateOldState('1234', files);

    let {programState, cwd, vol, program, compilerHost} = setup(files, {initialState: state});

    t.deepEqual(programState.getUpToDateResult(cwd + 'a.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'b.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'c.ts', '1234'), []);

    vol.appendFileSync(cwd + 'b.ts', 'declare module "./a" {};');
    program = ts.createProgram({
        oldProgram: program,
        options: program.getCompilerOptions(),
        rootNames: program.getRootFileNames(),
        host: compilerHost,
    });
    programState.update(program, cwd + 'b.ts');

    t.is(programState.getUpToDateResult(cwd + 'a.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'b.ts', '1234'), undefined);
    t.is(programState.getUpToDateResult(cwd + 'c.ts', '1234'), undefined);
});

test('changes in unresolved dependencies', (t) => {
    const files = {
        'tsconfig.json': '{}',
        'a.ts': 'import "x";',
        'b.ts': 'import "y";',
        'c.ts': 'declare module "x";',
    };
    const state = generateOldState('1234', files);

    let {programState, cwd, vol, program, compilerHost} = setup(files, {initialState: state});

    t.deepEqual(programState.getUpToDateResult(cwd + 'a.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'b.ts', '1234'), []);
    t.deepEqual(programState.getUpToDateResult(cwd + 'c.ts', '1234'), []);

    vol.writeFileSync(cwd + 'c.ts', 'declare module "y";');
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
});

test("doesn't throw if resolved file is not in project", (t) => {
    const files = {
        'tsconfig.json': '{}',
        'a.ts': 'import "./tsconfig.json"; import "./b.js";',
        'b.js': 'export {}',
    };
    const state = generateOldState('1234', files);
    t.snapshot(prepareForSnapshot(state));

    const {programState, cwd} = setup(files, {initialState: state});
    t.deepEqual(programState.getUpToDateResult(cwd + 'a.ts', '1234'), []);
});
