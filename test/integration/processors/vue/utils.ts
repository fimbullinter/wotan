export function doStuff() {
    return 'foo';
}

export async function doOtherStuff() {
    await doStuff();
}
