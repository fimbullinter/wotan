import { RuleConstructor, FormatterConstructor } from '@fimbul/wotan';
import * as TSLint from 'tslint';
export declare function wrapTslintRule(Rule: TSLint.RuleConstructor, name: string): RuleConstructor;
export declare function wrapTslintFormatter(Formatter: TSLint.FormatterConstructor): FormatterConstructor;
