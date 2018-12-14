import { injectable } from 'inversify';
import { BuiltinResolver, Resolver } from '@fimbul/ymir';
import * as path from 'path';

@injectable()
export class DefaultBuiltinResolver implements BuiltinResolver {
    private get builtinPackagePath() {
        const resolved = path.dirname(
            this.resolver.resolve('@fimbul/mimir', path.join(__dirname, '../'.repeat(/*offset to package root*/ 3)), []),
        );
        Object.defineProperty(this, 'builtinPackagePath', {value: resolved});

        return resolved;
    }

    constructor(private resolver: Resolver) {}

    public resolveConfig(name: string) {
        return path.join(this.builtinPackagePath, name + '.yaml');
    }

    public resolveRule(name: string) {
        return path.join(this.builtinPackagePath, `src/rules/${name}.js`);
    }

    public resolveFormatter(name: string) {
        return path.join(this.builtinPackagePath, `src/formatters/${name}.js`);
    }
}
