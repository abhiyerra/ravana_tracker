// Requires node_redis
// npm install dht-bencode

// http://wiki.theory.org/BitTorrentSpecification#Tracker_HTTP.2FHTTPS_Protocol

var http = require('http');
var url = require('url');

var bencode = require('dht-bencode');
var redis = require("redis");
var redis_cli = redis.createClient();



function isAllowedPeer(ip) {
    // TODO: Yes this doesn't work yet!
    return redis_cli.sismember("blacklist", ip, function(err, reply) {
        if(reply == 1) {
            console.log("Denied: " + ip);

            return false;
        }
    });
}

function trackPeer(req) {

}

function allowedTorrentClient(peer_id) {
    // Do we allow this client to connect.

    return true;
}

function handleAnnounce(req, res) {
    trackPeer(req);

    var parsed_url = url.parse(req['url'], true);

    try {
        var key = parsed_url.query.key;
        if(!key) {
            throw "Need key."
        }

        // Get the info_hash or die trying.
        var info_hash = parsed_url.query.info_hash;

        var peer_id = parsed_url.query.peer_id
        if(!allowedTorrentClient(peer_id)) {
            throw "peer_id bad."
        }

        var numwant = 30;
        if(parsed_url.query.numwant) {
            numwant = parsed_url.query.numwant;
        }

        var event;
        if(parsed_url.query.event) {
            // event: started, stopped, completed
            event = parsed_url.query.event;

            // TODO: Update our server with the event.
        }

        var ip;
        if(parsed_url.query.ip) {
            // ip: started, stopped, completed
            ip = parsed_url.query.ip;
        } else {
            // TODO: Get the client ip.
            ip = req.GET_THE_IP;
        }


        var port;
        if(parsed_url.query.port) {
            // port: started, stopped, completed
            port = parsed_url.query.port;
        }

        var uploaded;
        if(parsed_url.query.uploaded) {

            uploaded = parsed_url.query.uploaded;
        }

        var downloaded;
        if(parsed_url.query.downloaded) {
            downloaded = parsed_url.query.downloaded;
        }

        var left;
        if(parsed_url.query.left) {
            left = parsed_url.query.left;
        }

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
        if(isAllowedPeer(req.socket.remoteAddress)) {
            console.log("here");
            handleAnnounce(req, res);
        } else {
            res.end();
        }
    } else {
        res.end();
    }

}).listen(8124, "127.0.0.1");

console.log('ravana_tracker running on http://127.0.0.1:8124/');
