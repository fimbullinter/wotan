export {};
declare let x: Promise<string>;
function notAsync() {
    return;
    return x;
    try {
        return x;
    } catch {
        return x;
    } finally {
        return x;
    }
}
async function test() {
    return x;
    try {
        return;
        return await x;
        function nested() {
            return x;
        }
        return await x;
        return await (x);
        return (
            await x
        );
        return {
            fn() {
                return x;
            },
            get x() {
                return x;
            },
            async asyncFn() {
                return x;
            },
        };
        return await (await x || x);
        return await (x || await x);
        return await (x || await x);
        return x && await x;
        return await (Boolean() ? x : x);
        return await(Boolean() ? await x : x);
        return await (Boolean() ? x : await x);
        {
            for (;;) {
                return await x;
            }
        }
    } catch {
        return await x;
    } finally {
        return x;
    }
    try {
        return await x;
    } finally {
        return x;
    }
    try {
        return await x;
        try {
            return await x;
        } catch {
            return await x;
        }
        return await x;
        try {
            return await x;
        } finally {
            return await x;
        }
        return await x;
    } catch {
        return x;
        try {
            return await x;
        } catch {
            return x;
        }
        return x;
    }
    function nested() {
        try {
            return x;
        } catch {
            return x;
        }
    }
}
