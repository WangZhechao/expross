var Layer = require('./layer.js'),
    Route = require('./route.js');

var Router = function() {
	this.stack = [new Layer('*', function(req, res) {
		res.writeHead(200, {
			'Content-Type': 'text/plain'
		});
		res.end('404');		
	})];
};

Router.prototype.route = function route(path) {
    var route = new Route(path);

    var layer = new Layer(path, function(req, res) {
        route.dispatch(req, res);
    });

    layer.route = route;

    this.stack.push(layer);
    
    return route;
};



Router.prototype.handle = function(req, res) {
	var self = this;

	for(var i=1,len=self.stack.length; i<len; i++) {
		if(self.stack[i].match(req.url)) {
			return self.stack[i].handle_request(req, res);
		}
	}

	return self.stack[0].handle_request(req, res);
};


Router.prototype.get = function(path, fn) {
	this.stack.push(new Layer(path, fn));
};

exports = module.exports = Router;