import { foo } from '../src/foo';

// this ensures `../src/foo.ts` is kept around after linting  `../src/tsconfig.json`
// it removes the assertion in that file which in turn causes the assertion below to be redundant
<string>foo;
