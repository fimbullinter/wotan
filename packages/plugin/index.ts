/// <reference types="typescript/lib/tsserverlibrary" />

import mockRequire = require('mock-require');

const init: ts.server.PluginModuleFactory = ({typescript}) => {
    let plugin: Partial<import('@fimbul/wotan/language-service').LanguageServicePlugin> = {};
    return {
        getExternalFiles() {
            return typeof plugin.getExternalFiles === 'function' ? plugin.getExternalFiles() : [];
        },
        onConfigurationChanged(config) {
            if (typeof plugin.updateConfig === 'function')
                plugin.updateConfig(config);
        },
        create({project, serverHost, languageService, config}) {
            mockRequire('typescript', typescript); // force every library to use the TypeScript version of the LanguageServer
            const logger = project.projectService.logger;
            // always load locally installed linter
            const lsPlugin = <typeof import('@fimbul/wotan/language-service')>r('@fimbul/wotan/language-service');
            logger.info('setting up plugin');
            plugin = new lsPlugin.LanguageServicePlugin(
                config,
                project,
                serverHost,
                languageService,
                r,
                log,
            );
            return createProxy(languageService, plugin.createInterceptor!());

            function log(message: string) {
                logger.info(`[${config.name}] ${message}`);
            }
            function r(id: string) {
                const required = typescript.server.Project.resolveModule(
                    id,
                    project.getCurrentDirectory(),
                    serverHost,
                    log,
                );
                if (required === undefined)
                    throw new Error(`Error loading module '${id}'.`);
                return required;
            }
        },
    };
};

export = init;

function createProxy(ls: any, overrides: Partial<ts.LanguageService>) {
    const proxy = Object.create(null); // tslint:disable-line:no-null-keyword
    for (const method of Object.keys(ls))
        proxy[method] = method in overrides ? (<any>overrides)[method] : ls[method].bind(ls);
    return proxy;
}
