/** Hàng rào P2: rules-engine phải thuần, deterministic và không gọi mạng. */
export default [
  {
    name: "flr/rules-engine-safety",
    files: ["packages/rules-engine/src/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "document",
          message: "rules-engine phải thuần, không dùng DOM",
        },
        { name: "window", message: "rules-engine phải thuần, không dùng DOM" },
        {
          name: "navigator",
          message: "rules-engine phải thuần, không dùng DOM",
        },
        { name: "fetch", message: "rules-engine không được gọi mạng" },
        { name: "XMLHttpRequest", message: "rules-engine không được gọi mạng" },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message: "rules-engine phải deterministic",
        },
      ],
    },
  },
];
