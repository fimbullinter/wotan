import { injectable } from 'inversify';
import { BuiltinResolver, Resolver } from '@fimbul/ymir';
import * as path from 'path';
import { OFFSET_TO_NODE_MODULES } from '../../utils';

@injectable()
export class DefaultBuiltinResolver implements BuiltinResolver {
    private get builtinPackagePath() {
        const resolved = path.dirname(
            this.resolver.resolve('@fimbul/mimir', path.join(__dirname, '../'.repeat(OFFSET_TO_NODE_MODULES)), []),
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
