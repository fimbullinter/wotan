export {};
namespace foo {
    'use strict';
    "use strict";
    foo;
    'use strict';
}

var C = class {
    get prop() {
        'use strict';
        return 1;
    }
};

const obj = {
    get prop() {
        'use strict';
        return 1;
    },
};
