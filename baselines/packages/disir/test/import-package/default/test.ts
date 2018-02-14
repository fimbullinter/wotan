import {Linter} from '@fimbul/wotan';
import {Failure} from '@fimbul/wotan';
import {AbstractRule} from '@fimbul/wotan';
import {Rule} from '../../src/rules/import-package';
import foo from 'packages/something/foo';
import self from './test';
import heimdall = require('@fimbul/heimdall');
export * from '@fimbul/bifrost';
