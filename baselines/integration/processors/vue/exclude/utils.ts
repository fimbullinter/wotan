export function doStuff() {
~nil                        [error local/extension: The extension of this file is: .ts]
    return 'foo';
}

export async function doOtherStuff() {
    doStuff();
}
