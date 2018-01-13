export async function foo() {
    foo: let bar = '1';
    debugger;
    return await bar;
}
