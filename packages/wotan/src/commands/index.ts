import 'reflect-metadata';
import { GlobalOptions, ConfigurationError } from '@fimbul/ymir';
import { OFFSET_TO_NODE_MODULES } from '../utils';
import { Container, BindingScopeEnum, ContainerModule } from 'inversify';
import { createCoreModule } from '../di/core.module';
import { createDefaultModule } from '../di/default.module';
import * as resolve from 'resolve';
import debug = require('debug');
import { Command, AbstractCommandRunner } from './base';

export * from './base';

const log = debug('wotan:commands');

export async function runCommand(command: Command, diContainer?: Container, globalOptions: GlobalOptions = {}): Promise<boolean> {
    const container = new Container({defaultScope: BindingScopeEnum.Singleton});
    if (diContainer !== undefined)
        container.parent = diContainer;
    for (const moduleName of command.modules)
        container.load(loadModule(moduleName, globalOptions));

    container.load(require(`./${command.command}`).module);
    container.load(createCoreModule(globalOptions), createDefaultModule());
    const commandRunner = container.get(AbstractCommandRunner);
    return commandRunner.run(command);
}

function loadModule(moduleName: string, options: GlobalOptions) {
    log("Loading module '%s'.", moduleName);
    try {
        moduleName = resolve.sync(moduleName, {
            basedir: process.cwd(),
            extensions: Object.keys(require.extensions).filter((ext) => ext !== '.json' && ext !== '.node'),
            paths: module.paths.slice(OFFSET_TO_NODE_MODULES),
        });
    } catch (e) {
        throw new ConfigurationError(e.message);
    }
    log("Found module at '%s'.", moduleName);
    const m = <{createModule?(options: GlobalOptions): ContainerModule} | null | undefined>require(moduleName);
    if (!m || typeof m.createModule !== 'function')
        throw new ConfigurationError(`Module '${moduleName}' does not export a function 'createModule'.`);
    return m.createModule(options);
}
