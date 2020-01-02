var http = require('http');

var req = Object.create(http.IncomingMessage.prototype);

module.exports = req;