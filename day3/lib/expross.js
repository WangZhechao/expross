var Application = require('./application');

function createApplication() {
	var app = new Application();
	return app;
}

exports = module.exports = createApplication;