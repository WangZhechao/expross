var http = require('http');
var Router = require('./router');
var middleware = require('./middleware/init');
var View = require('./view');

function Application() {
	this.settings = {};
	this.engines = {};
}

Application.prototype.lazyrouter = function () {
	if (!this._router) {
		this._router = new Router();

		this._router.use(middleware.init(this));
	}
};

Application.prototype.listen = function (port, cb) {
	var self = this;

	var server = http.createServer(function (req, res) {
		self.handle(req, res);
	});

	return server.listen.apply(server, arguments);
};


Application.prototype.handle = function (req, res) {

	var done = function finalhandler(err) {
		res.writeHead(404, {
			'Content-Type': 'text/plain'
		});

		if (err) {
			res.end('404: ' + err);
		} else {
			var msg = 'Cannot ' + req.method + ' ' + req.url;
			res.end(msg);
		}
	};

	// 这里无需调用lazyrouter，因为listen前一定调用了.use或者.METHODS方法。
	// 如果二者都没有调用，没有必要创建路由系统。this._router为undefined。
	var router = this._router;
	if (router) {
		router.handle(req, res, done);
	} else {
		done();
	}
};

Application.prototype.engine = function (ext, fn) {
	// get file extension
	var extension = ext[0] !== '.'
		? '.' + ext
		: ext;

	// store engine
	this.engines[extension] = fn;

	return this;
};

Application.prototype.set = function (setting, val) {
	if (arguments.length === 1) {
		// app.get(setting)
		return this.settings[setting];
	}

	this.settings[setting] = val;
	return this;
};


Application.prototype.use = function (fn) {
	var path = '/',
		router;

	//获取router
	this.lazyrouter();
	router = this._router;

	//路径挂载
	if (typeof fn !== 'function') {
		path = fn;
		fn = arguments[1];
	}

	router.use(path, fn);

	return this;
};

http.METHODS.forEach(function (method) {
	method = method.toLowerCase();
	Application.prototype[method] = function (path, fn) {
		if (method === 'get' && arguments.length === 1) {
			// app.get(setting)
			return this.set(path);
		}

		this.lazyrouter();

		this._router[method].apply(this._router, arguments);
		return this;
	};
});


Application.prototype.render = function (name, options, callback) {

	var done = callback;
	var engines = this.engines;
	var opts = options;
	
	view = new View(name, {
		defaultEngine: this.get('view engine'),
		root: this.get('views'),
		engines: engines
	});

	if (!view.path) {
		var err = new Error('Failed to lookup view "' + name + '"');
		return done(err);
	}

	try {
		view.render(options, callback);
	} catch (e) {
		callback(e);
	}
};

exports = module.exports = Application;