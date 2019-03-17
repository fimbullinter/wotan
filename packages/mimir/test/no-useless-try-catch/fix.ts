if (Boolean())
    try {} finally {}

for (; Boolean();)
    try {} finally {
        console.log('a');
        console.log('b');
    }

while (Boolean())
    try {
        console.log('a');
        console.log('b');
    } catch (e) {
        throw e;
    }

do
    try {} finally {}
while (Boolean());

if (Boolean())
    try {} finally {console.log('a');}

if (Boolean())
    try {} finally {class C {}}

if (Boolean()) {
    try {} finally {
        console.log('a');
        console.log('b');
    }
}

let foo = 1;
if (Boolean()) {
    console.log(foo);
    try {} finally {
        const foo = 1;
        console.log(foo);
    }
}

if (Boolean()) {
    try {
        const foo = 1; // TODO doesn't shadow a variable in the outer scope
        console.log(foo);
    } finally {}
}

label: try {} catch {}
