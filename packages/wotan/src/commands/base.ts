import { LintOptions } from '../runner';
import { Format } from '@fimbul/ymir';
import { injectable } from 'inversify';

export const enum CommandName {
    Lint = 'lint',
    Save = 'save',
    Validate = 'validate',
    Show = 'show',
    Test = 'test',
}

export interface BaseCommand<C extends CommandName> {
    command: C;
    modules: ReadonlyArray<string>;
}

export interface BaseLintCommand<T extends CommandName.Lint | CommandName.Save> extends LintOptions, BaseCommand<T> {
    formatter: string | undefined;
}
export type LintCommand = BaseLintCommand<CommandName.Lint>;
export type SaveCommand = BaseLintCommand<CommandName.Save>;

export interface TestCommand extends BaseCommand<CommandName.Test> {
    files: string[];
    updateBaselines: boolean;
    bail: boolean;
    exact: boolean;
}

export interface ValidateCommand extends BaseCommand<CommandName.Validate> {
    files: string[];
}

export interface ShowCommand extends BaseCommand<CommandName.Show> {
    file: string;
    format: Format | undefined;
    config: string | undefined;
}

export type Command = LintCommand | SaveCommand | ShowCommand | ValidateCommand | TestCommand;

@injectable()
export abstract class AbstractCommandRunner {
    public abstract run(command: Command): boolean | Promise<boolean>;
}
