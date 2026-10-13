import { FlatCompat } from "@eslint/eslintrc"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const compat = new FlatCompat({ baseDirectory: __dirname })

export default [
  {
    ignores: [
      ".next/**",
      ".next-audit/**",
      ".next-audit-strict/**",
      ".next-audit-dev/**",
      ".next-audit-journey/**",
      "node_modules/**",
      "next-env.d.ts",
      "mobile/**",
      "scripts/legacy/pdf-gen/**",
      "documents/archive/tools/pdf-gen/**",
      "documents/private-artifacts/**",
      "documents/proposals/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
]
