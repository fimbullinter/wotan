import { X } from "./x";

// this needs two fixer runs and ensures it still resolves to 'x.d.ts' instead of 'x.ts'
<string><string>new X().prop;
