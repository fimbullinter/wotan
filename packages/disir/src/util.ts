export function getPackageName(fileName: string): string {
    const parts = fileName.split(/[/\\]/);
    return parts[parts.lastIndexOf('packages') + 1];
}
