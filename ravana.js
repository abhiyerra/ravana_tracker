// Requires node_redis
// npm install dht-bencode

// http://wiki.theory.org/BitTorrentSpecification#Tracker_HTTP.2FHTTPS_Protocol

var http = require('http');
var url = require('url');
var fs  = require('fs');

var bencode = require('dht-bencode');
var redis = require("redis"),
    redis_cli = redis.createClient();

var config = JSON.parse(fs.readFileSync("config.json"));

function isAllowedPeer(peer_key) {
    // TODO: Yes this doesn't work yet!
    return redis_cli.sismember("blacklist", ip, function(err, reply) {
        if(reply == 1) {
            console.log("Denied: " + ip);

            return false;
        }
    });
}

// Do we allow this client to connect.
function allowedTorrentClient(peer_id) {
    if(config.allowed_peers.length == 0)
        return true;

    return false;
}

function updateDb(info_hash, peer_key, field, value) {
    var hash_key = info_hash + ":" + peer_key;
    redis_cli.hset(hash_key, field, value, redis.print);
}

function handleAnnounce(req, res) {
    //trackPeer(req);

    console.log(req);

    var parsed_url = url.parse(req['url'], true);

    try {
        // We want a key so we can keep track of the peer on our
        // server.
        var peer_key = parsed_url.query.key;
        if(!peer_key || !isAllowedPeer(key))
            throw "Need peer key or the peer isn't allowed.";

        // We need this so we can give the user the peers that contain
        // it.
        var info_hash = parsed_url.query.info_hash;
        if(!info_hash)
            throw "Need info_hash";

        // The client the the peer is using. We want to track this so
        // we can prevent gaming.
        var peer_id = parsed_url.query.peer_id;
        if(!allowedTorrentClient(peer_id))
            throw "peer_id bad.";
        updateDb(info_hash, key, "peer_id", peer_id);

        // The number of peers to send. The default should be 30.
        var numwant = config.numwant;
        if(parsed_url.query.numwant) {
            numwant = parsed_url.query.numwant;
        }

        // What is the state of the peer.
        var event;
        if(parsed_url.query.event) {
            // event: started, stopped, completed
            event = parsed_url.query.event;
        }
        updateDb(info_hash, key, "event", event);

        // We want to get the peer's ip from the request. Otherwise
        // get it from the params.
        var ip = req.GET_THE_IP;
        if(parsed_url.query.ip) {
            ip = parsed_url.query.ip;
        }
        updateDb(info_hash, key, "ip", ip);

        var port;
        if(parsed_url.query.port) {
            port = parsed_url.query.port;
        }
        updateDb(info_hash, key, "port", port);

        var uploaded;
        if(parsed_url.query.uploaded) {

            uploaded = parsed_url.query.uploaded;
        }
        updateDb(info_hash, key, "uploaded", uploaded);

        var downloaded;
        if(parsed_url.query.downloaded) {
            downloaded = parsed_url.query.downloaded;
        }
        updateDb(info_hash, key, "downloaded", downloaded);

        var left;
        if(parsed_url.query.left) {
            left = parsed_url.query.left;
        }
        updateDb(info_hash, key, "left", left);

        var trackerid;
        if(parsed_url.query.trackerid) {
            trackerid = parsed_url.query.trackerid;
        }

        console.log("info_hash " + info_hash);

        var response_dict = {
            'interval': 30,
            'tracker id': trackerid,
        };

        // TODO: This won't also work. Stupid scoping!
        redis_cli.keys(key, function(err, keys) {
            response_dict.complete = 0;
            response_dict.incomplete = 0;
            response_dict.peers = [];

            /*
              Shit to send:

              failure reason (if defined only send this.)

              or

              interval
              tracker id
              complete
              incomplete
              peers: (dict)
              peer id (peer_id)
              ip
              port
            */
            keys.forEach(function(key) {
                redis_cli.hmget(key, "left", "ip", "port", function(left, ip, port) {
                    if(left == 0) {
                        response_dict.complete += 1;
                    } else {
                        response_dict.incomplete += 1;
                    }

                    response_dict.peers.push({
                        'peer id': 'NE',
                        'ip': ip,
                        'port': port
                    });
                });

                res.write(bencode.bencode(response_dict).toString());
                res.end("\n");
            });
        });



    } catch(err) {
        console.log("Shit hit the fan.");

        res.write(bencode.bencode({
            'failure reason': 'Shit hit the fan.'
        }).toString());
        res.end("\n");
    }
}


http.createServer(function (req, res) {
    console.log(req.url);

    res.writeHead(200, {'Content-Type': 'text/plain'});

    if(req.url.match('/announce.*')) {
        handleAnnounce(req, res);
    } else {
        res.end();
    }
}).listen(8124, "127.0.0.1");

console.log('ravana_tracker running on http://127.0.0.1:8124/');
