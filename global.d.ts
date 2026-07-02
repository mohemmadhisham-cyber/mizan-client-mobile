// Type shims for CSS imports used by the Expo web/template layer.
// Expo normally emits these into the gitignored expo-env.d.ts, which is absent
// in a fresh checkout and in CI — declare them here so `tsc --noEmit` is clean.

declare module '*.css';

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
