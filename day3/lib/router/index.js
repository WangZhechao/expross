var Layer = require('./layer.js'),
	Route = require('./route.js'),
	http = require('http');

var Router = function() {
	this.stack = [];
};

Router.prototype.route = function route(path) {
    var route = new Route(path);

    //使用bind方式
    var layer = new Layer(path, route.dispatch.bind(route));

    layer.route = route;

    this.stack.push(layer);
    
    return route;
};



Router.prototype.handle = function(req, res, done) {
	var self = this,
	    method = req.method,
	    idx = 0, stack = self.stack;

	function next(err) {
		var layerError = (err === 'route' ? null : err);

		//跳过路由系统
		if(layerError === 'router') {
			return done(null);
		}

		if(idx >= stack.length || layerError) {
		    return done(layerError);
		}

		var layer = stack[idx++];
		
		//匹配，执行
		if(layer.match(req.url) && layer.route &&
			layer.route._handles_method(method)) {
			return layer.handle_request(req, res, next);
		} else {
			next(layerError);
		}
	}

	next();
};


http.METHODS.forEach(function(method) {
    method = method.toLowerCase();
    Router.prototype[method] = function(path, fn) {
    	var route = this.route(path);
    	route[method].call(route, fn);

    	return this;
    };
});


exports = module.exports = Router;