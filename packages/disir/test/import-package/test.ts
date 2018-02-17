import {Linter} from '../../../wotan/src/linter';
import {Failure} from '../../../../packages/wotan';
import {AbstractRule} from '@fimbul/wotan';
import {Rule} from '../../src/rules/import-package';
import foo from 'packages/something/foo';
import self from './test';
import heimdall = require('../../../heimdall');
export * from '../../../bifrost';
