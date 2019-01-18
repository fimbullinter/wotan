try {
    console.log('try');
} catch {
} finally {
    console.log('finally');
}

try {
    console.log('try');
} finally {
    console.log('finally');
}

try {
    console.log('try');
} finally {}

try {
    console.log('try');
} catch {
} finally {}

try {
} catch {}

try {
} catch {
    console.log('catch');
} finally {}

try {
} catch {
    console.log('catch');
} finally {
    console.log('finally');
}

try {
} finally {}

try {
} finally {
    console.log('finally');
}

try {
    console.log('try');
} catch (e) {
    throw e;
}

try {
    console.log('try');
} catch (e) {
    throw e;
} finally {}

try {
    console.log('try');
} catch (e) {
    throw e;
} finally {
    console.log('finally');
}

try {
    console.log('try');
} catch (e) {
    throw (e);
}

try {
    console.log('try');
} catch ({message}) {
    throw new Error(message);
}

try {
    console.log('try');
} catch (e) {
    console.log(e);
    throw e;
}

try {
    console.log('try');
} catch {
    throw e;
}

// try {}
try {
    console.log('try');
} catch (e) {
    throw err;
}

() => {
    try {
        console.log('try');
    } catch (e) {
        return e;
    }
}
