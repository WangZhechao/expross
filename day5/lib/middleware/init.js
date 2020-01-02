var request = require('../request');
var response = require('../response');

exports.init = function expressInit(req, res, next) {
	//request文件可能用到res对象
	req.res = res;

	//response文件可能用到req对象
	res.req = req;

	//修改原始req和res原型
	Object.setPrototypeOf(req, request);
	Object.setPrototypeOf(res, response);

	//继续
	next();
};