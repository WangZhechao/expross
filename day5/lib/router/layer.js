function Layer(path, fn) {
    this.handle = fn;
    this.name = fn.name || '<anonymous>';
    this.path = undefined;

    //是否为*
    this.fast_star = (path === '*' ? true : false);
    if(!this.fast_star) {
        this.path = path;
    }
}


//错误处理
Layer.prototype.handle_error = function (error, req, res, next) {
    var fn = this.handle;

    //如果函数参数不是标准的4个参数，返回错误信息
    if (fn.length !== 4) {
        return next(error);
    }

    try {
        fn(error, req, res, next);
    } catch (err) {
        next(err);
    }
};

//简单处理
Layer.prototype.handle_request = function (req, res, next) {
    var fn = this.handle;

    try {
        fn(req, res, next);
    } catch (err) {
        next(err);
    }
};


//简单匹配
Layer.prototype.match = function(path) {

    //如果为*，匹配
    if(this.fast_star) {
      this.path = '';
      return true;
    }

    //如果是普通路由，从后匹配
    if(this.route && this.path === path.slice(-this.path.length)) {
      return true;
    }
  
    if (!this.route) {
      //不带路径的中间件
      if (this.path === '/') {
        this.path = '';
        return true;
      }
  
      //带路径中间件
      if(this.path === path.slice(0, this.path.length)) {
        return true;
      }
    }
    
    return false;
  };


exports = module.exports = Layer;