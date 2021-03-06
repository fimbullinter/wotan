import { Linter } from './linter';
import { LintResult, DirectoryService, MessageHandler, FileFilterFactory, Severity } from '@fimbul/ymir';
import { ProcessorLoader } from './services/processor-loader';
import { CachedFileSystem } from './services/cached-file-system';
import { ConfigurationManager } from './services/configuration-manager';
import { ProgramStateFactory } from './services/program-state';
export interface LintOptions {
    config: string | undefined;
    files: ReadonlyArray<string>;
    exclude: ReadonlyArray<string>;
    project: ReadonlyArray<string>;
    references: boolean;
    fix: boolean | number;
    extensions: ReadonlyArray<string> | undefined;
    reportUselessDirectives: Severity | boolean | undefined;
    cache: boolean;
}
export declare class Runner {
    constructor(fs: CachedFileSystem, configManager: ConfigurationManager, linter: Linter, processorLoader: ProcessorLoader, directories: DirectoryService, logger: MessageHandler, filterFactory: FileFilterFactory, programStateFactory: ProgramStateFactory);
    lintCollection(options: LintOptions): LintResult;
}
