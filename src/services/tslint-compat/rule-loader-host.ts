import { NodeRuleLoader } from '../default/rule-loader-host';
import * as Lint from 'tslint';
import { injectable } from 'inversify';
import { AbstractRule, RuleContext, RuleConstructor } from '../../types';
import * as ts from 'typescript';
import { arrayify } from '../../utils';

@injectable()
export class TslintRuleLoader extends NodeRuleLoader {
    public loadCustomRule(name: string, dir: string): RuleConstructor | undefined {
        const rule = super.loadCustomRule(name, dir);
        if (rule !== undefined)
            return rule;
        const tslintRule = Lint.findRule(name, dir);
        return tslintRule && wrapTslintRule(tslintRule, name);
    }
}

function wrapTslintRule(rule: Lint.RuleConstructor, name: string) {
    return class extends AbstractRule {
        public static requiresTypeInformation =
            !!(rule.metadata && rule.metadata.requiresTypeInfo) ||
            rule.prototype instanceof Lint.Rules.TypedRule;

        public static supports(sourceFile: ts.SourceFile) {
            if (rule.metadata && rule.metadata.typescriptOnly)
                return /\.tsx?$/.test(sourceFile.fileName);
            return true;
        }

        private delegate: Lint.IRule;

        constructor(context: RuleContext) {
            super(context);
            this.delegate = new rule({
                ruleArguments: [true, ...arrayify(context.options)],
                ruleSeverity: 'error',
                ruleName: name,
                disabledIntervals: [],
            });
        }

        public apply() {
            let result: Lint.RuleFailure[];
            if (this.program !== undefined && Lint.isTypedRule(this.delegate)) {
                result = this.delegate.applyWithProgram(this.sourceFile, this.program);
            } else {
                result = this.delegate.apply(this.sourceFile);
            }
            for (const failure of result)
                this.addFailure(
                    failure.getStartPosition().getPosition(),
                    failure.getEndPosition().getPosition(),
                    failure.getFailure(),
                    arrayify(failure.getFix()).map((r) => ({start: r.start, end: r.end, text: r.text})),
                );
        }
    };
}
