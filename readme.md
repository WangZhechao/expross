# Express 源码阅读

## 0. 简介

这篇文章主要的目的是分析理解 Express 的源码，网络上 Express 源码分析的文章已经数不胜数，这篇文章准备另辟蹊径，仿制一个 Express 的轮子，通过测试驱动的开发方式不断迭代，正向理解 Express 的代码。

本文是早期创作的[另一篇文章](https://segmentfault.com/a/1190000011090124)的迭代版本，主要是根据文章的历史评论，以及官网的更新进行了细节修正。如果准备通过文章内容了解 Express 的基本原理，前提必须有一些 Express 框架的使用经验，写过一两个基于 Express 框架的应用，否则对于其背后的原理理解起来难以产生共鸣，不易掌握。

文章中的所有源码以及上传到 [GitHub](https://github.com/WangZhechao/expross)，欢迎下载。

## 1. 神说：“要有光”

我们创建一个新的框架，就叫它 Expross。根据 Duck typing 法则，必须让它看起来像 Express 再说其它。让我们先从 Express 的官网案例入手，确认框架的结构，并尽可能的通过官方案例的测试。

初始框架的结构如下，如果以后不满足需求可以随时更改：

```
expross
  |
  |-- lib
  |    | 
  |    |-- expross.js
  |
  |-- test
  |    |
  |    |-- index.js
  |
  |-- index.js

```

上述结构在现在的 npm 包中非常流行，其中 `expross/test/index.js` 用来保存官方案例，主要用于框架测试。

```
//官方案例

const express = require('express')
const app = express()
const port = 3000

app.get('/', (req, res) => res.send('Hello World!'))

app.listen(port, () => console.log(`Example app listening on port ${port}!`))

```

不过在保存之前，需要将前两行替换为我们自己的框架：

```
const expross = require('../');
const app = expross();
```

文件 `expross/index.js` 是 expross 框架的入口。代码主要是用于加载 `lib` 目录下的 `expross.js` 文件。


```
module.exports = require('./lib/expross');
```

文件 `expross/lib/expross.js` 用来保存真正的项目核心代码。我们可以通过研究官方示例的前两行代码可以推断出来 Express 变量所代表的是一个函数，进而确定我们的 `expross.js` 文件只有导出函数才能满足测试文件的要求。所以在文件中添加代码如下：

```
function createApplication() {
	return {};
}

exports = module.exports = createApplication;
```

为了迎合测试程序调用的函数需求，暂时将函数实现如下：

```
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
```

目前代码虽然没有实现真正的功能，但至少可以先将测试跑通，函数的核心内容可以在接下来的步骤中不断完善。

运行 `node test/index.js` 查看结果。

## 2. 第一次迭代

第一次迭代，主要实现的目标包括两个部分：

+ 实现基本的 HTTP 服务器。
+ 实现基本的 GET 方法。

HTTP 服务器的实现比较简单，可以参考 nodejs 官网：

```
const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => {
	res.statusCode = 200;
	res.setHeader('Content-Type', 'text/plain');
	res.end('Hello World\n');
});

server.listen(port, hostname, () => {
	console.log(`Server running at http://${hostname}:${port}/`);
});
```

实现 expross 的 `listen` 函数：

```
listen: function(port, cb) {
	var server = http.createServer(function(req, res) {
		console.log('http.createserver...');
	});

	return server.listen(port, cb);
}
```

如果你查看 nodejs 的官方文档，就会发现 `http.createServer` 拥有很多重载函数，而 Express 框架同样支持这些参数形式，为了充分满足参数的不同需求，这里可以使用 javascript 脚本语言常用的 “代理” 手法：`apply` 或 `call` ，因为参数个数未知，推荐使用 apply 函数：

```
listen: function() {
	var server = http.createServer(function requestListener(req, res) {
		console.log('http.createserver...');
	});

	// 使用 apply 代理手法
	return server.listen.apply(server, arguments);
}
```

上面代码中的 `requestListener` 回调函数可以拦截（接收）一切 HTTP 请求。通过该函数，可以实现框架的路由功能，做到根据请求参数的不同，执行不同的业务逻辑。

对于 HTTP 传输层来说，一个 HTTP 请求主要包括请求行、请求头和消息体，nodejs 将常用的数据方法封装为 `http.IncomingMessage` 类，代码中的 `req` 变量就是该类的对象。

每个 HTTP 请求都会对应一个 HTTP 响应。一个 HTTP 响应主要包括状态行、响应头和消息体。nodejs 将其封装为 `http.ServerResponse` 类，代码中的 `res` 变量就是该类的对象。

其实不仅仅 nodejs 这样做，基本上所有的 HTTP 服务器框架都会抽象出 Request 和 Response 这两个对象，它们分别代表着 HTTP 传输的两端，也肩负着服务端和客户端（浏览器）交互的任务。

一个成熟的 HTTP 框架最基本的需求就是区分不同的 HTTP 请求，根据请求的不同来执行不同的业务逻辑，这在 web 服务器中有一个专有名词叫做 “路由管理”。每个请求默认为一个路由，常见的路由分类策略主要包括请求路径和请求方法。但是不仅仅限定这些，任何 HTTP 请求包含的参数都可以作为路由策略，例如可以使用 `user-agent` 字段判断是否为移动端等等。

不同的框架路由管理的方法略有不同，但整个流程是基本一致的，主要包括两个部分：

+ 绑定部分，用于将路由策略和执行逻辑绑定。
+ 执行部分，根据请求的不同执行前期绑定部分指定的业务逻辑。

既然知道路由系统的重要性，接下来我们就开始实现我们自己的路由系统。Express 框架的路由系统是由 Router 来负责的，它本身是一个中间件。咱们这里先实现一个简单的路由器，而非最终的路由中间件，不过随着代码的迭代，最终我们会实现和 Express 类似的东西。

首先抽象路由的基本属性：

+ path 请求路径，例如：/books、/books/1 等。
+ method 请求方法，例如：GET、POST、PUT、DELETE 等。
+ handle 处理函数。

接着定义一个路由变量 router 来保存当前的路由表：

```
var router = [{
	path: '*',
	method: '*',
	handle: function(req, res) {
		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end('404');
	}
}];
```

最后修改 `requestListener` 函数的逻辑，用来匹配 router 表中的项，如果匹配成功，则执行绑定的 handle 函数，否则执行 `router[0].handle` 函数，返回 404 ，代表未找到相关路由。

```
listen: function() {
	var server = http.createServer(function requestListener(req, res) {

		for(var i=1,len=router.length; i<len; i++) {
			if((req.url === router[i].path || router[i].path === '*') &&
				(req.method === router[i].method || router[i].method === '*')) {
				return router[i].handle && router[i].handle(req, res);
			}
		}
		
		return router[0].handle && router[0].handle(req, res);
	});

	return server.listen.apply(server, arguments);
}
```

实现路由管理的执行部分，还需要实现路由管理的绑定部分，这里根据官方测试用例，先实现 GET 请求的路由项添加：

```
get: function(path, fn) {
	router.push({
		path: path,
		method: 'GET',
		handle: fn
	});
}
```
执行 `node test/index.js`，访问 `http://127.0.0.1:3000/` 会提示 `res.send` 不存在：

```
app.get('/', (req, res) => res.send('Hello World!'));
                               ^
TypeError: res.send is not a function
```
该函数并不是 nodejs 原生自带的，而是 Express 框架附加的。为了使用这个函数，我们这里临时在 res 对象上附加上该函数的实现：

```
listen: function() {
	var server = http.createServer(function(req, res) {
		if(!res.send) {
			res.send = function(body) {
				res.writeHead(200, {
					'Content-Type': 'text/plain'
				});
				res.end(body);
			};
		}

		......
	});

	return server.listen.apply(server, arguments);
}
```

到此为止，已经基本实现了 Express 官方的自带案例功能，在结束这一节内容之前，我们调整一下目前的代码结构。

创建 `expross/lib/application.js` 文件，将 `createApplication` 函数中的代码转移到该文件， `expross.js` 文件只保留引用。

```
var app = require('./application');

function createApplication() {
	return app;
}

exports = module.exports = createApplication;
```

整个目录结构如下：

```
expross
  |
  |-- lib
  |    | 
  |    |-- expross.js
  |    |-- application.js
  |
  |-- test
  |    |
  |    |-- index.js
  |
  |-- index.js
```

最后，运行 `node test/index.js`，打开浏览器访问 `http://127.0.0.1:3000/`。

## 3. 第二次迭代

本节是 expross 的第二次迭代，主要的目的是构建一个初步的路由系统。根据上一节的改动，目前的路由是用一个 router 数组进行管理，对于 router 的操作有两个，分别是在添加路由的 `application.get` 函数和处理路由的 `application.listen` 函数。

按照面向对象的封装法则，接下来将路由系统的数据和路由系统的操作封装到一起定义一个 Router 类负责整个路由系统的主要工作。创建 `router/index.js` 文件：

```
var Router = function() {
	this.stack = [{
		path: '*',
		method: '*',
		handle: function(req, res) {
			res.writeHead(200, {
				'Content-Type': 'text/plain'
			});
			res.end('404');
		}
	}];
};


Router.prototype.get = function(path, fn) {
	this.stack.push({
		path: path,
		method: 'GET',
		handle: fn
	});
};


Router.prototype.handle = function(req, res) {
	for(var i=1,len=this.stack.length; i<len; i++) {
		if((req.url === this.stack[i].path || this.stack[i].path === '*') &&
			(req.method === this.stack[i].method || this.stack[i].method === '*')) {
			return this.stack[i].handle && this.stack[i].handle(req, res);
		}
	}

	return this.stack[0].handle && this.stack[0].handle(req, res);
};

exports = module.exports = Router;
```

修改原有的 `application.js` 文件的内容。

```
var http = require('http');
var Router = require('./router');


exports = module.exports = {
	_router: new Router(),

	get: function(path, fn) {
		return this._router.get(path, fn);
	},

	listen: function(port, cb) {
		var self = this;

		var server = http.createServer(function(req, res) {
			if(!res.send) {
				res.send = function(body) {
					res.writeHead(200, {
						'Content-Type': 'text/plain'
					});
					res.end(body);
				};
			}

			return self._router.handle(req, res);
		});

		return server.listen.apply(server, arguments);
	}
};
```

这样以后路由方面的操作只和 Router 本身有关，与 application 分离，使代码更加清晰。在进一步构建路由系统之前，我们需要再次分析一下路由的特性。

在当前的 expross 中，router 数组的每一项代表一项路由信息，包括路径、方法和处理函数三个部分。其中，前两者的关系是一对多的关系，如果用现在的方法存储路由信息，路由匹配的效率会逐步下降，特别是遵守类似 RESTful 风格的路由：

```
GET books/1
PUT books/1
DELETE books/1
```

上面三个路由分别代表读、改、删三种操作，但是它们对应的路径信息是一样的，如果用 router 数组管理，显然会产生一些冗余。随之而来的想法就是能否将这样一组路由汇聚到一起来提升匹配效率？这可能就是 Route 类诞生的原因之一（个人猜测）。

```
--------------
| Application  |                                 ---------------------------------------------------------
|     |        |        ----- -----------        |     0     |     1     |     2     |     3     |  ...  |
|     |-router | ----> |     | Layer     |       ---------------------------------------------------------
 --------------        |  0  |   |-path  |       | Layer     | Layer     | Layer     | Layer     |       |
  application          |     |   |-route | ----> |  |- method|  |- method|  |- method|  |- method|  ...  |
                       |-----|-----------|       |  |- handle|  |- handle|  |- handle|  |- handle|       |
                       |     | Layer     |       ---------------------------------------------------------
                       |  1  |   |-path  |                                  route
                       |     |   |-route |       
                       |-----|-----------|       
                       |     | Layer     |
                       |  2  |   |-path  |
                       |     |   |-route |
                       |-----|-----------|
                       | ... |   ...     |
                        ----- ----------- 
                             router
```

这张图代表了我们这一节代码的最终结果。这里从右向左分别介绍一下：

Route 是我们最新增加的东西，它用于存储一组路径相同的路由。Router 类是对上一节 router 数组的封装，其中数组的每一项被封装为一个 Layer 对象。Route 类内部同样存储着一个数组，而数组的每一项同样也是一个 Layer 对象，Layer 类被设计的很抽象，但是它是 Route 和 Router 的基础。

所以这里先实现 Layer 类。Layer 类其实代表着一个可执行层。它可以是一个专属路由、也可以是一个等待被执行的函数，这个函数在 Express 中被称为中间件。想要实现路由的基本功能，Layer 类必须包含几个成员：

+ path，用于记录路由匹配的路径，主要用在 Router 类中。
+ method，用于记录路由匹配的方法，主要用在 Route 类中。
+ handle，用于记录真正需要执行的代码。
+ route，用于记录指向的 Route 对象。

在 Express 中，如果 Layer 类中的 route 成员为空，则 Layer 代表着是一种中间件，其中 handle 记录着中间件的入口函数；如果 Layer 类中的 route 成员非空，则 route 指向需要匹配的路由，它是一个 Route 对象，handle 则记录着 Route 类的路由处理函数。这显然是一种几次迭代后精心设计的结果，值得学习感悟。

下面是 Layer 类的实现：

```
function Layer(path, fn) {
    this.handle = fn;
    this.name = fn.name || '<anonymous>';
    this.path = path;
}


//简单处理
Layer.prototype.handle_request = function (req, res) {
  var fn = this.handle;

  if(fn) {
      fn(req, res);
  }
};


//简单匹配
Layer.prototype.match = function (path) {
    if(path === this.path || path === '*') {
        return true;
    }
    
    return false;
};

exports = module.exports = Layer;
```

创建好 Layer 类，后我们更新一下 Router 类的实现，使用 Layer 替代 `this.stack` 的每一项：

```
var Layer = require('./layer.js');

var Router = function() {
	this.stack = [new Layer('*', function(req, res) {
		res.writeHead(200, {
			'Content-Type': 'text/plain'
		});
		res.end('404');		
	})];
};


Router.prototype.handle = function(req, res) {
	var self = this;

	for(var i=1,len=self.stack.length; i<len; i++) {
		if(self.stack[i].match(req.url)) {
			return self.stack[i].handle_request(req, res);
		}
	}

	return self.stack[0].handle_request(req, res);
};


Router.prototype.get = function(path, fn) {
	this.stack.push(new Layer(path, fn));
};

exports = module.exports = Router;

```

现在如果测试运行，则会导致无法区分路径相同但方法不同的路由，例如：

```
app.put('/', function(req, res) {
	res.send('put Hello World!');
});

app.get('/', function(req, res) {
	res.send('get Hello World!');
});
```

程序无法分清 PUT 和 GET 的区别。继续完善前文提到的 Route 类，它包含用于区分相同路径，不同请求方法的路由：

```
var Layer = require('./layer.js');

var Route = function(path) {
    this.path = path;
    this.stack = [];

    this.methods = {};
};

Route.prototype._handles_method = function(method) {
    var name = method.toLowerCase();
    return Boolean(this.methods[name]);
};

Route.prototype.get = function(fn) {
    var layer = new Layer('/', fn);
    layer.method = 'get';

    this.methods['get'] = true;
    this.stack.push(layer);

    return this;
};

Route.prototype.dispatch = function(req, res) {
    var self = this,
        method = req.method.toLowerCase();

    for(var i=0,len=self.stack.length; i<len; i++) {
        if(method === self.stack[i].method) {
            return self.stack[i].handle_request(req, res);
        }
    }
};

exports = module.exports = Route;
```

既然有了 Route 类，接下来修改原有的 Router 类，将 route 集成其中。

```
var Layer = require('./layer.js'),
	Route = require('./route.js');


var Router = function() {
	this.stack = [new Layer('*', function(req, res) {
		res.writeHead(200, {
			'Content-Type': 'text/plain'
		});
		res.end('404');		
	})];
};

Router.prototype.route = function route(path) {
    var route = new Route(path);

    var layer = new Layer(path, function(req, res) {
        route.dispatch(req, res);
    });

    layer.route = route;

    this.stack.push(layer);
    
    return route;
};

Router.prototype.handle = function(req, res) {
	var self = this,
	    method = req.method;

	for(var i=0,len=self.stack.length; i<len; i++) {
	    if(self.stack[i].match(req.url) && 
	        self.stack[i].route && self.stack[i].route._handles_method(method)) {
	        return self.stack[i].handle_request(req, res);
	    }
	}

	return self.stack[0].handle_request(req, res);
};

Router.prototype.get = function(path, fn) {
    var route = this.route(path);
    route.get(fn);

    return this;
};

exports = module.exports = Router;
```

运行 `node test/index.js`，一切看起来和原来一样。

这节内容主要是创建一个完整的路由系统，并在原始代码的基础上引入了 Layer 和 Route 两个概念，并修改了大量的代码，在结束本节前总结一下目前的信息。

首先，当前程序的目录结构如下：

```
expross
  |
  |-- lib
  |    | 
  |    |-- expross.js
  |    |-- application.js
  |    |-- router
  |          |
  |          |-- index.js
  |          |-- layer.js
  |          |-- route.js
  |
  |-- test
  |    |
  |    |-- index.js
  |
  |-- index.js
```

接着，总结一下当前 expross 各个部分的工作。

application 代表一个应用程序，expross 是一个工厂类负责创建 application 对象。Router 代表路由组件，负责应用程序的整个路由系统。组件内部由一个 Layer 数组构成，每个 Layer 对象代表一组路径相同的路由信息，具体信息存储在 Route 内部，每个 Route 内部也是一个 Layer 数组，但是 Route 内部的 Layer 和 Router 内部的 Layer 是存在一定的差异性。

+ Router 内部的 Layer，主要包含 `path`、`route`、`handle` 属性。
+ Route 内部的 Layer，主要包含 `method`、`handle` 属性。

如果一个请求来临，会先从头至尾的扫描 router 内部的每一层，而处理每层的时候会先对比 URI，相同则扫描 route 的每一项，匹配成功则返回具体的信息。如果所有路由全部扫描完毕，没有任何匹配则返回未找到。

## 4. 第三次迭代

本节是 expross 的第三次迭代，主要的目标是继续完善路由系统，主要工作包括：

+ 完善路由其它接口，目前仅仅支持 GET 请求。
+ 完善路由系统的流程控制。

当前 expross 框架只支持 `get` 接口，具体的接口是由 application 对象提供的，函数内部调用了 `Router.get` 接口，而其内部又是对 `Route.get` 的封装。

HTTP 显然不仅仅只有 GET 这一个方法，还包括很多，例如：PUT、POST、DELETE 等等，每个方法都单独写一个处理函数显然是冗余的，因为函数的内容除了和函数名相关外，其它都是一成不变的。根据 JavaScript 脚本语言语言的特性，这里可以通过 HTTP 的方法列表动态生成函数内容。

想要动态生成函数，首先需要确定函数名称。函数名就是 nodejs 中 HTTP 服务器支持的方法名称，可以在官方文档中获取，具体参数是 `http.METHODS`。这个属性是在 v0.11.8 新增的，如果 nodejs 低于该版本，需要手动建立一个方法列表，具体可以参考 nodejs 代码。

Express 框架 HTTP 方法名的获取封装到另一个包，叫做 `methods`，内部给出了低版本的兼容动词列表。

```
function getBasicNodeMethods () {
  return [
    'get',
    'post',
    'put',
    'head',
    'delete',
    'options',
    'trace',
    'copy',
    'lock',
    'mkcol',
    'move',
    'purge',
    'propfind',
    'proppatch',
    'unlock',
    'report',
    'mkactivity',
    'checkout',
    'merge',
    'm-search',
    'notify',
    'subscribe',
    'unsubscribe',
    'patch',
    'search',
    'connect'
  ]
}
```

知道所支持的方法名列表数组后，剩下的只需要一个 for 循环生成所有的函数即可。

所有的动词处理函数的核心内容都在 Route 类中。

```
//不要忘记增加 http = require('http');
//不要忘记删除 Route.prototype.get

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
```

接着修改 Router 类：

```
//不要忘记增加 http = require('http');
//不要忘记删除 Router.prototype.get

http.METHODS.forEach(function(method) {
    method = method.toLowerCase();
    Router.prototype[method] = function(path, fn) {
    	var route = this.route(path);
    	route[method].call(route, fn);

    	return this;
    };
});
```

最后修改 application.js 的内容。这里改动较大，重新定义了一个 Application 类，而不是使用字面量直接创建。

```
var http = require('http');
var Router = require('./router');

function Application() {
	this._router = new Router();
}


Application.prototype.listen = function(port, cb) {
	var self = this;

	var server = http.createServer(function(req, res) {
		self.handle(req, res);
	});

	return server.listen.apply(server, arguments);
};


Application.prototype.handle = function(req, res) {
	if(!res.send) {
		res.send = function(body) {
			res.writeHead(200, {
				'Content-Type': 'text/plain'
			});
			res.end(body);
		};
	}

	var router = this._router;
	router.handle(req, res);
};

exports = module.exports = Application;
```

接着增加 HTTP 方法函数：

```
http.METHODS.forEach(function(method) {
    method = method.toLowerCase();
    Application.prototype[method] = function(path, fn) {
    	this._router[method].apply(this._router, arguments);
    	return this;
    };
});
```

因为导出的是 Application 类，所以修改 `expross.js` 文件如下。

```
var Application = require('./application');

function createApplication() {
	var app = new Application();
	return app;
}

exports = module.exports = createApplication;
```

运行 `node test/index.js`，走起。

如果你仔细研究路由系统的源码，就会发现 Route 类设计的并没有想象中的那样美好，例如我们要增加两个相同路径不同方法的路由：

```
app.put('/', function(req, res) {
	res.send('put Hello World!');
});

app.get('/', function(req, res) {
	res.send('get Hello World!');
});
```

结果并不是想象中类似下面的结构：

```
                          ---------------------------------------------------------
 ----- -----------        |     0     |     1     |     2     |     3     |  ...  |
|     | Layer     |       ---------------------------------------------------------
|  0  |   |-path  |       | Layer     | Layer     | Layer     | Layer     |       |
|     |   |-route | ----> |  |- method|  |- method|  |- method|  |- method|  ...  |
|-----|-----------|       |  |- handle|  |- handle|  |- handle|  |- handle|       |
|     | Layer     |       ---------------------------------------------------------
|  1  |   |-path  |                                  route
|     |   |-route |       
|-----|-----------|       
|     | Layer     |
|  2  |   |-path  |
|     |   |-route |
|-----|-----------|
| ... |   ...     |
 ----- ----------- 
      router
```

而是如下的结构：

```
 ----- -----------        -------------
|     | Layer     | ----> | Layer     |
|  0  |   |-path  |       |  |- method|   route
|     |   |-route |       |  |- handle|
|-----|-----------|       -------------
|     | Layer     |       -------------      
|  1  |   |-path  | ----> | Layer     |
|     |   |-route |       |  |- method|   route     
|-----|-----------|       |  |- handle|        
|     | Layer     |       -------------
|  2  |   |-path  |       -------------  
|     |   |-route | ----> | Layer     |
|-----|-----------|       |  |- method|   route
| ... |   ...     |       |  |- handle| 
 ----- -----------        -------------
      router            
```

这显然不是我们想要的，Route 本身设计出来就是为了优化这种问题的，但是默认自然情况下添加路由的方式是无法实现理想中的结构。Express 给出的方案是使用下面的代码：

```
var router = express.Router();

router.route('/users/:user_id')
.get(function(req, res, next) {
  res.json(req.user);
})
.put(function(req, res, next) {
  // just an example of maybe updating the user
  req.user.name = req.params.name;
  // save user ... etc
  res.json(req.user);
})
.post(function(req, res, next) {
  next(new Error('not implemented'));
})
.delete(function(req, res, next) {
  next(new Error('not implemented'));
});
```

注意这里，如果你想要优化你的路由，你需要主动的使用 route 级联你路径相同的路由，只有这样才能达到我们想要的结果。这也是为什么在 Route 类中，添加方法的时候返回 this 的原因，目的是为了可以级联：

```
http.METHODS.forEach(function(method) {
    method = method.toLowerCase();
    Route.prototype[method] = function(fn) {
        var layer = new Layer('/', fn);
        layer.method = method;

        this.methods[method] = true;
        this.stack.push(layer);

		//这里返回 this，可以使用级联策略
        return this;
    };
});
```

知道了 Route 使用时的注意事项，接下来就要讨论路由的顺序问题。在路由系统中，路由的处理顺序非常重要，因为路由是按照数组的方式存储的，如果遇见两个同样的路由，同样的方法名，不同的处理函数，这时候前后声明的顺序将直接影响结果（这也是 Express 中间件存在顺序相关的原因），例如下面的例子：

```
app.get('/', function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('first');
});

app.get('/', function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('second');
});
```

上面的代码如果执行会发现永远都返回 first，但是有的时候会根据前台传来的参数动态判断是否执行接下来的路由（例如权限控制等），怎样才能跳过 first 进入 second？这就涉及到路由系统的流程控制问题。

流程控制分为主动和被动两种模式。

对于 expross 框架来说，路由绑定的处理逻辑、用户设置的路径参数这些都是不可靠的，在运行过程中很有可能会发生异常，被动流程控制就是当这些异常发生的时候，expross 框架要担负起捕获这些异常的工作，因为如果不明确异常的发生位置，会导致 JavaScript 代码无法继续运行，从而无法准确的报出故障。

主动流程控制则是处理函数内部的操作逻辑，以主动调用的方式来跳转路由内部的执行逻辑。

目前 Express 通过引入 next 参数的方式来解决流程控制问题。next 是处理函数的一个参数，其本身也是一个函数，该函数有几种使用方式：

+ 执行下一个处理函数。执行 next()。
+ 报告异常。执行 next(err)。
+ 跳过当前 Route，执行 Router 的下一项。执行 next('route')。
+ 跳过整个 Router。执行 next('router')。

接下来，我们尝试实现上面这些需求。

首先修改最底层的 Layer 对象，该对象的 `handle_request` 函数是负责调用路由绑定的处理逻辑，这里添加 `next` 参数，并且增加异常捕获功能。

```
Layer.prototype.handle_request = function (req, res, next) {
    var fn = this.handle;

    try {
        fn(req, res, next);
    } catch (err) {
        next(err);
    }
};
```

接下来修改 `Route.dispath` 函数。因为涉及到内部的逻辑跳转，使用 for 循环不太好控制，这里使用了类似递归的方式。

```
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
            return done(err);
        } else {
            layer.handle_request(req, res, next);
        }
    }

    next();
};
```

整个处理过程本质上还是一个 for 循环，唯一的差别就是在处理函数中用户主动调用 `next` 函数的处理逻辑。

如果用户通过 `next` 函数返回错误、route 和 router 这三种情况，目前统一抛给 Router 处理。

因为修改了 `dispatch` 函数，所以调用该函数的 `Router.route` 函数也要修改，这回直接改彻底，以后无需根据参数的个数进行调整。

```
Router.prototype.route = function route(path) {
    ...
    
	//使用bind方式
    var layer = new Layer(path, route.dispatch.bind(route));
    
    ...
};
```

接着修改 `Router.handle` 的代码，逻辑和 `Route.dispatch` 类似。

```

Router.prototype.handle = function(req, res) {
	var self = this,
	    method = req.method,
	    idx = 0, stack = self.stack;

	function next(err) {
		var layerError = (err === 'route' ? null : err);

		//跳过路由系统
		if(layerError === 'router') {
			return done(null);
		}

		if(idx >= stack.length || layerError) {
		    return done(layerError);
		}

		var layer = stack[idx++];
		
		//匹配，执行
		if(layer.match(req.url) && layer.route &&
			layer.route._handles_method(method)) {
			return layer.handle_request(req, res, next);
		} else {
			next(layerError);
		}
	}

	next();
};
```

修改后的函数处理过程和原来的类似，不过有一点需要注意，当发生异常的时候，会将结果返回给上一层，而不是执行原有 `this.stack` 第 0 层的代码逻辑。

除了上面的修改，这里移除原有的 `this.stack` 的初始化代码，将：

```
this.stack = [new Layer('*', function(req, res) {
	res.writeHead(200, {
		'Content-Type': 'text/plain'
	});
	res.end('404');		
})];
```

改为:

```
this.stack = [];
```

我们已经将错误代码传递给了 application 这一层，所以要添加处理错误的代码，修改 
`Application.handle` 函数如下：

```

Application.prototype.handle = function(req, res) {
	if(!res.send) {
		res.send = function(body) {
			res.writeHead(200, {
				'Content-Type': 'text/plain'
			});
			res.end(body);
		};
	}

	var done = function finalhandler(err) {
		res.writeHead(404, {
			'Content-Type': 'text/plain'
		});

		if(err) {
			res.end('404: ' + err);	
		} else {
			var msg = 'Cannot ' + req.method + ' ' + req.url;
			res.end(msg);	
		}
	};

	var router = this._router;
	router.handle(req, res, done);
};
```

这里简单的将 done 函数处理为返回 404 页面，其实在 Express 框架中，使用的是一个单独的 npm 包，叫做 `finalhandler`。

简单的修改一下测试用例证明一下成果。

```
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
```

运行 `node test/index.js`，访问 `http://127.0.0.1:3000/`，结果显示：

```
404: Error: error
```

貌似目前一切都很顺利，不过还有一个需求目前被忽略了。当前处理函数的异常全部是由框架捕获，返回的信息只能是固定的 404 页面，对于框架使用者显然很不方便，大多数时候，我们都希望可以捕获错误，并按照一定的信息封装返回给客户端，所以 expross 需要一个返回错误给上层使用者的接口。

目前和上层对接的处理函数的声明如下：

```
function process_fun(req, res, next) {
  
}
```

如果增加一个错误处理函数，按照 nodejs 的规则，第一个参数是错误信息，定义应该如下所示：

```
function process_err(err, req, res, next) {
  
}
```

因为两个声明的第一个参数信息是不同的，如果区分传入的处理函数是处理错误的函数还是处理正常的函数，这个是 expross 框架需要搞定的关键问题。

JavaScript 中，`Function.length` 属性可以获取传入函数指定的参数个数，这个可以当做区分二者的关键信息。

既然确定了原理，接下来直接在 Layer 类上增加一个专门处理错误的函数，和处理正常信息的函数区分开。

```

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
```

接着修改 `Route.dispatch` 函数。

```
Route.prototype.dispatch = function(req, res, done) {
    var self = this,
        method = req.method.toLowerCase(),
        idx = 0, stack = self.stack;

    function next(err) {
    
		...

        if(err) {
            //主动报错
            layer.handle_error(err, req, res, next);
        } else {
            layer.handle_request(req, res, next);
        }
    }

    next();
};
```

当发生错误的时候，Route 会一直向后寻找错误处理函数，如果找到则返回，否则（越界）执行 `done(err)`，将错误抛给 Router。

本节的内容基本上完成，包括 HTTP 相关的动作接口的添加、路由系统的流程跳转以及 Route 级别的错误响应等等，对于 `Router.handle` 的修改，因为涉及到一些中间件的概念，完整的错误处理将推移到下一节完成。

## 5. 第四次迭代

本节是 expross 的第四次迭代，主要的目标是建立中间件机制并继续完善路由系统的功能。

在 Express 中，中间件其实是一个介于 web 请求来临后到调用处理函数前整个流程体系中间调用的组件。其本质是一个函数，内部可以访问修改请求和响应对象，并调整接下来的处理流程。

Express 官方给出的解释如下：

> Express 是一个自身功能极简，完全是由路由和中间件构成一个的 web 开发框架：从本质上来说，一个 Express 应用就是在调用各种中间件。
>
> *中间件（Middleware）* 是一个函数，它可以访问请求对象（[request object](http://www.expressjs.com.cn/4x/api.html#req) (`req`)）, 响应对象（[response object](http://www.expressjs.com.cn/4x/api.html#res) (`res`)）, 和 web 应用中处于请求-响应循环流程中的中间件，一般被命名为 `next` 的变量。
>
> 中间件的功能包括：
>
> - 执行任何代码。
> - 修改请求和响应对象。
> - 终结请求-响应循环。
> - 调用堆栈中的下一个中间件。
>
> 如果当前中间件没有终结请求-响应循环，则必须调用 `next()` 方法将控制权交给下一个中间件，否则请求就会挂起。
>
> Express 应用可使用如下几种中间件：
>
> - [应用级中间件](http://www.expressjs.com.cn/guide/using-middleware.html#middleware.application)
> - [路由级中间件](http://www.expressjs.com.cn/guide/using-middleware.html#middleware.router)
> - [错误处理中间件](http://www.expressjs.com.cn/guide/using-middleware.html#middleware.error-handling)
> - [内置中间件](http://www.expressjs.com.cn/guide/using-middleware.html#middleware.built-in)
> - [第三方中间件](http://www.expressjs.com.cn/guide/using-middleware.html#middleware.third-party)
>
> 使用可选则挂载路径，可在应用级别或路由级别装载中间件。另外，你还可以同时装在一系列中间件函数，从而在一个挂载点上创建一个子中间件栈。

官方给出的定义其实已经足够清晰，一个中间件的样式其实就是上一节所提到的处理函数，只不过并没有正式命名。所以对于代码来说 Router 类中的 `this.stack` 属性内部的每个 `handle` 都是一个中间件，根据使用接口不同区别了应用级中间件和路由级中间件，而四个参数的处理函数就是错误处理中间件。

接下来就给 expross 框架添加中间件的功能。

首先是应用级中间件，其使用方法是 Application 类上的两种方式：`Application.use` 和 `Application.METHOD` （HTTP 的各种请求方法），后者其实在前面的小节里已经实现了，前者则是需要新增的。

在前面的小节里的代码已经说明 `Application.METHOD` 内部其实是 `Router.METHOD` 的代理，`Application.use` 同样如此。

```
Application.prototype.use = function(fn) {
	var path = '/',
		router = this._router;

	router.use(path, fn);

	return this;
};
```

因为 `Application.use` 支持可选路径，所以需要增加处理路径的重载代码。

```
Application.prototype.use = function(fn) {
	var path = '/',
		router = this._router;

	//路径挂载
	if(typeof fn !== 'function') {
		path = fn;
		fn = arguments[1];
	}

	router.use(path, fn);

	return this;
};
```

其实 Express 框架支持的参数不仅仅这两种，但是为了便于理解剔除了一些旁枝末节，便于框架的理解。

接下来实现 `Router.use` 函数：

```
Router.prototype.use = function(fn) {
	var path = '/';

	//路径挂载
	if(typeof fn !== 'function') {
		path = fn;
		fn = arguments[1];
	}

	var layer = new Layer(path, fn);
	layer.route = undefined;

	this.stack.push(layer);

	return this;
};
```

内部代码和 `Application.use` 差不多，只不过最后不再是调用 `Router.use`，而是直接创建一个 Layer 对象，将其放到 `this.stack` 数组中。

在这里段代码里可以看到普通路由和中间件的区别。普通路由放到 Route 中，且 `Router.route` 属性指向 Route 对象，`Router.handle` 属性指向 `Route.dispatch` 函数；中间件的 `Router.route` 属性为 `undefined`，`Router.handle` 指向中间件处理函数，被放到 `Router.stack` 数组中。

对于路由级中间件，首先按照要求导出 Router 类，便于使用。

```
exports.Router = Router;
```

上面的代码添加到 expross.js 文件中，这样就可以按照下面的使用方式创建一个单独的路由系统。

```
var app = express();
var router = express.Router();

router.use(function (req, res, next) {
  console.log('Time:', Date.now());
});
```

现在问题来了，如果像上面的代码一样创建一个新的路由系统是无法让路由系统内部的逻辑生效的，因为这个路由系统没法添加到现有的系统中。

一种办法是增加一个专门添加新路由系统的接口，这是完全是可行的，但是我更欣赏 Express 框架的办法，这可能是 Router 叫做路由级中间件的原因。Express 将 Router 定义成一个特殊的中间件，而不是一个单独的类。

这样将单独创建的路由系统添加到现有的应用中的代码非常简单通用：

```
var router = express.Router();

// 将路由挂载至应用
app.use('/', router);
```

这确实是一个好方法，现在就来将 expross 修改成类似的样子。

首先调整一下构造函数，使用 `Object.setPrototypeOf` 方法直接继承现有原型对象。

```
var proto = function() {
	function router(req, res, next) {
		router.handle(req, res, next);
	}

	Object.setPrototypeOf(router, proto);

	router.stack = [];
	return router;
};
```

然后将现有的 Router 方法转移到 proto 对象上。

```
proto.handle = function(req, res, done) {...};
proto.route = function route(path) {...};
proto.use = function(fn) { ... };

http.METHODS.forEach(function(method) {
    method = method.toLowerCase();
    proto[method] = function(path, fn) {
    	var route = this.route(path);
    	route[method].call(route, fn);

    	return this;
    };
});

module.exports = proto;
```

结果并不理想，原有的应用程序还有两个地方需要修改。首先是逻辑处理问题。原有的 `Router.handle` 函数中并没有处理中间件的情况，需要进一步修改。

```
proto.handle = function(req, res, done) {
	
	//...
	
	function next(err) {
		
		//...
		
		//注意这里，layer.route属性
		if(layer.match(req.url) && layer.route &&
			layer.route._handles_method(method)) {
			layer.handle_request(req, res, next);
		} else {
			next(layerError);
		}
	}

	next();
};
```
改为：

```
proto.handle = function(req, res, done) {

	//...

	function next(err) {
		
		//...
		
		//匹配，执行
		if(layer.match(req.url)) {
			if(!layer.route) {
				//处理中间件
				layer.handle_request(req, res, next);	
			} else if(layer.route._handles_method(method)) {
				//处理路由
				layer.handle_request(req, res, next);
			}	
		} else {
			next(layerError);
		}
	}

	next();
};
```

其次是路径匹配的问题。原有的单一路径被拆分成为不同中间的路径组合，这里判断需要多步进行，因为每个中间件只是匹配自己的路径是否通过，不过相对而言目前涉及的匹配都是全等匹配，还没有涉及到类似 Express 框架中的正则匹配，算是非常简单了。

想要实现匹配逻辑就要清楚的知道哪段路径和哪个处理函数匹配，这里定义三个变量：

+ `req.originalUrl` 原始请求路径。
+ `req.url` 当前路径。
+ `req.baseUrl` 父路径。

主要修改 `proto.handle` 函数，该函数主要负责提取当前路径段，便于和事先传入的路径进行匹配。

这段代码主要处理两种情况：

第一种，存在路由中间件的情况。如：

```
router.use('/1', function(req, res, next) {
	res.send('first user');
});

router.use('/2', function(req, res, next) {
	res.send('second user');
});

app.use('/users', router);
```

这种情况下，`Router.handle` 顺序匹配到中间的时候，会递归调用 `Router.handle`，所以需要保存当前的路径快照，具体路径相关信息放到 `req.url`、`req.originalUrl` 和 `req.baseUrl` 这三个参数中。

第二种，非路由中间件的情况。如：

```
app.get('/', function(req, res, next) {
	res.send('home');
});

app.get('/books', function(req, res, next) {
	res.send('books');
});
```

这种情况下，`Router.handle` 内部主要是按照栈中的次序匹配路径即可。

改好了处理函数，还需要修改一下 `Layer.match` 这个匹配函数。目前创建 Layer 可能会有三种情况：

+ 不含有路径的中间件。path 属性默认为 `/`。
+ 含有路径的中间件。
+ 普通路由。如果 path 属性为 `*`，表示任意路径。

修改原有 Layer 构造函数，增加一个 fast_star 标记用来判断 path 是否为 `*`。

```
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
```

接着修改 `Layer.match` 匹配函数：

```
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
```

代码中一共判断四种情况，根据 `this.route` 区分中间件和普通路由，然后分开判断。

Express 除了普通的中间件外还要一种错误中间件，专门用来处理错误信息。该中间件的声明和上一小节最后介绍的错误处理函数是一样的，同样是四个参数分别是：`err`、 `req`、 `res` 和 `next`。

目前 `Router.handle` 中，当遇见错误信息的时候，会直接通过回调函数返回错误信息，显示错误页面。

```
if(idx >= stack.length || layerError) {
    return done(layerError);
}
```

这里需要修改策略，如果增加 `layerError` 判断，则会导致流程直接终止。所以需要移除 `layerError` 条件，将错误判断后移：

```

proto.handle = function(req, res, done) {
	
	//...

	function next(err) {

		//...

		//没有找到
		if(idx >= stack.length) {
			return done(layerError);
		}

		//...

		//匹配，执行
		if(layer.match(path)) {

			//处理中间件
			if(!layer.route) {

				//...

				//判断是否发生错误，主动调用人工设置的错误函数
				if(layerError)
					layer.handle_error(layerError, req, res, next);
				else
					layer.handle_request(req, res, next);
					
			} else if(layer.route._handles_method(method)) {
				//处理路由
				layer.handle_request(req, res, next);
			}	
		} else {
			next(layerError);
		}
	}

	next();
};

```

到此为止，expross 的错误处理部分算是基本完成了。

路由系统和中间件两个大的概念算是全部讲解完毕，当然还有很多细节没有完善，在剩下的文字里如果有必要会继续完善。

下一节主要的内容是介绍前后端交互的两个重要成员：request 和 response。Express 在 nodejs 的基础之上进行了丰富的扩展，所以很有必要仿制一下。

## 6. 第五次迭代

本节是 expross 的第五次迭代，主要的目标是封装 request 和 response 两个对象，方便使用。

其实 nodejs 已经给我们提供这两个默认的对象，之所以要封装是因为丰富一下二者的接口，方便框架使用者，目前框架在 response 对象上已经有一个接口：

```
if(!res.send) {
	res.send = function(body) {
		res.writeHead(200, {
			'Content-Type': 'text/plain'
		});
		res.end(body);
	};
}
```

如果需要继续封装，也要类似的结构在代码上添加显然会给人一种很乱的感觉，因为 request 和 response 的原始版本是 nodejs 提供给框架的，框架获取到的是两个对象，并不是类，要想在二者之上提供另一组接口的办法有很多，归根结底就是将新的接口加到该对象上或者加到该对象的原型链上，目前的代码选择了前者，Express 的代码选择了后者。

首先建立两个文件：`request.js` 和 `response.js`，二者分别导出 `req` 和 `res` 对象。

```
//request.js
var http = require('http');

var req = Object.create(http.IncomingMessage.prototype);

module.exports = req;


//response.js
var http = require('http');

var res = Object.create(http.ServerResponse.prototype);

module.exports = res;
```

二者文件的代码都是创建一个对象，分别指向 nodejs 提供的 request 和 response 两个对象的原型，以后 expross 自定的接口可以统一挂载到这两个对象上。

接着修改 `Application.handle` 函数，因为这个函数里面有新鲜出炉的 request 和 response。思路很简单，就是将二者的原型指向我们自建的 `req` 和 `res`。因为 `req` 和 `res` 对象的原型和 request 和 response 的原型相同，所以并不影响原有 nodejs 的接口。

```
var request = require('./request');
var response = require('./response');

...

Application.prototype.handle = function(req, res) {

	Object.setPrototypeOf(req, request);
	Object.setPrototypeOf(res, response);


	...
};
```

这里将原有的 `res.send` 转移到了 response.js 文件中。

```
res.send = function(body) {
	this.writeHead(200, {
		'Content-Type': 'text/plain'
	});
	this.end(body);
};
```

注意函数中不再是 `res.writeHead` 和 `res.end`，而是 `this.writeHead` 和 `this.end`。

在整个路由系统中，`Router.stack` 每一项其实都是一个中间件，每个中间件都有可能用到 `req` 和 `res` 这两个对象，所以代码中修改 nodejs 原生提供的 request 和 response 对象的代码放到了 `Application.handle` 中，这样做并没有问题，但是有一种更好的方式，expross 框架将这部分代码封装成了一个内部中间件。

为了确保框架中每个中间件接收这两个参数的正确性，需要将该内部中间放到 `Router.stack` 的首项。这里将原有 Application 的构造函数中的代码去掉，不再是直接创建 Router() 路由系统，而是用一种惰性加载的方式，动态创建。

去除原有 Application 构造函数的代码。

```
function Application() {}
```

添加惰性初始化函数。

```
var middleware = require('./middleware/init');

Application.prototype.lazyrouter = function() {
	if(!this._router) {
		this._router = new Router();

		this._router.use(middleware.init);
	}
};
```

因为是惰性初始化，所以在使用 `this._router` 对象前，一定要先调用该函数动态创建 `this._router` 对象。类似如下代码：

```
//获取router
this.lazyrouter();
router = this._router;
```

当前代码一共由两处需要添加，一个添加中间的 `Application.prototype.use` 函数：

```
Application.prototype.use = function(fn) {
	var path = '/',
		router;

	//获取router
	this.lazyrouter();
	router = this._router;

	//路径挂载
	if(typeof fn !== 'function') {
		path = fn;
		fn = arguments[1];
	}

	router.use(path, fn);

	return this;
};
```

另一处是添加普通路由的函数：

```
http.METHODS.forEach(function(method) {
    method = method.toLowerCase();
    Application.prototype[method] = function(path, fn) {
		this.lazyrouter();
		
    	this._router[method].apply(this._router, arguments);
    	return this;
    };
});
```

接下来创建一个叫 `middleware` 文件夹，专门放内部中间件的文件，再创建一个 `init.js` 文件，放置 `Application.handle` 中用来初始化 `res` 和 `req` 的代码。

```
var request = require('../request');
var response = require('../response');

//不要忘记移除 Application.handle 中的两行代码！！！

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
```

修改原有的 `Applicaton.handle` 函数。

```
Application.prototype.handle = function(req, res) {

	...

	// 这里无需调用lazyrouter，因为listen前一定调用了 .use 或者 .METHODS 方法。
	// 如果二者都没有调用，没有必要创建路由系统。this._router 为 undefined。
	var router = this._router;
	if(router) {
		router.handle(req, res, done);
	} else {
		done();
	}
};
```

运行 `node test/index.js` 走起……

Express 框架中，request 和 response 两个对象有很多非常好用的函数，不过大部分和框架结构无关，并且这些函数内部过于专研细节，对框架本身的理解没有多少帮助。不过接下来有一个方面需要仔细研究一下，那就是前后端参数的传递，Express 如何获取并分类这些参数的，这一点还是需要略微了解。

默认情况下，一共有三种参数获取方式。

+ `req.query` 代表查询字符串。
+ `req.params` 代表路径变量。
+ `req.body` 代表表单提交变量。

`req.query` 是最常用的方式，例如：

```
// GET /search?q=tobi+ferret
req.query.q
// => "tobi ferret"

// GET /shoes?order=desc&shoe[color]=blue&shoe[type]=converse
req.query.order
// => "desc"

req.query.shoe.color
// => "blue"

req.query.shoe.type
// => "converse"
```

后台获取这些参数最简单的方式就是通过 nodejs 自带的 `querystring` 模块分析 URL。Express 使用的是另一个 npm 包：`qs`。并且将其封装为另一个内部中间件，专门负责解析查询字符串，默认加载。

`req.params` 是另一种从URL获取参数的方式，例如：

```
//路由规则  /user/:name
// GET /user/tj
req.params.name
// => "tj"
```

这是一种 Express 框架规定的参数获取方式，对于批量处理逻辑非常实用。在 expross 中并没有实现，因为路径匹配问题过于细节化，如果对此感兴趣可以研究研究 `path-to-regexp` 模块，Express 也是在其上的封装。

`req.body` 是获取表单数据的方式，但是默认情况下框架是不会去解析这种数据，直接使用只会返回 `undefined`。如果想要支持需要添加其他中间件，例如 `body-parser`  或 `multer`。

本小节主要介绍了 request 和 response 两个对象，并且讲解了一下现有 expross 框架中获取参数的方式，整体上并没有太深入的仿制，主要是这方面内容涉及的细节过多，过于复杂，本质上是一些工具函数的使用方式，知道了就是知道了，感觉没啥太大的帮助，除非重头再造一次轮子。


## 7. 第六次迭代

本小节是第六次迭代，主要的目的是介绍一下 Express 是如何集成现有的渲染引擎的。与渲染引擎有关的事情涉及到下面几个方面：

+ 如何开发或绑定一个渲染引擎。
+ 如何注册一个渲染引擎。
+ 如何指定模板路径。
+ 如何渲染模板引擎。

Express 通过 `app.engine(ext, callback)` 方法即可创建一个你自己的模板引擎。其中，`ext` 指的是文件扩展名、`callback` 是模板引擎的主函数，接受文件路径、参数对象和回调函数作为其参数。

```
//下面的代码演示的是一个非常简单的能够渲染 “.ntl” 文件的模板引擎。

var fs = require('fs'); // 此模板引擎依赖 fs 模块
app.engine('ntl', function (filePath, options, callback) { // 定义模板引擎
  fs.readFile(filePath, function (err, content) {
    if (err) return callback(new Error(err));
    // 这是一个功能极其简单的模板引擎
    var rendered = content.toString().replace('#title#', '<title>'+ options.title +'</title>')
    .replace('#message#', '<h1>'+ options.message +'</h1>');
    return callback(null, rendered);
  })
});
```

为了让应用程序可以渲染模板文件，还需要做如下设置：

```
//views, 放模板文件的目录
app.set('views', './views')
//view engine, 模板引擎
app.set('view engine', 'ntl')
```

一旦 `view engine` 设置成功，就不需要显式指定引擎，或者在应用中加载模板引擎模块，Express 已经在内部加载。下面是如何渲染页面的方法：

```
app.get('/', function (req, res) {
  res.render('index', { title: 'Hey', message: 'Hello there!'});
});
```

要想实现上述功能，首先在 Application 类中定义两个变量，一个存储 `app.set` 和 `app.get` 这两个方法存储的值，另一个存储模板引擎中扩展名和渲染函数的对应关系。

然后是实现 `app.set` 函数：

```
Application.prototype.set = function(setting, val) {
  	if (arguments.length === 1) {
	  // app.get(setting)
	  return this.settings[setting];
	}
  
	this.settings[setting] = val;
	return this;
};
```

代码中不仅仅实现了设置，如何传入的参数只有一个等价于 `get` 函数。

接着实现 `app.get` 函数。因为现在已经有了一个 `app.get` 方法用来设置路由，所以需要在该方法上进行重载。

```
http.METHODS.forEach(function(method) {
    method = method.toLowerCase();
    Application.prototype[method] = function(path, fn) {
    	if(method === 'get' && arguments.length === 1) {
    		// app.get(setting)
    		return this.set(path);
    	}

		...
    };
});
```

最后实现 `app.engine` 进行扩展名和引擎函数的映射。

```
Application.prototype.engine = function(ext, fn) {
	// get file extension
	var extension = ext[0] !== '.'
	  ? '.' + ext
	  : ext;

	// store engine
	this.engines[extension] = fn;

	return this;
};
```

扩展名当做 key，统一添加 “.”。到此设置模板引擎相关信息的函数算是完成，接下来就是最重要的渲染引擎函数的实现。

```
res.render = function(view, options, callback) {
  	var app = this.req.app;
	var done = callback;
	var opts = options || {};
	var self = this;

	//如果定义回调，则返回，否则渲染
	done = done || function(err, str) {
		if(err) {
			return self.req.next(err);
		}

		self.send(str);
	};

	//渲染
	app.render(view, opts, done);
};
```

渲染函数一共有三个参数，`view` 表示模板的名称，`options` 是模板渲染的变量，`callback` 是渲染成功后的回调函数。函数内部直接调用 `render` 函数进行渲染，渲染完成后调用 `done` 回调。这里有两个地方需要注意下，第一个是 `this.req.app` 变量，另一个是 `self.req.next` 函数，二者目前都没有实现。

这里先定义 `req.app` 变量，这个变量初始化需要 application 对象，方法很多，这里使用最简单的方法，直接在 `expressInit` 中赋值：

```
exports.init = function (app) {
	return function expressInit(req, res, next) {
		//request文件可能用到res对象
		req.res = res;

		//response文件可能用到req对象
		res.req = req;

		//赋值
		req.app = app;

		//修改原始req和res原型
		Object.setPrototypeOf(req, request);
		Object.setPrototypeOf(res, response);

		//继续
		next();
	};
};
```

然后修改 `Application.prototype.lazyrouter` 函数，传入 app 变量：

```
Application.prototype.lazyrouter = function () {
	if (!this._router) {
		this._router = new Router();

		this._router.use(middleware.init(this));
	}
};
```


接着定义 `req.next` 变量：

```
//如果定义回调，则返回，否则渲染
done = done || function (err, str) {
	if (err) {
		return self.req.next(err);
	}
	self.send(str);
};
```

`req.next` 函数默认是没有定义的，这里需要赋值一下，在 `Router.handle` 函数中，可以保存 `next` 函数：

```
proto.handle = function(req, res, done) {
	
	//...

	//保存原始路径
	req.orginalUrl = req.orginalUrl || req.url;
	
	// setup next layer
	req.next = next;

	//....
}
```

接下来创建一个 `view.js` 文件，主要功能是负责各种模板引擎和框架间的隔离，保持对内接口的统一性。

```
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


	// store loaded engine
	this.engine = opts.engines[this.ext];

	// lookup path
	this.path = this.lookup(fileName);
}
```

View 类内部定义了很多属性，主要包括引擎、根目录、扩展名、文件名等等，为了以后的渲染做准备。

```
View.prototype.render = function render(options, callback) {
	this.engine(this.path, options, callback);
};
```

View 的渲染函数内部就是调用一开始注册的引擎渲染函数。了解了 View 的定义，接下来实现 `app.render` 模板渲染函数。

```
Application.prototype.render = function(name, options, callback) {
	var done = callback;
	var engines = this.engines;
	var opts = options;

	view = new View(name, {
	  defaultEngine: this.get('view engine'),
	  root: this.get('views'),
	  engines: engines
	});


	if (!view.path) {
      var err = new Error('Failed to lookup view "' + name + '"');
      return done(err);
    }


	try {
	  view.render(options, callback);
	} catch (e) {
	  callback(e);
	}
};
```

*`view.js` 文件还有一些细节没有在教程中展示出来，可以参考 github 上传的案例代码。*

运行 `node test/index.js`，查看效果。

上面的代码是自己注册的引擎，如果想要和现有的模板引擎结合还需要在回调函数中引用模板自身的渲染方法，当然为了方便，Express 框架内部提供了一个默认方法，如果模板引擎导出了该方法，则表示该模板引擎支持 Express 框架，无需使用 `app.engine` 再次封装。

该方法声明如下：

```
 __express(filePath, options, callback)
```

可以参考 ejs 模板引擎的代码，看看它们是如何写的：

```
//该行代码在lib/ejs.js文件的355行左右
exports.__express = exports.renderFile;
```

Express 框架是如何实现这个默认加载的功能的呢？很简单，只需要在 View 的构造函数中加一个判断即可。

```
if (!opts.engines[this.ext]) {
  // load engine
  var mod = this.ext.substr(1);
  opts.engines[this.ext] = require(mod).__express;
}
```

代码逻辑很简单，如果没有找到引擎对应的渲染函数，那就尝试加载 __express 函数。

## 8. 后记

至此，算是结束本篇文章了。这是第三次修改本文，并没有修改整体框架，主要是细微的排版，和修改过去记录不太准确的地方。

简单的说一下还有哪里没有介绍。

+ 关于 Application。
如果稍微看过 expross 代码的人都会发现，Application 并不是想我写的这样是一个类，而是一个中间件，一个对象，该对象使用了 `mixin` 方法的多继承手段，`express.js` 文件中的 `createApplication` 函数算是整个框架的切入点。

+ 关于 `Router.handle`。
这个函数可以说是整个 Express 框架的核心，如果理解了该函数，整个框架基本上就掌握了。我在仿制的时候舍弃了很多细节，在这里个函数里面内部有两个个关键点没说。一、处理 URL 形式的参数，这里涉及对 `params` 参数的提取过程。其中有一个 restore 函数使用高阶函数的方法做了缓存，仔细体会很有意思。二、`setImmediate` 异步返回，之所以要使用异步处理，是因为下面的代码需要运行，包括路径相关的参数，这些参数在下一个处理函数中可能会用到，这是一种常见的异步迭代手法。

+ 关于其它函数。
太多函数了，不一一列举，前文已经提到，涉及的细节太多，正则表达式，HTTP 协议层，nodejs 本身函数的使用，对于整个框架的理解帮助不大，全部舍弃。不过大多数函数都是自成体系，很好理解。