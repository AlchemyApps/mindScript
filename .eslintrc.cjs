/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@mindscript/config/eslint"],
  parserOptions: {
    project: true,
  },
};