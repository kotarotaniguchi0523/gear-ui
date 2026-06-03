import next from "eslint-config-next";

// Next.js 16 removed the built-in `next lint` command in favour of the ESLint
// CLI with flat config. `eslint-config-next` exports a ready-made flat config
// array (Core Web Vitals + TypeScript rules).
const eslintConfig = [
  ...next,
  {
    ignores: [
      ".next/**",
      "out/**",
      "dist/**",
      "node_modules/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
