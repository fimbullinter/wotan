import { foo, bas } from './index';
import { bar as renamedBar } from './other';
import { getPackageName } from '../../src/util';
import {baz} from './index';
import * as ns from '@fimbul/disir';
                    ~~~~~~~~~~~~~~~  [error local/no-import-self: Import directly from the module containing the declaration instead of '@fimbul/disir'.]
import '@fimbul/disir';
       ~~~~~~~~~~~~~~~  [error local/no-import-self: Import directly from the module containing the declaration instead of '@fimbul/disir'.]

export * from '@fimbul/disir';
              ~~~~~~~~~~~~~~~  [error local/no-import-self: Import directly from the module containing the declaration instead of '@fimbul/disir'.]
