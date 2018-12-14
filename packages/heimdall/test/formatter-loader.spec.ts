import test from 'ava';
import { TslintFormatterLoaderHost } from '../src';
import { Resolver, AbstractFormatter } from '@fimbul/wotan';
import * as TSLint from 'tslint';
import * as path from 'path';

test('loads TSLint formatter if no wotan formatter is found', (t) => {
    class MyFormatter extends AbstractFormatter {
        public format() {
            return '';
        }
    }
    const resolver: Resolver = {
        getDefaultExtensions() {
            return [];
        },
        resolve() {
            return 'foo';
        },
        require() {
            return {Formatter: MyFormatter};
        },
    };
    const loader = new TslintFormatterLoaderHost(resolver, {
        resolveConfig() { throw new Error(); },
        resolveFormatter(name) { return path.join(__dirname, '../../mimir/src/formatters', name + '.js'); },
        resolveRule() { throw new Error(); },
    });
    t.is(loader.loadCustomFormatter('prose', ''), MyFormatter);

    resolver.resolve = () => {
        throw new Error();
    };
    const formatter = loader.loadCustomFormatter('prose', '');
    t.not(formatter, undefined);
    t.true((<any>new formatter!()).delegate instanceof TSLint.Formatters.ProseFormatter);

    t.is(loader.loadCustomFormatter('non-existent-formatter', ''), undefined);
});
