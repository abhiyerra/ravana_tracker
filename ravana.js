// Requires node_redis
// npm install dht-bencode

var http = require('http');
var url = require('url');

var bencode = require('dht-bencode');
var redis = require("redis");
var redis_cli = redis.createClient();

function isAllowedPeer(ip) {
    var ret = true;

    var checkBlacklist = function(err, reply) {
        if(reply == 1) {
            console.log("Denied: " + ip);
            ret = false;
        }
    }

    // TODO: Yes this doesn't work yet!
    redis_cli.sismember("blacklist", ip, checkBlacklist);

    return ret;
}

function handleAnnounce(parsed_url, res) {

    try {
        // Get the info_hash or die trying.
        var info_hash = parsed_url.query.info_hash;
        console.log("info_hash " + info_hash);

        // This won't also work. Stupid scoping!
        redis_cli.smembers(info_hash, function(err, peers) {
            res.write(bencode.bencode(peers).toString());
            res.end("\n");
        });
    } catch(err) {
        // Probably no info_hash.
        console.log("Well fuck. No info_hash was not provided.");
    }
}


http.createServer(function (req, res) {
    console.log(req.url);

    res.writeHead(200, {'Content-Type': 'text/plain'});
    if(req.url.match('/announce.*') && isAllowedPeer(req.socket.remoteAddress)) {
        var parsed_url = url.parse(req['url'], true)
        handleAnnounce(parsed_url, res);
    }

}).listen(8124, "127.0.0.1");

console.log('ravana_tracker running on http://127.0.0.1:8124/');
