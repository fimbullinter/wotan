import { foo, bas } from './index.ts';
import { bar as renamedBar } from './other.ts';
import { getPackageName } from '../../src/util.ts';
import {baz} from './index.ts';
import * as ns from '@fimbul/disir';
                    ~~~~~~~~~~~~~~~  [error local/no-import-self: Import directly from the module containing the declaration instead of '@fimbul/disir'.]
import '@fimbul/disir';
       ~~~~~~~~~~~~~~~  [error local/no-import-self: Import directly from the module containing the declaration instead of '@fimbul/disir'.]

export * from '@fimbul/disir';
              ~~~~~~~~~~~~~~~  [error local/no-import-self: Import directly from the module containing the declaration instead of '@fimbul/disir'.]
