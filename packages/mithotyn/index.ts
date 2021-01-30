/// <reference types="typescript/lib/tsserverlibrary" />

import mockRequire = require('mock-require');

const init: ts.server.PluginModuleFactory = ({typescript}) => {
    let plugin: Partial<import('@fimbul/wotan/language-service').LanguageServiceInterceptor> = {};
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
            if (lsPlugin.version !== '1') // in case we need to make breaking changes to the plugin API
                throw new Error(`Unsupported version of '@fimbul/wotan'. Consider updating '${config.name}'.`);
            log('setting up plugin');
            plugin = new lsPlugin.LanguageServiceInterceptor(config, project, serverHost, languageService, r, log);
            const proxy = createProxy(languageService, plugin, log);
            if (!('getSupportedCodeFixes' in languageService) && typeof plugin.getSupportedCodeFixes === 'function') {
                // TODO avoid monkey-patching: https://github.com/Microsoft/TypeScript/issues/28966#issuecomment-446729292
                const oldGetSupportedCodeFixes = typescript.getSupportedCodeFixes;
                typescript.getSupportedCodeFixes = () => plugin.getSupportedCodeFixes!(oldGetSupportedCodeFixes());
            }
            return proxy;

            function log(message: string) {
                logger.info(`[${config.name}] ${message}`);
            }
            function r(id: string) {
                let lastMessage!: string;
                const required = typescript.server.Project.resolveModule(
                    id,
                    project.getCurrentDirectory(), // TODO require should be relative to the location of the linter
                    serverHost,
                    (message) => {
                        lastMessage = message;
                        log(message);
                    },
                );
                if (required === undefined)
                    throw new Error(lastMessage);
                return required;
            }
        },
    };
};

export = init;

function createProxy(
    ls: ts.LanguageService,
    interceptor: Partial<import('@fimbul/wotan/language-service').PartialLanguageServiceInterceptor>,
    log: (m: string) => void,
) {
    const proxy = Object.create(null);
    for (const method of Object.keys(ls)) {
        if (typeof (<any>interceptor)[method] === 'function') {
            proxy[method] = (...args: any[]) => {
                const prev = (<any>ls)[method](...args);
                try {
                    return (<any>interceptor)[method](prev, ...args);
                } catch (e) {
                    log(`interceptor for '${method}' failed: ${e && e.message}`);
                    return prev;
                }
            };
        } else {
            proxy[method] = (<any>ls)[method].bind(ls);
        }
    }
    return proxy;
}
