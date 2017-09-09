var http = require('http');

var res = Object.create(http.ServerResponse.prototype);

module.exports = res;


res.send = function(body) {
	this.writeHead(200, {
		'Content-Type': 'text/plain'
	});
	this.end(body);
};