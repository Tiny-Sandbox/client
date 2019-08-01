const deepMerge = require("deepmerge");

const context = require.context("../node_modules", true, /\.\/tsa-([a-z-_]+)\/index\.js/);
context.keys().forEach(context);

const assets = deepMerge.all(context.keys().map(context));
module.exports = assets;