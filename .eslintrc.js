module.exports = {
  root: true,
  env: {
    node: true,
    mongo: true,
  },
  extends: [
    "eslint:recommended",
    "airbnb-base",

    "plugin:prettier/recommended",

    "plugin:promise/recommended",

    "plugin:eslint-comments/recommended",
  ],
  parserOptions: {
    sourceType: "module",
    ecmaVersion: 2020,
  },
  rules: {
    "no-plusplus": "off", // i have no need for this rule
    "promise/always-return": "off", // dumb as shit, forces you to ALWAYS return something in .then
    "no-underscore-dangle": "off", // discord.js has this in their library, cant rly do much about it lol
  },
};
