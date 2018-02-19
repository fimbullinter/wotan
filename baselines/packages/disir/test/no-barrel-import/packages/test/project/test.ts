import {baz} from './other';
import {bas} from './other';

import {foo as otherFoo} from './other';
import {bar as otherBar} from './other';
import {foo} from './subdir';
import {bar} from './subdir/index';

export * from '.';
              ~~~  [error local/no-barrel-import: Import directly from the module containing the declaration instead of the barrel.]
export * from '@fimbul/wotan';
