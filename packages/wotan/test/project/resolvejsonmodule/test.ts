// makes sure JSON files are correctly resolved, but excluded from linting
import data = require('./data.json');

<boolean>data.foo;
<string>data.bar;
<any>data.baz;
