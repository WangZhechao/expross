var http = require('http');

var res = Object.create(http.ServerResponse.prototype);

module.exports = res;


res.send = function(body) {
	this.writeHead(200, {
		'Content-Type': 'text/plain'
	});
	this.end(body);
};


res.render = function(view, options, callback) {
	var req = this.req;
	var app = req.app;
	var done = callback;
	var opts = options || {};
	var self = this;

	//如果定义回调，则返回，否则渲染
	done = done || function(err, str) {
		if(err) {
			return req.next(err);
		}

		self.send(str);
	};

	//渲染
	app.render(view, opts, done);
};