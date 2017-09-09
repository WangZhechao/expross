function Layer(path, fn) {
  this.handle = fn;
  this.name = fn.name || '<anonymous>';
  this.path = path;
}


//错误处理
Layer.prototype.handle_error = function(error, req, res, next) {
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
Layer.prototype.handle_request = function(req, res, next) {
  var fn = this.handle;

  try {
    fn(req, res, next);
  } catch (err) {
    next(err);
  }
};


//简单匹配
Layer.prototype.match = function(path) {
  if (path === this.path || path === '*') {
    return true;
  }

  return false;
};


exports = module.exports = Layer;