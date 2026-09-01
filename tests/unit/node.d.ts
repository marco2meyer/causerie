/** The app targets the browser and its tsconfig carries no node typings, but a couple of
 *  tests need to read a source file off the disk. One declaration of what they actually
 *  call is cheaper than pulling @types/node into a browser project. */
declare module 'node:fs' {
  export function readFileSync(path: string | URL, encoding: 'utf8'): string;
}
declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}
