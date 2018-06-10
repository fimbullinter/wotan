import {foo: fn} from './other';
foo: bar: <string>fn(); // should not be autofixed
