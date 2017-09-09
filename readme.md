# express 源码阅读

## 1. 简介

这篇文章主要的目的是分析理解express的源码，网络上关于源码的分析已经数不胜数，这篇文章准备另辟蹊径，仿制一个express的轮子，通过测试驱动的开发方式不断迭代，正向理解express的代码。

这篇文章中的express源码是参考官网最新版本（v4.15.4），文章的整体思路是参考早期创作的[另一篇文章](https://segmentfault.com/a/1190000005833119)，这篇算是其升级版本。

如果你准备通过本文学习express的基本原理，前提条件最好有一定的express使用经验，写过一两个基于express的应用程序，否则对于其背后的原理理解起来难以产生共鸣，不易掌握。

代码链接：

## 2. 框架初始化

在仿制express框架前，首先完成两件事。

+ 确认需求。
+ 确认结构。

首先确认需求，从express的官方网站入手。网站有一个Hello world 的事例程序，想要仿制express，该程序肯定需要通过测试，将改代码复制保存到测试目录`test/index.js`。

```javascript
const express = require('express')
const app = express()

app.get('/', function (req, res) {
  res.send('Hello World!')
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})
```

接下来，确认框架的名称以及目录结构。框架的名称叫做`expross`。目录结构如下：

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

让`expross/index.js`文件加载`lib`目录下的`expross.js`文件。

```javascript
module.exports = require('./lib/expross');
```

通过*测试程序前两行*可以推断`lib/expross.js`导出结果应该是一个**函数**，所以在`expross.js`文件中添加如下代码：

```javascript
function createApplication() {
  return {};
}

exports = module.exports = createApplication;
```

测试程序中包含两个函数，所以暂时将`createApplication`函数体实现如下：

```javascript
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

虽然无法得到想要的结果，但至少可以将测试程序跑通，函数的核心内容可以在接下来的步骤中不断完善。

至此，初始框架搭建完毕，修改`test/index.js`文件的前两行：

````javascript
const expross = require('../');
const app = expross();
````

运行`node test/index.js`查看结果。

## 2. 第一次迭代

本节是expross的第一次迭代，主要实现的目标是将当前的测试用例功能完整实现，一共分两部分：

+ 实现http服务器。
+ 实现get路由请求。

实现http服务器比较简单，可以参考nodejs官网的实现。

```javascript
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

参考该案例，实现`expross`的`listen`函数。

```javascript
listen: function(port, cb) {
	var server = http.createServer(function(req, res) {
		console.log('http.createServer...');
	});

	return server.listen(port, cb);
}
```

当前`listen`函数包含了两个参数，但是`http.listen`有很多重载函数，为了和`http.listen`一致，可以将函数设置为`http.listen`的“代理”，这样可以保持`expross().listen`和`http.listen`的参数统一。

```javascript
listen: function(port, cb) {
	var server = http.createServer(function(req, res) {
		console.log('http.createServer...');
	});

  	//代理
	return server.listen.apply(server, arguments);
}
```

在`listen`函数中，我们拦截了所有http请求，每次http请求都会打印`http.createServer ...`,之所以拦截http请求，是因为expross需要分析每次http请求，根据http请求的不同来处理不同的业务逻辑。

在底层：

一个http请求主要包括请求行、请求头和消息体，nodejs将常用的数据封装为http.IncomingMessage类，在上面的代码中req就是该类的一个对象。

每个http请求都会对应一个http响应。一个http响应主要包括状态行、响应头、消息体，nodejs将常用的数据封装为http.ServerResponse类，在上面的代码中res就是该类的一个对象。

不仅仅是nodejs，基本上所有的http服务框架都会包含request和response两个对象，分别代表着http的请求和响应，负责服务端和浏览器的交互。

在上层：

服务器后台代码根据http请求的不同，绑定不同的逻辑。在真正的http请求来临时，匹配这些http请求，执行与之对应的逻辑，这个过程就是web服务器基本的执行流程。

对于这些http请求的管理，有一个专有名词 —— “**路由管理**”，每个http请求就默认为一个**路由**，常见的路由区分策略包括URL、HTTP请求名词等等，但不仅仅限定这些，所有的http请求头上的参数其实都可以进行判断区分，例如使用user-agent字段判断移动端。

不同的框架对于路由的管理规则略有不同，但不管怎样，都需要一组管理http请求和业务逻辑映射的函数，测试用例中的`get`函数就是路由管理中的一个函数，主要负责添加get请求。

既然知道路由管理的重要，这里就创建一个router数组，负责管理所有路由映射。参考express框架，抽象出每个路由的基本属性：

+ path 请求路径，例如：/books、/books/1。
+ method 请求方法，例如：GET、POST、PUT、DELETE。
+ handle 处理函数。

```javascript
var router = [{
	path: '*',
	method: '*',
	handle: function(req, res) {
		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end('404');
	}
}];
```

修改listen函数，将http请求拦截逻辑改为匹配router路由表，如果匹配成功，执行对应的handle函数，否则执行router[0].handle函数。

```javascript
listen: function(port, cb) {
	var server = http.createServer(function(req, res) {
		
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

实现get路由请求非常简单，该函数主要是添加get请求路由，只需要将其信息加入到router数组即可。

```javascript
get: function(path, fn) {
	router.push({
		path: path,
		method: 'GET',
		handle: fn
	});
}
```

执行测试用例，报错，提示res.send不存在。该函数并不是nodejs原生函数，这里在res上临时添加函数send，负责发送相应到浏览器。

```javascript
listen: function(port, cb) {
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

在结束这次迭代之前，拆分整理一下程序目录：

创建application.js文件，将createApplication函数中的代码转移到该文件，expross.js文件只保留引用。

```javascript
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

最后，运行`node test/index.js`，打开浏览器访问`http://127.0.0.1:3000/`。

## 3. 第二次迭代

本节是expross的第二次迭代，主要的目标是构建一个初步的路由系统。根据上一节的改动，目前的路由是用一个router数组进行描述管理，对于router的操作有两个，分别是在application.get函数和application.listen函数，前者用于添加，后者用来处理。

按照面向对象的封装法则，接下来将路由系统的数据和路由系统的操作封装到一起定义一个 Router类负责整个路由系统的主要工作。

```javascript
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
```

修改原有的application.js文件的内容。

```javascript
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

这样以后路由方面的操作只和Router本身有关，与application分离，使代码更加清晰。

这个路由系统正常运行时没有问题的，但是如果路由不断的增多，this.stack数组会不断的增大，匹配的效率会不断降低，为了解决效率的问题，需要仔细分析路由的组成成分。

目前在expross中，一个路由是由三个部分构成：路径、方法和处理函数。前两者的关系并不是一对一的关系，而是一对多的关系，如：

```
GET books/1
PUT books/1
DELETE books/1
```

如果将路径一样的路由整合成一组，显然效率会提高很多，于是引入Layer的概念。

这里将Router系统中this.stack数组的每一项，代表一个Layer。每个Layer内部含有三个变量。

+ path，表示路由的路径。
+ handle，代表路由的处理函数。
+ route，代表真正的路由。

整体结构如下图所示：

```
------------------------------------------------
|     0     |     1     |     2     |     3     |      
------------------------------------------------
| Layer     | Layer     | Layer     | Layer     |
|  |- path  |  |- path  |  |- path  |  |- path  |
|  |- handle|  |- handle|  |- handle|  |- handle|
|  |- route |  |- route |  |- route |  |- route |
------------------------------------------------
                  router 内部
```

这里先创建Layer类。

```javascript
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
```

再次修改Router类。

```javascript
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
```

运行`node test/index.js`，访问`http://127.0.0.1:3000/`一切看起来很正常，但是上面的代码忽略了路由的属性method。这样的结果会导致如果测试用例存在问题：

```javascript
app.put('/', function(req, res) {
	res.send('put Hello World!');
});

app.get('/', function(req, res) {
	res.send('get Hello World!');
});
```

程序无法分清PUT和GET的区别。

所以需要继续完善路由系统中的Layer类中的route属性，这个属性才是真正包含method属性的路由。

route的结构如下：

```
------------------------------------------------
|     0     |     1     |     2     |     3     |      
------------------------------------------------
| item      | item      | item      | item      |
|  |- method|  |- method|  |- method|  |- method|
|  |- handle|  |- handle|  |- handle|  |- handle|
------------------------------------------------
                  route 内部
```

创建Route类。

```javascript
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
```

在上面的代码中，并没有定义前面结构图中的item对象，而是使用了Layer对象进行替代，主要是为了方便快捷，从另一种角度看，其实二者是存在很多共同点的。另外，为了利于理解，代码中只实现了GET方法，其他方法的代码实现是类似的。

既然有了Route类，接下来就改修改原有的Router类，将route集成其中。

```javascript
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


Router.prototype.route = function route(path) {
    var route = new Route(path);

    var layer = new Layer(path, function(req, res) {
        route.dispatch(req, res);
    });

    layer.route = route;

    this.stack.push(layer);
    
    return route;
};


Router.prototype.get = function(path, fn) {
    var route = this.route(path);
    route.get(fn);

    return this;
};
```

运行`node test/index.js`，一切看起来和原来一样。

这节内容主要是创建一个完整的路由系统，并在原始代码的基础上引入了Layer和Route两个概念，并修改了大量的代码，在结束本节前总结一下目前的信息。

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

接着，总结一下当前expross各个部分的工作。

application代表一个应用程序，expross是一个工厂类负责创建application对象。Router代表路由组件，负责应用程序的整个路由系统。组件内部由一个Layer数组构成，每个Layer代表一组路径相同的路由信息，具体信息存储在Route内部，每个Route内部也是一个Layer对象，但是Route内部的Layer和Router内部的Layer是存在一定的差异性。

+ Router内部的Layer，主要包含path、route属性。
+ Route内部的Layer，主要包含method、handle属性。

如果一个请求来临，会现从头至尾的扫描router内部的每一层，而处理每层的时候会先对比URI，相同则扫描route的每一项，匹配成功则返回具体的信息，没有任何匹配则返回未找到。

最后，整个路由系统的结构如下：

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

## 3. 第三次迭代

本节是expross的第三次迭代，主要的目标是继续完善路由系统，主要工作有部分：

+ 丰富接口，目前只支持get接口。
+ 增加路由系统的流程控制。

当前expross框架只支持get接口，具体的接口是由expross提供的，内部调用Router.get接口，而其内部是对Route.get的封装。

HTTP显然不仅仅只有GET这一个方法，还包括很多，例如：PUT、POST、DELETE等等，每个方法都单独写一个处理函数显然是冗余的，因为函数的内容除了和函数名相关外，其他都是一成不变的。根据JavaScript脚本语言语言的特性，这里可以通过HTTP的方法列表动态生成函数内容。

想要动态生成函数，首先需要确定函数名称。函数名就是nodejs中HTTP服务器支持的方法名称，可以在官方文档中获取，具体参数是`http.METHODS`。这个属性是在v0.11.8新增的，如果nodejs低于该版本，需要手动建立一个方法列表，具体可以参考nodejs代码。

express框架HTTP方法名的获取封装到另一个包，叫做`methods`，内部给出了低版本的兼容动词列表。

```javascript
function getBasicNodeMethods() {
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
  ];
}
```

知道所支持的方法名列表数组后，剩下的只需要一个for循环生成所有的函数即可。

所有的动词处理函数的核心内容都在Route中。

```javascript
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

接着修改Router。

```javascript
http.METHODS.forEach(function(method) {
    method = method.toLowerCase();
    Router.prototype[method] = function(path, fn) {
    	var route = this.route(path);
    	route[method].call(route, fn);

    	return this;
    };
});
```

最后修改application.js的内容。这里改动较大，重新定义了一个Application类，而不是使用字面量直接创建。

```javascript
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
```

接着增加HTTP方法函数。

```javascript
http.METHODS.forEach(function(method) {
    method = method.toLowerCase();
    Application.prototype[method] = function(path, fn) {
    	this._router[method].apply(this._router, arguments);
    	return this;
    };
});
```

因为导出的是Application类，所以修改expross.js文件。

```javascript
var Application = require('./application');

function createApplication() {
	var app = new Application();
	return app;
}
```

运行`node test/index.js`，走起。

如果你仔细研究路由系统的源码，会发现route本身的定义并不是像文字描述那样。例如：

增加两个同样路径的路由：

```javascript
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



之所以会这样是因为路由系统存在这先后顺序的关系，如果你前面的描述结构很有可能会丢失路由顺序这个属性。既然这样，那Route的用处是在哪？

因为在express框架中，Route存储的是真正的路由信息，可以当做单独的成员使用，如果想要真正前面的所描述的结果描述，你需要这样创建你的代码：

```javascript
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

而不是这样：

```javascript
var app = expross();

app.get('/users/:user_id', function(req, res) {
	
})

.put('/users/:user_id', function(req, res) {
	
})

.post('/users/:user_id', function(req, res) {
	
})

.delete('/users/:user_id', function(req, res) {
	
});
```

理解了Route的使用方法，接下来就要讨论刚刚提到的顺序问题。在路由系统中，路由的处理顺序非常重要，因为路由是按照数组的方式存储的，如果遇见两个同样的路由，同样的方法名，不同的处理函数，这时候前后声明的顺序将直接影响结果（这也是express中间件存在顺序相关的原因），例如下面的例子：

```javascript
app.get('/', function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('first');
});

app.get('/', function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('second');
});
```

上面的代码如果执行会发现永远都返回`first`，但是有的时候会根据前台传来的参数动态判断是否执行接下来的路由，怎样才能跳过`first`进入`second`？这就涉及到路由系统的流程控制问题。

流程控制分为主动和被动两种模式。

对于expross框架来说，路由绑定的处理逻辑、用户设置的路径参数这些都是不可靠的，在运行过程中很有可能会发生异常，被动流程控制就是当这些异常发生的时候，expross框架要担负起捕获这些异常的工作，因为如果不明确异常的发生位置，会导致js代码无法继续运行，并且无法准确的报出故障。

主动流程控制则是处理函数内部的操作逻辑，以主动调用的方式来跳转路由内部的执行逻辑。

目前express通过引入next参数的方式来解决流程控制问题。next是处理函数的一个参数，其本身也是一个函数，该函数有几种使用方式：

+ 执行下一个处理函数。执行`next()`。
+ 报告异常。执行`next(err)`。
+ 跳过当前Route，执行Router的下一项。执行`next('route')`。
+ 跳过整个Router。执行`next('router')`。

接下来，我们尝试实现以下这些需求。

首先修改最底层的Layer对象，该对象的`handle_request`函数是负责调用路由绑定的处理逻辑，这里添加next参数，并且增加异常捕获功能。

```javascript
Layer.prototype.handle_request = function (req, res, next) {
  var fn = this.handle;

  try {
    fn(req, res, next);
  } catch (err) {
    next(err);
  }
};
```

接下来修改Route.dispath函数。因为涉及到内部的逻辑跳转，使用for循环按部就班不太合适，这里使用了类似递归的方式。

```javascript
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

整个处理过程本质上还是一个for循环，唯一的差别就是在处理函数中用户主动调用next函数的处理逻辑。

如果用户通过next函数返回错误、`route`和`router`这三种情况，目前统一抛给Router处理。

因为修改了dispatch函数，所以调用该函数的Router.route函数也要修改，这回直接改彻底，以后无需根据参数的个数进行调整。

```javascript
Router.prototype.route = function route(path) {
    ...
    
	//使用bind方式
    var layer = new Layer(path, route.dispatch.bind(route));
    
    ...
};
```

接着修改Router.handle的代码，逻辑和Route.dispatch类似。

```javascript
Router.prototype.handle = function(req, res, done) {
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

修改后的函数处理过程和原来的类似，不过有一点需要注意，当发生异常的时候，会将结果返回给上一层，而不是执行原有`this.stack`第0层的代码逻辑。

最后增加expross框架异常处理的逻辑。

在之前，可以移除原有this.stack的初始化代码，将

```javascript
var Router = function() {
	this.stack = [new Layer('*', function(req, res) {
		res.writeHead(200, {
			'Content-Type': 'text/plain'
		});
		res.end('404');		
	})];
};
```

改为

```
var Router = function() {
	this.stack = [];
};
```

然后，修改Application.handle函数。

```javascript
Application.prototype.handle = function(req, res) {
  
	...
    
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

这里简单的将done函数处理为返回404页面，其实在express框架中，使用的是一个单独的npm包，叫做`finalhandler`。

简单的修改一下测试用例证明一下成果。

```javascript
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

运行`node test/index.js`，访问`http://127.0.0.1:3000/`，结果显示：

```
404: Error: error
```

貌似目前一切都很顺利，不过还有一个需求目前被忽略了。当前处理函数的异常全部是由框架捕获，返回的信息只能是固定的404页面，对于框架使用者显然很不方便，大多数时候，我们都希望可以捕获错误，并按照一定的信息封装返回给浏览器，所以expross需要一个返回错误给上层使用者的接口。

目前和上层对接的处理函数的声明如下：

```javascript
function process_fun(req, res, next) {
  
}
```

如果增加一个错误处理函数，按照nodejs的规则，第一个参数是错误信息，定义应该如下所示：

```javascript
function process_err(err, req, res, next) {
  
}
```

因为两个声明的第一个参数信息是不同的，如果区分传入的处理函数是处理错误的函数还是处理正常的函数，这个是expross框架需要搞定的关键问题。

javascript中，Function.length属性可以获取传入函数指定的参数个数，这个可以当做区分二者的关键信息。

既然确定了原理，接下来直接在Layer类上增加一个专门处理错误的函数，和处理正常信息的函数区分开。

```javascript
//错误处理
Layer.prototype.handle_error = function (error, req, res, next) {
  var fn = this.handle;

  //如果函数参数不是标准的4个参数，返回错误信息
  if(fn.length !== 4) {
    return next(error);
  }

  try {
    fn(error, req, res, next);
  } catch (err) {
    next(err);
  }
};
```

接着修改Route.dispatch函数。

```javascript
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

当发生错误的时候，Route会一直向后寻找错误处理函数，如果找到则返回，否则执行`done(err)`，将错误抛给Router。

对于Router.handle的修改，因为涉及到一些中间件的概念，完整的错误处理将推移到下一节完成。

本节的内容基本上完成，包括HTTP相关的动作接口的添加、路由系统的流程跳转以及Route级别的错误响应等等，涉及到路由系统剩下的一点内容暂时放到以后讲解。

## 4. 第四次迭代

本节是expross的第四次迭代，主要的目标是建立中间件机制并继续完善路由系统的功能。

在express中，中间件其实是一个介于web请求来临后到调用处理函数前整个流程体系中间调用的组件。其本质是一个函数，内部可以访问修改请求和响应对象，并调整接下来的处理流程。

express官方给出的解释如下：

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

官方给出的定义其实已经足够清晰，一个中间件的样式其实就是上一节所提到的处理函数，只不过并没有正式命名。所以对于代码来说Router类中的this.stack属性内部的每个handle都是一个中间件，根据使用接口不同区别了**应用级中间件**和**路由级中间件**，而四个参数的处理函数就是**错误处理中间件**。

接下来就给expross框架添加中间件的功能。

首先是应用级中间件，其使用方法是Application类上的两种方式：Application.use 和 Application.METHOD (HTTP的各种请求方法），后者其实在前面的小节里已经实现了，前者则是需要新增的。

在前面的小节里的代码已经说明Application.METHOD内部其实是Router.METHOD的代理，Application.use同样如此。

```javascript
Application.prototype.use = function(fn) {
	var path = '/',
		router = this._router;

	router.use(path, fn);

	return this;
};
```

因为Application.use支持可选路径，所以需要增加处理路径的重载代码。

```javascript
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

其实express框架支持的参数不仅仅这两种，但是为了便于理解剔除了一些旁枝末节，便于框架的理解。

接下来实现Router.use函数。

```javascript
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

内部代码和Application.use差不多，只不过最后不再是调用Router.use，而是直接创建一个Layer对象，将其放到this.stack数组中。

在这里段代码里可以看到普通路由和中间件的区别。普通路由放到Route中，且Router.route属性指向Route对象，Router.handle属性指向Route.dispatch函数；中间件的Router.route属性为undefined，Router.handle指向中间件处理函数，被放到Router.stack数组中。

对于路由级中间件，首先按照要求导出Router类，便于使用。

```javascript
exports.Router = Router;
```

上面的代码添加到expross.js文件中，这样就可以按照下面的使用方式创建一个单独的路由系统。

```javascript
var app = express();
var router = express.Router();

router.use(function (req, res, next) {
  console.log('Time:', Date.now());
});
```

现在问题来了，如果像上面的代码一样创建一个新的路由系统是无法让路由系统内部的逻辑生效的，因为这个路由系统没法添加到现有的系统中。

一种办法是增加一个专门添加新路由系统的接口，是完全是可行的，但是我更欣赏express框架的办法，这可能是Router叫做路由级中间件的原因。express将Router定义成一个特殊的中间件，而不是一个单独的类。

这样将单独创建的路由系统添加到现有的应用中的代码非常简单通用：

```javascript
var router = express.Router();

// 将路由挂载至应用
app.use('/', router);
```

这确实是一个好方法，现在就来将expross修改成类似的样子。

首先创建一个原型对象，将现有的Router方法转移到该对象上。

```javascript
var proto = {};

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
```

然后创建一个中间件函数，使用Object.setPrototypeOf函数设置其原型，最后导出一个生成这些过程的函数。

```javascript
module.exports = function() {
	function router(req, res, next) {
		router.handle(req, res, next);
	}

	Object.setPrototypeOf(router, proto);

	router.stack = [];
	return router;
};
```

修改测试用例，测试一下效果。

```javascript
app.use(function(req, res, next) {
	console.log('Time：', Date.now());
	next();
});

app.get('/', function(req, res, next) {
	res.send('first');
});


router.use(function(req, res, next) {
	console.log('Time: ', Date.now());
	next();
});

router.use('/', function(req, res, next) {
	res.send('second');
});

app.use('/user', router);

app.listen(3000, function() {
	console.log('Example app listening on port 3000!');
});
```

结果并不理想，原有的应用程序还有两个地方需要修改。

首先是逻辑处理问题。原有的Router.handle函数中并没有处理中间件的情况，需要进一步修改。

```javascript
proto.handle = function(req, res, done) {
	
	...
	
	function next(err) {
		
		...
		
		//注意这里，layer.route属性
		if(layer.match(req.url) && layer.route &&
			layer.route._handles_method(method)) {
			layer.handle_request(req, res, next);
		} else {
			layer.handle_error(layerError, req, res, next);
		}
	}

	next();
};
```

改成：

```javascript
proto.handle = function(req, res, done) {

	...

	function next(err) {
		
		...
		
		//匹配，执行
		if(layer.match(path)) {
			if(!layer.route) {
				//处理中间件
				layer.handle_request(req, res, next);	
			} else if(layer.route._handles_method(method)) {
				//处理路由
				layer.handle_request(req, res, next);
			}	
		} else {
			layer.handle_error(layerError, req, res, next);
		}
	}

	next();
};
```

其次是路径匹配的问题。原有的单一路径被拆分成为不同中间的路径组合，这里判断需要多步进行，因为每个中间件只是匹配自己的路径是否通过，不过相对而言目前涉及的匹配都是全等匹配，还没有涉及到类似express框架中的正则匹配，算是非常简单了。

想要实现匹配逻辑就要清楚的知道哪段路径和哪个处理函数匹配，这里定义三个变量：

+ req.originalUrl 原始请求路径。
+ req.url 当前路径。
+ req.baseUrl 父路径。

主要修改Router.handle函数，该函数主要负责提取当前路径段，便于和事先传入的路径进行匹配。

```javascript
proto.handle = function(req, res, done) {
	var self = this,
	    method = req.method,
	    idx = 0, stack = self.stack,
	    removed = '', slashAdded = false;


	//获取当前父路径
	var parentUrl = req.baseUrl || '';
	//保存父路径
	req.baseUrl = parentUrl;
	//保存原始路径
	req.orginalUrl = req.orginalUrl || req.url;


	function next(err) {
		var layerError = (err === 'route' ? null : err);

		//如果有移除，复原原有路径
		if(slashAdded) {
			req.url = '';
			slashAdded = false;
		}


		//如果有移除，复原原有路径信息
		if(removed.length !== 0) {
			req.baseUrl = parentUrl;
			req.url = removed + req.url;
			removed = '';
		}


		//跳过路由系统
		if(layerError === 'router') {
			return done(null);
		}


		if(idx >= stack.length || layerError) {
		    return done(layerError);
		}

		//获取当前路径
		var path = require('url').parse(req.url).pathname;

		var layer = stack[idx++];
		//匹配，执行
		if(layer.match(path)) {

			//处理中间件
			if(!layer.route) {
				//要移除的部分路径
				removed = layer.path;

				//设置当前路径
				req.url = req.url.substr(removed.length);
				if(req.url === '') {
					req.url = '/' + req.url;
					slashAdded = true;
				}

				//设置当前路径的父路径
				req.baseUrl = parentUrl + removed;

				//调用处理函数
				layer.handle_request(req, res, next);	
			} else if(layer.route._handles_method(method)) {
				//处理路由
				layer.handle_request(req, res, next);
			}	
		} else {
			layer.handle_error(layerError, req, res, next);
		}
	}

	next();
};
```

这段代码主要处理两种情况：

第一种，存在路由中间件的情况。如：

```javascript
router.use('/1', function(req, res, next) {
	res.send('first user');
});

router.use('/2', function(req, res, next) {
	res.send('second user');
});

app.use('/users', router);
```

这种情况下，Router.handle顺序匹配到中间的时候，会递归调用Router.handle，所以需要保存当前的路径快照，具体路径相关信息放到req.url、req.originalUrl 和req.baseUrl 这三个参数中。

第二种，非路由中间件的情况。如：

```javascript
app.get('/', function(req, res, next) {
	res.send('home');
});

app.get('/books', function(req, res, next) {
	res.send('books');
});
```

这种情况下，Router.handle内部主要是按照栈中的次序匹配路径即可。

改好了处理函数，还需要修改一下Layer.match这个匹配函数。目前创建Layer可能会有三种情况：

+ 不含有路径的中间件。path属性默认为`/`。
+ 含有路径的中间件。
+ 普通路由。如果path属性为`*`，表示任意路径。

修改原有Layer是构造函数，增加一个fast_star 标记用来判断path是否为*。

```javascript
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

接着修改Layer.match匹配函数。

```javascript
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

代码中一共判断四种情况，根据this.route区分中间件和普通路由，然后分开判断。

express除了普通的中间件外还要一种错误中间件，专门用来处理错误信息。该中间件的声明和上一小节最后介绍的错误处理函数是一样的，同样是四个参数分别是：err、 req、 res和 next。

目前Router.handle中，当遇见错误信息的时候，会直接通过回调函数返回错误信息，显示错误页面。

```javascript
if(idx >= stack.length || layerError) {
    return done(layerError);
}
```

这里需要修改策略，将其改为继续调用下一个中间件，直到碰到错误中间件为止。

```javascript
//没有找到
if(idx >= stack.length) {
    return done(layerError);
}
```

原有这一块的代码只保留判断枚举是否完成，将错误判断转移到最后执行处理函数的位置。之所以这样做是因为不管是执行处理函数，或是执行错误处理都需要进行路径匹配操作和路径分析操作，所以放到后面正好合适。

```javascript
//处理中间件
if(!layer.route) {

	...

	//调用处理函数
	if(layerError)
		layer.handle_error(layerError, req, res, next);
	else
		layer.handle_request(req, res, next);
	
} else if(layer.route._handles_method(method)) {
	//处理路由
	layer.handle_request(req, res, next);
}	
```

到此为止，expross的错误处理部分算是基本完成了。

路由系统和中间件两个大的概念算是全部讲解完毕，当然还有很多细节没有完善，在剩下的文字里如果有必要会继续完善。

下一节主要的内容是介绍前后端交互的两个重要成员：request和response。express在nodejs的基础之上进行了丰富的扩展，所以很有必要仿制一下。

## 5. 第五次迭代

本节是expross的第五次迭代，主要的目标是封装request和response两个对象，方便使用。

其实nodejs已经给我们提供这两个默认的对象，之所以要封装是因为丰富一下二者的接口，方便框架使用者，目前框架在response对象上已经有一个接口：

```javascript
if(!res.send) {
	res.send = function(body) {
		res.writeHead(200, {
			'Content-Type': 'text/plain'
		});
		res.end(body);
	};
}
```

如果需要继续封装，也要类似的结构在代码上添加显然会给人一种很乱的感觉，因为request和response的原始版本是nodejs提供给框架的，框架获取到的是两个对象，并不是类，要想在二者之上提供另一组接口的办法有很多，归根结底就是将新的接口加到该对象上或者加到该对象的原型链上，目前的代码选择了前者，express的代码选择了后者。

首先建立两个文件：request.js 和 response.js，二者分别导出req和res对象。

```javascript
//request.js
var http = require('http');

var req = Object.create(http.IncomingMessage.prototype);

module.exports = req;


//response.js
var http = require('http');

var res = Object.create(http.ServerResponse.prototype);

module.exports = res;
```

二者文件的代码都是创建一个对象，分别指向nodejs提供的request和response两个对象的原型，以后expross自定的接口可以统一挂载到这两个对象上。

接着修改Application.handle函数，因为这个函数里面有新鲜出炉的request和response。思路很简单，就是将二者的原型指向我们自建的req和res。因为req和res对象的原型和request和response的原型相同，所以并不影响原有nodejs的接口。

```javascript
var request = require('./request');
var response = require('./response');

...

Application.prototype.handle = function(req, res) {

	Object.setPrototypeOf(req, request);
	Object.setPrototypeOf(res, response);


	...
};
```

这里将原有的res.send转移到了response.js文件中。

```javascript
res.send = function(body) {
	this.writeHead(200, {
		'Content-Type': 'text/plain'
	});
	this.end(body);
};
```

注意函数中不在是res.writeHead和res.end，而是this.writeHead和this.end。

在整个路由系统中，Router.stack每一项其实都是一个中间件，每个中间件都有可能用到req和res这两个对象，所以代码中修改nodejs原生提供的request和response对象的代码放到了Application.handle中，这样做并没有问题，但是有一种更好的方式，expross框架将这部分代码封装成了一个内部中间件。

为了确保框架中每个中间件接收这两个参数的正确性，需要将该内部中间放到Router.stack的首项。这里将原有Application的构造函数中的代码去掉，不再是直接创建Router()路由系统，而是用一种惰性加载的方式，动态创建。

去除原有Application构造函数的代码。

```javascript
function Application() {}
```

添加惰性初始化函数。

```javascript
Application.prototype.lazyrouter = function() {
	if(!this._router) {
		this._router = new Router();

		this._router.use(middleware.init());
	}
};
```

因为是惰性初始化，所以在使用`this._router`对象前，一定要先调用该函数动态创建`this._router`对象。类似如下代码：

```javascript
//获取router
this.lazyrouter();
router = this._router;
```

接下来创建一个叫middleware文件夹，专门放内部中间件的文件，再创建一个init.js文件，放置Application.handle中用来初始化res和req的代码。

```javascript
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
```

修改原有的Applicaton.handle函数。

```javascript
Application.prototype.handle = function(req, res) {

	...

	// 这里无需调用lazyrouter，因为listen前一定调用了.use或者.METHODS方法。
	// 如果二者都没有调用，没有必要创建路由系统。this._router为undefined。
	var router = this._router;
	if(router) {
		router.handle(req, res, done);
	} else {
		done();
	}
};
```

运行`node test/index.js`走起……

express框架中，request和response两个对象有很多非常好用的函数，不过大部分和框架结构无关，并且这些函数内部过于专研细节，对框架本身的理解没有多少帮助。不过接下来有一个方面需要仔细研究一下，那就是前后端参数的传递，express如何获取并分类这些参数的，这一点还是需要略微了解。

默认情况下，一共有三种参数获取方式。

+ req.query 代表查询字符串。
+ req.params 代表路径变量。
+ req.body 代表表单提交变量。

req.query 是最常用的方式，例如：

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

后台获取这些参数最简单的方式就是通过nodejs自带的querystring模块分析URL。express使用的是另一个npm包，[qs](https://github.com/ljharb/qs)。并且将其封装为另一个内部中间件，专门负责解析查询字符串，默认加载。

req.params 是另一种从URL获取参数的方式，例如：

```
//路由规则  /user/:name
// GET /user/tj
req.params.name
// => "tj"
```

这是一种express框架规定的参数获取方式，对于批量处理逻辑非常实用。在expross中并没有实现，因为路径匹配问题过于细节化，如果对此感兴趣可以研究研究[path-to-regexp](https://github.com/pillarjs/path-to-regexp)模块，express也是在其上的封装。

req.body 是获取表单数据的方式，但是默认情况下框架是不会去解析这种数据，直接使用只会返回undefined。如果想要支持需要添加其他中间件，例如 [body-parser](https://www.npmjs.org/package/body-parser) 或 [multer](https://www.npmjs.org/package/multer)。

本小节主要介绍了request和response两个对象，并且讲解了一下现有expross框架中获取参数的方式，整体上并没有太深入的仿制，主要是这方面内容涉及的细节过多，只可意会。研究了也就仅仅知道而已，并不能带来多少积累，除非重头再造一次轮子。

## 6. 第六次迭代

本小节是第六次迭代，主要的目的是介绍一下expresss是如何集成现有的渲染引擎的。与渲染引擎有关的事情涉及到下面几个方面：

+ 如何开发或绑定一个渲染引擎。
+ 如何注册一个渲染引擎。
+ 如何指定模板路径。
+ 如何渲染模板引擎。

express通过`app.engine(ext, callback)` 方法即可创建一个你自己的模板引擎。其中，`ext` 指的是文件扩展名、`callback` 是模板引擎的主函数，接受文件路径、参数对象和回调函数作为其参数。

```javascript
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

```javascript
//views, 放模板文件的目录
app.set('views', './views')
//view engine, 模板引擎
app.set('view engine', 'jade')
```

一旦 `view engine` 设置成功，就不需要显式指定引擎，或者在应用中加载模板引擎模块，Express 已经在内部加载。下面是如何渲染页面的方法：

```javascript
app.get('/', function (req, res) {
  res.render('index', { title: 'Hey', message: 'Hello there!'});
});
```

要想实现上述功能，首先在Application类中定义两个变量，一个存储app.set 和 app.get 这两个方法存储的值，另一个存储模板引擎中扩展名和渲染函数的对应关系。

```javascript
function Application() {
	this.settings = {};
	this.engines = {};
}
```

然后是实现app.set函数。

```javascript
Application.prototype.set = function(setting, val) {
  	if (arguments.length === 1) {
	  // app.get(setting)
	  return this.settings[setting];
	}
  
	this.settings[setting] = val;
	return this;
};
```

代码中不仅仅实现了设置，如何传入的参数只有一个等价于get函数。

接着实现app.get函数。因为现在已经有了一个app.get方法用来设置路由，所以需要在该方法上进行重载。

```javascript
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

最后实现app.engine进行扩展名和引擎函数的映射。

```javascript
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

扩展名当做key，统一添加“.”。

到此设置模板引擎相关信息的函数算是完成，接下来就是最重要的渲染引擎函数的实现。

```javascript
res.render = function(view, options, callback) {
  	var app = this.req.app;
	var done = callback;
	var opts = options || {};
	var self = this;

	//如果定义回调，则返回，否则渲染
	done = done || function(err, str) {
		if(err) {
			return req.next(err);
		}

		self.send(str);
	};

	//渲染
	app.render(view, opts, done);
};
```

渲染函数一共有三个参数，view表示模板的名称，options是模板渲染的变量，callback是渲染成功后的回调函数。

函数内部直接调用render函数进行渲染，渲染完成后调用done回调。

接下来创建一个view.js文件，主要功能是负责各种模板引擎和框架间的隔离，保持对内接口的统一性。

```javascript
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

View类内部定义了很多属性，主要包括引擎、根目录、扩展名、文件名等等，为了以后的渲染做准备。

```javascript
View.prototype.render = function render(options, callback) {
	this.engine(this.path, options, callback);
};
```

View的渲染函数内部就是调用一开始注册的引擎渲染函数。

了解了View的定义，接下来实现app.render模板渲染函数。

```javascript
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

*还有一些细节没有在教程中展示出来，可以参考github上传的案例代码。*

貌似一切搞定，修改测试用例，尝试一下。

```javascript
var fs = require('fs'); // 此模板引擎依赖 fs 模块
app.engine('ntl', function (filePath, options, callback) { // 定义模板引擎
  fs.readFile(filePath, function (err, content) {
    if (err) return callback(new Error(err));
    // 这是一个功能极其简单的模板引擎
    var rendered = content.toString().replace('#title#', '<title>'+ options.title +'</title>')
    .replace('#message#', '<h1>'+ options.message +'</h1>');
    return callback(null, rendered);
  });
});

app.set('views', './test/views'); // 指定视图所在的位置
app.set('view engine', 'ntl'); // 注册模板引擎


app.get('/', function(req, res, next) {
	res.render('index', { title: 'Hey', message: 'Hello there!'});
});
```

运行`node test/index.js`，查看效果。

上面的代码是自己注册的引擎，如果想要和现有的模板引擎结合还需要在回调函数中引用模板自身的渲染方法，当然为了方便，express框架内部提供了一个默认方法，如果模板引擎导出了该方法，则表示该模板引擎支持express框架，无需使用app.engine再次封装。

该方法声明如下：

```
 __express(filePath, options, callback)
```

可以参考ejs模板引擎的代码，看看它们是如何写的：

```
//该行代码在lib/ejs.js文件的355行左右
exports.__express = exports.renderFile;
```

express框架是如何实现这个默认加载的功能的呢？很简单，只需要在View的构造函数中加一个判断即可。

```javascript
if (!opts.engines[this.ext]) {
  // load engine
  var mod = this.ext.substr(1);
  opts.engines[this.ext] = require(mod).__express;
}
```

代码很简单，如果没有找到引擎对应的渲染函数，那就尝试加载__express函数。

## 后记

至此，算是结束本篇文章了。其实还有很多内容可以写，但是写的有些烦了，篇幅太长了，大概有一万三千多字，后面有点应付了事的感觉。

简单的说一下还有哪里没有介绍。

1. 关于Application。

如果稍微看过expross代码的人都会发现，Application并不是想我写的这样是一个类，而是一个中间件，一个对象，该对象使用了mixin方法的多继承手段，express.js文件中的createApplication函数算是整个框架的切入点。

2. 关于Router.handle。

这个函数可以说是整个express框架的核心，如果理解了该函数，整个框架基本上就掌握了。我在仿制的时候舍弃了很多细节，在这里个函数里面内部有两个个关键点没说。一、处理URL形式的参数，这里涉及对params参数的提取过程。其中有一个restore函数使用高阶函数的方法做了缓存，仔细体会很有意思。二、setImmediate异步返回，之所以要使用异步处理，是因为下面的代码需要运行，包括路径相关的参数，这些参数在下一个处理函数中可能会用到。

3. 关于其他函数。

太多函数了，不一一列举，前文已经提到，涉及的细节太多，正则表达式，http协议层，nodejs本身函数的使用，对于整个框架的理解帮助不大，全部舍弃。不过大多数函数都是自成体系，很好理解。