// TODO remove once https://github.com/microsoft/TypeScript/issues/41808 is fixed
interface ArrayConstructor {
    isArray(arg: any): arg is readonly any[];
}
