var path = require('path');
var fs = require('fs');

function View(name, options) {
	var opts = options || {};

	this.defaultEngine = opts.defaultEngine;
	this.root = opts.root;

	this.ext = path.extname(name);
	this.name = name;


	var fileName = name;
	if (!this.ext) {
	  // get extension from default engine name
	  this.ext = this.defaultEngine[0] !== '.'
	    ? '.' + this.defaultEngine
	    : this.defaultEngine;

	  fileName += this.ext;
	}


	if (!opts.engines[this.ext]) {
	  // load engine
	  var mod = this.ext.substr(1);
	  opts.engines[this.ext] = require(mod).__express;
	}

	// store loaded engine
	this.engine = opts.engines[this.ext];

	// lookup path
	this.path = this.lookup(fileName);
}


function tryStat(path) {
  try {
    return fs.statSync(path);
  } catch (e) {
    return undefined;
  }
}


View.prototype.resolve = function resolve(dir, file) {
  var ext = this.ext;

  // <path>.<ext>
  var p = path.join(dir, file);
  var stat = tryStat(p);

  if (stat && stat.isFile()) {
    return p;
  }

  // <path>/index.<ext>
  p = path.join(dir, path.basename(file, ext), 'index' + ext);
  stat = tryStat(p);

  if (stat && stat.isFile()) {
    return p;
  }
};


View.prototype.lookup = function lookup(name) {
	var p;
	var roots = [].concat(this.root);

	for (var i = 0; i < roots.length && !p; i++) {
		var root = roots[i];

		// resolve the path
		var loc = path.resolve(root, name);
		var dir = path.dirname(loc);
		var file = path.basename(loc);

		// resolve the file
		p = this.resolve(dir, file);
	}

	return p;
};


View.prototype.render = function render(options, callback) {
	this.engine(this.path, options, callback);
};

module.exports = View;