/**
 * Các rule ESLint thực thi bất biến an toàn của dự án (docs/SECURITY.md §3).
 * File này được eslint.config.mjs sử dụng VÀ được test trực tiếp trong
 * tests/eslint-safety.test.ts — sửa ở đây là sửa cả hai nơi, không bị lệch.
 */
export default [
  {
    name: "flr/safety",
    rules: {
      // Bất biến #1: extension không bao giờ đọc/ghi cookie Facebook.
      "no-restricted-properties": [
        "error",
        {
          object: "document",
          property: "cookie",
          message:
            "Bất biến an toàn #1 (docs/SECURITY.md §3): không được đọc/ghi document.cookie.",
        },
      ],
      // MV3 cấm sẵn, nhưng chặn luôn từ lint cho chắc.
      "no-eval": "error",
      "no-implied-eval": "error",
    },
  },
];
