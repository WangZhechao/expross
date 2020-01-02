var Application = require('./application');
var Router = require('./router');

function createApplication() {
	var app = new Application();
	return app;
}

exports = module.exports = createApplication;
exports.Router = Router;