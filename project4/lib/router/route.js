var Layer = require('./layer.js');
var http = require('http');

var Route = function(path) {
    this.path = path;
    this.stack = [];

    this.methods = {};
};


Route.prototype._handles_method = function(method) {
    var name = method.toLowerCase();
    return Boolean(this.methods[name]);
};


http.METHODS.forEach(function(method) {
    method = method.toLowerCase();
    Route.prototype[method] = function(fn) {
        var layer = new Layer('/', fn);
        layer.method = method;

        this.methods[method] = true;
        this.stack.push(layer);

        return this;
    };
});



Route.prototype.dispatch = function(req, res, done) {
    var self = this,
        method = req.method.toLowerCase(),
        idx = 0, stack = self.stack;

    function next(err) {
        //跳过route
        if(err && err === 'route') {
            return done();
        }

        //跳过整个路由系统
        if(err && err === 'router') {
            return done(err);
        }


        //越界
        if(idx >= stack.length) {
            return done(err);
        }


        //不等枚举下一个
        var layer = stack[idx++];
        if(method !== layer.method) {
            return next(err);
        }


        if(err) {
            //主动报错
            layer.handle_error(err, req, res, next);
        } else {
            layer.handle_request(req, res, next);
        }
    }

    next();
};

exports = module.exports = Route;