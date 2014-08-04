var request = require('request');
var im = require('imagemagick');
var sleep = require('sleep');
var fs = require('fs');

var config = JSON.parse(fs.readFileSync("config.json"));

function makeRequest(){
	request(config.poll_url + config.id, handleResponse);
}

function handleResponse(err, res, body){
	if(!err && res.statusCode === 200){
		try{
			var data = JSON.parse(body);
			for(var i = 0; i < data.length; i++)
				handleInput(data[i]);
		}catch(e){
			handleError(e, 200);
		}
	}else
		handleError(err, res.statusCode);
	makeRequest();
}

function handleError(err, status){
	console.log("ERROR", res.statusCode, err);
}

function handleInput(data){
	console.log("DATA", data);
	if(data.type){
		switch(data.type){
			case "action":
				doAction(data.path, data.p);
				break;
			case "capture":
				updateImage();
				break;
			default:
				console.log("Unknown type: " + data.type);
		}
	}
}

function doAction(path, p, callback){
	var url = config.camera_url + path + "?t=" + config.password;
	if(p && p.length)
		url += "&p=%" + p;
	request(url, function(err, res, body){
		if(callback)
			callback(!err);
		else if(err)
			console.log("Error sending command to GoPro:", path, p);
	});
}

function updateImage(){
	console.log("Taking picture...");
	doAction("SH", "01");
	sleep.sleep(1);
	doAction("SH", "00");

	console.log("Getting image list from camera...");
	request(config.dcim_url + "101GOPRO/", function(err, res, body){
		if(!err && res.statusCode === 200){
			var temp = body.split('.JPG</a>');
			if(temp.length > 1){
				var temp = temp[temp.length - 2].split('>');
				var latest = config.dcim_url + "101GOPRO/" + temp[temp.length - 1] + ".JPG";

				console.log("Downloading image from camera...");
				request(latest, function(err, res, body){
					if(!err && res.statusCode === 200){
						console.log("Resizing image...");
						im.resize({
							srcPath: "latest.jpg",
							dstPath: "latest.jpg",
							width: 1024,
							height: 768
						}, function(err){
							if(!err){
								console.log("Uploading image...");
								fs.createReadStream("latest.jpg").pipe(request.post(config.update_url, function(err, res, body){
									if(!err && res.statusCode === 200){
										console.log("Wiping memory...");
										doAction("DA", function(success){
											if(success)
												imageComplete();
											else
												imageComplete("Couldn't wipe SD card.");
										});
									}else
										imageComplete("Couldn't upload image to server.");
								}));
							}else
								imageComplete("Couldn't resize image.");
						});
					}else
						imageComplete("Couldn't download image from camera.");
				}).pipe(fs.createWriteStream("latest.jpg"));
			}else
				imageComplete("Couldn't find any images on the camera.");
		}else
			imageComplete("Couldn't load image list from camera.");
	});
}

function imageComplete(err){
	if(err)
		console.log(err);
	else
		console.log("Done!");
}

makeRequest();
