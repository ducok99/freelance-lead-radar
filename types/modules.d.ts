// Cho phép TypeScript hiểu import file cấu hình .mjs (vd eslint.safety.mjs)
// trong test mà không mất kiểm tra kiểu ở phía sử dụng.
declare module "*.mjs" {
  import type { Linter } from "eslint";
  const config: Linter.Config[];
  export default config;
}
