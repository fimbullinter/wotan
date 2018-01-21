import {bar as fn} from './other';
bar: fn();
~~~        [error no-unused-label: Unused label 'bar'.]
     ~~~~  [error deprecation: CallSignature '(): void' is deprecated: bar ]
