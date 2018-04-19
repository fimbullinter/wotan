declare let x: Promise<any>;
async function foo() {
    return x;
}
(async () => x);

async function avoidDuplicateErrorsCausedByComments() {
    return ( // return await
        x
    );
    return /* => await */ x;
}
async function allowTypeAssertion() {
    return (await x)!;
    return (await x as number);
    return <string> await x;
}
async function allowedInsideTryCatch() {
    try {
        return await x;
    } catch (e) {
        // handle error
        return x; // not allowed in catch when there is no finally
    }
}
async function allowedInsideTryFinally() {
    try {
        return await x;
    } finally {
        // do cleanup, close connection for example
        return x; // not allowed in finally at all
    }
}
async function allowedInsideCatchFinally() {
    try {
        return await x;
    } catch (e) {
        return await x;
    } finally {
        return x;
    }
}
async function nestedTryStatements() {
    try {
        try {
            return await x;
        } catch (e) {
            return await x;
        } finally {
            return await x;
        }
    } catch(e) {
        try {
            return await x;
        } catch (e) {
            return await x;
        } finally {
            return await x;
        }
    } finally {
        try {
            return await x;
        } catch (e) {
            return await x;
        } finally {
            return x;
        }
    }
}

async function handleParens() {
    return (x);
}
async function handleBinaryExpression() {
    return await foo() || x;
    return await foo() && x;
    return await foo(), x;
    return await foo() + await x;
}
async function handleConditionalExpression() {
    return await foo() ? x : x;
}

throw await x;
await x;
return x;

try {
    (async () => x)();
} catch {
    return foo();
}

async () => {foo: 1};
