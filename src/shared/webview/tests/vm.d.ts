// The injected-script tests run it in Node's vm. Declared here rather than adding Node's
// types to the app, whose globals are React Native's.
declare module 'vm' {
  export function createContext(sandbox: object): object;
  export function runInContext(code: string, context: object): unknown;
  const vm: { createContext: typeof createContext; runInContext: typeof runInContext };
  export default vm;
}
