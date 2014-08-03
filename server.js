var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);
var fs = require('fs');

app.use(express.static('static'));
server.listen(8080);

io.enable('browser client minification');
io.enable('browser client etag');
io.enable('browser client gzip');
io.set('log level', 1);
io.set('transports', ['websocket', 'htmlfile', 'xhr-polling', 'jsonp-polling']);

var reqs = {};
var queue = {};

function sendRes(id, data){
	if(queue[id]){
		if(data)
			queue[id].push(data);
	}else if(data !== undefined)
		queue[id] = [data];
	else
		queue[id] = [];

	if(reqs[id]){
		reqs[id].res.send(queue[id]);
		console.log("Sent " + queue[id].length + " message(s) to " + id);
		delete reqs[id];
		delete queue[id];
	}
}

function checkReqs(){
	for(var id in reqs){
		if(+new Date - reqs[id].time > 30000){
			sendRes(id);
		}
	}
}

app.get('/poll/:id', function(req, res){
	reqs[req.params.id] = {
		req: req,
		res: res,
		time: +new Date
	};

	if(queue[req.params.id])
		sendRes(req.params.id);
});

app.post('/upload', function(req, res){
	var upload = fs.createWriteStream("latest.jpg");
	req.setEncoding('utf8');
	req.on('data', function(chunk){
		upload.write(chunk);
	});
	req.on('end', function(){
		upload.end();
		res.send("Got it!");
	});
});

io.sockets.on('connection', function(socket){
	socket.on('send', function(id, data){
		if(data.substr(0, 1) === "{" || data.substr(0, 1) === "["){
			try{
				var parsedData = JSON.parse(data);
				sendRes(id, parsedData);
			}catch(e){
				sendRes(id, data);
			}
		}else
			sendRes(id, data);
	});
});

setInterval(checkReqs, 5000);
console.log("Started.");
