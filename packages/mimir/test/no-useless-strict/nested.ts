namespace foo {
    'use\u0020strict';
    '\'use strict';
    '"use strict"';
    // 'use strict'
    'use strict';
    'use strict';
    "use strict";
    `use strict`;
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
            console.log('use strict');
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
        obj;
        'use strict';
        return () => {
            'use strict';
            return () => {
                "use strict";
            }
        };
    },

    m() {
        return () => {
            'use strict';
        }
    },

    p: function() {
        'use\u0020strict';
        return () => {
            'use strict';
        }
    }
};
