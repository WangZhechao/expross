function createApplication() {
	return {
		get: function() {
			console.log('expross().get function');
		},

		listen: function() {
			console.log('expross().listen function');
		}
	}
}

exports = module.exports = createApplication;