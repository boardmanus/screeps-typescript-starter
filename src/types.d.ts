// type shim for nodejs' `require()` syntax
declare const require: (module: string) => any;

declare module "*.json" {
  const value: any;
  export default value;
}
