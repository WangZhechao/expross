var Layer = require('./layer.js'),
	Route = require('./route.js'),
	http = require('http');

var proto = function() {
	function router(req, res, next) {
		router.handle(req, res, next);
	}

	Object.setPrototypeOf(router, proto);

	router.stack = [];
	return router;
};


proto.route = function route(path) {
    var route = new Route(path);

    //使用bind方式
    var layer = new Layer(path, route.dispatch.bind(route));

    layer.route = route;

    this.stack.push(layer);
    
    return route;
};


proto.handle = function(req, res, done) {
	var self = this,
	    method = req.method,
		idx = 0, stack = self.stack,
		removed = '', slashAdded = false;

	//获取当前父路径
	var parentUrl = req.baseUrl || '';
	//保存父路径
	req.baseUrl = parentUrl;
	//保存原始路径
	req.orginalUrl = req.orginalUrl || req.url;


	function next(err) {
		var layerError = (err === 'route' ? null : err);

		//如果有移除，复原原有路径
		if(slashAdded) {
			req.url = '';
			slashAdded = false;
		}

		//如果有移除，复原原有路径信息
		if(removed.length !== 0) {
			req.baseUrl = parentUrl;
			req.url = removed + req.url;
			removed = '';
		}

		//跳过路由系统
		if(layerError === 'router') {
			return done(null);
		}

		//没有找到
		if(idx >= stack.length) {
			return done(layerError);
		}

		//获取当前路径
		var path = require('url').parse(req.url).pathname;
		var layer = stack[idx++];
		
		//匹配，执行
		if(layer.match(path)) {

			//处理中间件
			if(!layer.route) {
				//要移除的部分路径
				removed = layer.path;

				//设置当前路径
				req.url = req.url.substr(removed.length);
				if(req.url === '') {
					req.url = '/' + req.url;
					slashAdded = true;
				}

				//设置当前路径的父路径
				req.baseUrl = parentUrl + removed;

				//调用处理函数
				if(layerError)
					layer.handle_error(layerError, req, res, next);
				else
					layer.handle_request(req, res, next);
					
			} else if(layer.route._handles_method(method)) {
				//处理路由
				layer.handle_request(req, res, next);
			}	
		} else {
			next(layerError);
		}
	}

	next();
};

proto.use = function(fn) {
	var path = '/';

	//路径挂载
	if(typeof fn !== 'function') {
		path = fn;
		fn = arguments[1];
	}

	var layer = new Layer(path, fn);
	layer.route = undefined;

	this.stack.push(layer);

	return this;
};

http.METHODS.forEach(function(method) {
    method = method.toLowerCase();
    proto[method] = function(path, fn) {
    	var route = this.route(path);
    	route[method].call(route, fn);

    	return this;
    };
});


module.exports = proto;