var expross = require('../');
var app = expross();
var router = expross.Router();


app.get('/', function(req, res, next) {
	res.send('home');
});

app.get('/books', function(req, res, next) {
	res.send('books');
});

router.use('/1', function(req, res, next) {
	res.send('first user');
});

router.use('/2', function(req, res, next) {
	res.send('second user');
});

app.use('/users', router);

app.listen(3000, function() {
	console.log('Example app listening on port 3000!');
});