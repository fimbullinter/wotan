import * as ts from 'typescript';
export declare type PartialLanguageServiceInterceptor = {
    [K in keyof ts.LanguageService]?: ts.LanguageService[K] extends (...args: infer Parameters) => infer Return ? (prev: Return, ...args: Parameters) => Return : ts.LanguageService[K];
};
export declare const version = "1";
export declare class LanguageServiceInterceptor implements PartialLanguageServiceInterceptor {
    protected config: Record<string, unknown>;
    protected project: import('typescript/lib/tsserverlibrary').server.Project;
    protected serverHost: import('typescript/lib/tsserverlibrary').server.ServerHost;
    protected languageService: ts.LanguageService;
    protected require: (id: string) => {};
    protected log: (message: string) => void;
    getExternalFiles?: () => string[];
    constructor(config: Record<string, unknown>, project: import('typescript/lib/tsserverlibrary').server.Project, serverHost: import('typescript/lib/tsserverlibrary').server.ServerHost, languageService: ts.LanguageService, require: (id: string) => {}, log: (message: string) => void);
    updateConfig(config: Record<string, unknown>): void;
    getSemanticDiagnostics(diagnostics: ts.Diagnostic[], fileName: string): ts.Diagnostic[];
    getSupportedCodeFixes(fixes: string[]): string[];
    dispose(): void;
}
