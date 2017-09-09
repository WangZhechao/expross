var http = require('http');
var Router = require('./router');
var middleware = require('./middleware/init');

function Application() {}


Application.prototype.lazyrouter = function() {
	if(!this._router) {
		this._router = new Router();

		this._router.use(middleware.init);
	}
};


Application.prototype.listen = function(port, cb) {
	var self = this;

	var server = http.createServer(function(req, res) {
		self.handle(req, res);
	});

	return server.listen.apply(server, arguments);
};


Application.prototype.handle = function(req, res) {

	var done = function finalhandler(err) {
		res.writeHead(404, {
			'Content-Type': 'text/plain'
		});

		if(err) {
			res.end('404: ' + err);	
		} else {
			var msg = 'Cannot ' + req.method + ' ' + req.url;
			res.end(msg);	
		}
	};


	//这里无需调用lazyrouter，因为listen前一定构造了路由系统，调用了.use或者.METHODS方法
	//如果二者都没有调用，this._router为undefined。
	var router = this._router;
	if(router) {
		router.handle(req, res, done);
	} else {
		done();
	}
};


Application.prototype.use = function(fn) {
	var path = '/',
		router;


	//获取router
	this.lazyrouter();
	router = this._router;

	//路径挂载
	if(typeof fn !== 'function') {
		path = fn;
		fn = arguments[1];
	}

	router.use(path, fn);

	return this;
};


http.METHODS.forEach(function(method) {
    method = method.toLowerCase();
    Application.prototype[method] = function(path, fn) {
    	this.lazyrouter();

    	this._router[method].apply(this._router, arguments);
    	return this;
    };
});

exports = module.exports = Application;


