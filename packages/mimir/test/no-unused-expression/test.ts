'use strict';
export {};
import 'foo';

'use strict';

let foo = 'foo';
foo = 'bar';
foo;
(foo);
(foo && fn());
'bar';
let bar = (foo, 'bar');

void foo;
void (foo);
void parseInt('');

function fn() {
    'use strict';
    ;
    'use asm';
    if (foo)
        return void(0);
    if (bar)
        return void bar;
    if (!bar)
        return void (bar = foo);
    return void 0;
    return void (foo === bar);
}

`foo`;
fn`foo`;

namespace ns {
    'use strict';
    foo;
}
namespace ns {
    foo;
    'use strict';
}

for (let i = 0; i < 10; ++i) {
    i++;
    i--;
    --i;
    if (i)
        continue;
    break;
}

let f = Boolean() ? fn : undefined;
f && f();
!f || f();
f!() && f;
!f();

foo as string;

switch (foo) {
    case bar:
        'use asm';
        0, eval;
        (0, eval);
        (1, eval)('foo');
        (0, eval)(foo);
        (0, 1, eval)(foo);
}

(function() {
    `use strict`;
});
(function() {
    ;
    'use strict';
})();
(function() {
    'use strict';
    ;
    'use asm';
}());
(() => {
    'use strict';
})();
{
    'use strict';
}

(async function() {
    await foo;
    await bar;
    await foo && await bar;
})();
(function*() {
    yield 1;
    yield yield;
    yield yield foo;
})();

class C {
    private _foo = this;
    get foo() {
        this._foo;
        return new C(), this;
        'use strict';
    }
    set foo(v) {
        'use strict';
        v;
        this._foo == v;
        i += 1;
    }

    method() {
        'use strict';
        'use asm';
        delete this._foo;
    }
}

new C();
new C;
new C().method();
new C().foo;

let i;
for (i; i < 10; i) {}
for (; i < 10;) {}

foo ? fn() : new C();
foo ? new C() : fn();
foo ? foo : bar;
foo = foo ? foo : bar;
foo ? fn() : fn();
