var expross = require('../');
var app = expross();

app.get('/', function(req, res, next) {
	next();
})

.get('/', function(req, res, next) {
	next(new Error('error'));
})

.get('/', function(req, res) {
	res.send('third');
});

app.listen(3000, function() {
	console.log('Example app listening on port 3000!');
});