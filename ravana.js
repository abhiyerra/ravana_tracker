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

// Do we allow this client to connect.
function allowedTorrentClient(peer_id) {
    if(config.allowed_peers.length == 0)
        return true;

    return false;
}

/*
 * Save the peer request to the database.
 */
function updatePeer(peer) {
    var data = peer['info_hash'] + ':' + peer['peer_key'];

    for(var key in peer) {
        console.log(key);
    }

    // var hash_key = info_hash + ":" + peer_key;
    // console.log(hash_key);

    // redis_cli.hset(hash_key, field, value, redis.print);
}

/*
 * Parse the params sent to look for the appropriate key/value
 * pairs.
 */
function getPeerInfo(req) {
    var parsed_url = url.parse(req['url'], true);

    console.log(parsed_url);

    var peer = {}

    peer['peer_key'] = parsed_url.query.key;
    if(!peer['peer_key'])
        throw "Need peer key or the peer isn't allowed.";

    peer['info_hash'] = parsed_url.query.info_hash;
    if(!peer['info_hash'])
        throw "Need info_hash";

    peer['peer_id'] = parsed_url.query.peer_id;
    if(!allowedTorrentClient(peer['peer_id']))
        throw "peer_id bad.";

    peer['numwant'] = config.numwant;
    if(parsed_url.query.numwant)
        peer['numwant'] = parsed_url.query.numwant;

    if(parsed_url.query.event) // event: started, stopped, completed
        peer['event'] = parsed_url.query.event;

    peer['ip'] = req.socket.remoteAddress;
    if(parsed_url.query.ip)
        peer['ip'] = parsed_url.query.ip;

    if(parsed_url.query.port)
        peer['port'] = parsed_url.query.port;

    if(parsed_url.query.uploaded)
        peer['uploaded'] = parsed_url.query.uploaded;

    if(parsed_url.query.downloaded)
        peer['downloaded'] = parsed_url.query.downloaded;

    if(parsed_url.query.left)
        peer['left'] = parsed_url.query.left;

    if(parsed_url.query.trackerid)
        peer['trackerid'] = parsed_url.query.trackerid;

    peer['no_peer_id'] = !!parsed_url.query.no_peer_id;

    console.log(peer);

    return peer;
}

function handleAnnounce(req, res) {
    try {
        var peer = getPeerInfo(req);

        updatePeer(peer);

        var response_dict = {
            'interval': 10,
            'complete': 0,
            'incomplete': 0,
            'peers': [],
//          'tracker id': peer['trackerid'] || '',
        };

        find_keys = peer['info_hash'] + ":*";

        console.log("S" + find_keys);

        // Find all the peers that have the same info_hash and send it to the user.
        redis_cli.keys(find_keys, function(err, keys) {
            // For each of the peers to the response_dict.
            keys.forEach(function(key) {
                redis_cli.hmget(key, "left", "ip", "port", function(left, _ip, port) {
                    if(left == 0)
                        response_dict.complete += 1;
                    else
                        response_dict.incomplete += 1;

                    response_dict.peers.push({
                        'peer id': 'NE',
                        'ip': _ip,
                        'port': port
                    });

                    console.log(response_dict);
                });
            });

            console.log(response_dict);

            response = bencode.bencode(response_dict).toString()
            console.log(response);
            res.write(response);
        });
    } catch(err) {
        console.log("Shit hit the fan. " + err);

        res.write(bencode.bencode({
            'failure reason': 'Shit hit the fan.'
        }).toString());
    } finally {
        res.end();
    }
}


http.createServer(function (req, res) {
    console.log(req.url);

    res.writeHead(200, {'Content-Type': 'text/plain'});

    if(req.url.match('/announce.*')) {
        handleAnnounce(req, res);
    } else if(req.url.match('/scrape.*')) {
        res.write("test");
        res.end();
    } else {
        res.end();
    }
}).listen(8124, "127.0.0.1");

console.log('ravana_tracker running on http://127.0.0.1:8124/');
