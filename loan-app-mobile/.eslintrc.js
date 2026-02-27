module.exports = {
  root: true,
  extends: ["expo"],
  overrides: [
    {
      files: [
        "**/__tests__/**/*.{js,jsx,ts,tsx}",
        "**/*.test.{js,jsx,ts,tsx}",
        "jest.setup.js",
      ],
      env: {
        jest: true,
      },
    },
  ],
};
