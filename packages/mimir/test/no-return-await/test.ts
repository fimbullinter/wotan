declare let x: Promise<any>;
async function foo() {
    return await x;
}
(async () => await x);

async function avoidDuplicateErrorsCausedByComments() {
    return ( // return await
        await x
    );
    return /* => await */ await x;
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
        return await x; // not allowed in catch when there is no finally
    }
}
async function allowedInsideTryFinally() {
    try {
        return await x;
    } finally {
        // do cleanup, close connection for example
        return await x; // not allowed in finally at all
    }
}
async function allowedInsideCatchFinally() {
    try {
        return await x;
    } catch (e) {
        return await x;
    } finally {
        return await x;
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
            return await x;
        }
    }
}

async function handleParens() {
    return (await x);
}
async function handleBinaryExpression() {
    return await foo() || await x;
    return await foo() && await x;
    return await foo(), await x;
    return await foo() + await x;
}
async function handleConditionalExpression() {
    return await foo() ? await x : await x;
}

throw await x;
await x;
return await x;

try {
    (async () => await x)();
} catch {
    return await foo();
}

async () => await {foo: 1};
async () => await {foo: 1}['foo'];
async () => await {fn(...args: any[]){}}.fn`str`;

async function parensWhenNecessary() {
    if (Boolean())
        return await {prop: 1}.prop;
    if (!Boolean())
        return await function() {return 1;}();
    return await {foo: 1};
}
