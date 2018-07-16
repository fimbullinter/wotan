namespace foo {
    'use strict';
    'use\u0020strict';
    '\'use strict';
    'use strict';
    "use strict";
    foo;
    'use strict';

    function fn() {
        'use strict';
    }
    function fn2() {
        fn();
        'use strict';
    }
    class Foo {
        constructor() {
            "use strict";
        }
        method() {
            if (Boolean())
                'use strict';
            else {
                "use strict";
            }
            return {
                m() {
                    'use strict';
                },
            };
        }
    }
}

class Foo {
    constructor() {
        "use strict";
    }
    method() {
        return {
            m() {
                'use strict';
            },
        };
    }
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
