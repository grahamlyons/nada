var litmus = require('litmus');

exports.test = new litmus.Suite('Testing views and framework', [
    require('./view-test.js').test,
    require('./nada-test.js').test
]);
