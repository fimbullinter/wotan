import * as ts from 'typescript';
export declare const version = "2";
export declare class LanguageServiceInterceptor implements Partial<ts.LanguageService> {
    protected config: Record<string, unknown>;
    protected project: import('typescript/lib/tsserverlibrary').server.Project;
    protected serverHost: import('typescript/lib/tsserverlibrary').server.ServerHost;
    protected languageService: ts.LanguageService;
    protected require: (id: string) => {};
    protected log: (message: string) => void;
    getExternalFiles?: () => string[];
    constructor(config: Record<string, unknown>, project: import('typescript/lib/tsserverlibrary').server.Project, serverHost: import('typescript/lib/tsserverlibrary').server.ServerHost, languageService: ts.LanguageService, require: (id: string) => {}, log: (message: string) => void);
    updateConfig(config: Record<string, unknown>): void;
    getSemanticDiagnostics(fileName: string): ts.Diagnostic[];
    getSuggestionDiagnostics(fileName: string): ts.DiagnosticWithLocation[];
    getCodeFixesAtPosition(fileName: string, start: number, end: number, errorCodes: readonly number[], formatOptions: ts.FormatCodeSettings, preferences: ts.UserPreferences): readonly ts.CodeFixAction[];
    getCombinedCodeFix(scope: ts.CombinedCodeFixScope, fixId: {}, formatOptions: ts.FormatCodeSettings, preferences: ts.UserPreferences): ts.CombinedCodeActions;
    getSupportedCodeFixes(fixes: string[]): string[];
    cleanupSemanticCache(): void;
    dispose(): void;
}
