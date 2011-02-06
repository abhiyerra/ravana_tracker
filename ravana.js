var http = require('http');
var url = require('url');
var redis = require("redis");

var redis_cli = redis.createClient();

function handleAnnounce(parsed_url, res) {
    try {
        var info_hash = parsed_url.query.info_hash
        console.log("info_hash " + info_hash);

        // This won't also work. Stupid scoping!
        redis_cli.smembers(info_hash, function(err, replies) {
            replies.forEach(function (reply, i) {
                console.log("    " + i + ": " + reply + " " + res);
                res.write(reply);
            });
        });
    } catch(err) {
        // Probably no info_hash.
        console.log("Well fuck.");
    }
}

function isAllowedPeer(ip) {
    // TODO: Yes this doesn't work yet!
    redis_cli.sismember("blacklist", ip, function(err, reply) {
        if(reply == 1) {
            console.log("Fuck this guy: " + ip);
            return false;
        }
    });

    return true;
}

http.createServer(function (req, res) {
    console.log(req.url);

    res.writeHead(200, {'Content-Type': 'text/plain'});
    if(req.url.match('/announce.*') && isAllowedPeer(req.socket.remoteAddress)) {
        var parsed_url = url.parse(req['url'], true)
        handleAnnounce(parsed_url, res);
    }
    res.end("\n");
}).listen(8124, "127.0.0.1");

console.log('Server running at http://127.0.0.1:8124/');
