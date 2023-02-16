const signalhub = require('signalhub');
var SimplePeer = require('simple-peer');
var wrtc = require('wrtc');
const EventEmitter = require('events');

// privateMethods
const _init = Symbol('init');
const _createPeer = Symbol('createPeer');


function generator(length, chars) {
    var result = '';
    for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}


module.exports = class Peer extends EventEmitter {

    constructor(options) {
        super();

        this.signalURLs = (options.signalURL || 'https://signalhub.mafintosh.com').trim();
        this.connected = false;
        this.channel = (options.channel ?  options.channel.trim() : '');// + '-' + generator(24, '123456789ABCDEFGHJKLMNOPQRSTUVWXYZ');
        this.name = (options.name ?  options.name.trim() : '') + '-' + generator(10 + Math.floor(Math.random() * 10), '0123456789abcdefghijklmnopqrstuvwxyz');    
        this.hub = undefined;
        this.initiator = options.initiator != undefined ? options.initiator : true;

        this.bytesReceived = 0;
        this.lastBitrateReceivedRequestTime = undefined;
        this.lastBitrateReceivedRequestBytesReceived = 0;

        this[_init]();

        this.peer = undefined;    
    }

    create() {

        this[_createPeer]();
    }

    send(data) {
        this.peer.send(data);
    }


    [_init]() {

        console.log("Init peer-", this.channel);
        this.hub = signalhub(this.channel, this.signalURLs);

        this.hub.subscribe("info").on('data', message => {
            if (message.sender != this.name && !this.connected) {
                console.log("Received Peer info");
                console.log(message);
                if (message.initiator == this.initiator) {                
                    console.log("Peer has the same initiator type=", this.initiator);
                    console.log("Only one initiator allowed");
                }
            }
        });
    }



    [_createPeer]() {
        console.log("Create peer-", this.channel);
        var retryHandle = undefined;
        var peerName = undefined;
        var pinger = undefined;

        var subscription = this.hub.subscribe("*")
            .on('data', message => {
                if (this.peer && message.sender != this.name) {

                    console.log("WebRTC-", message.data.type);
                    if (message.data.type == 'offer' && retryHandle) {
                        // Received an offer, can't send offer again. 
                        clearInterval(retryHandle);
                        retryHandle = undefined;
                    }
                    try {
                        this.peer.signal(message.data);
                    }
                    catch (e) {
                        console.error("Unable to signal peer", e.reason);
                    }
                    if (peerName != undefined && peerName != message.sender) {
                        console.log("Received a message from", message.sender, "along with", peerName);
                        console.log("Are you sure that only 2 peers are on this channel?");
                    }
                    peerName = message.sender;
                }
            })

        pinger = setInterval(() => {
            this.hub.broadcast("info", { sender: this.name, initiator: this.initiator });
        }, 10000);

        this.peer = new SimplePeer({ initiator: this.initiator, wrtc: wrtc, trickle: false, objectMode: true, reconnectTimer: true });

        this.peer.on('signal', msg => {
            // when peer1 has signaling data, give it to peer2 somehow
            //var signal = Buffer(JSON.stringify(data)).toString('base64');    
            this.hub.broadcast("*", { sender: this.name, initiator: this.initiator, data: msg });

            if (this.initiator && !this.connected && retryHandle === undefined) {
                retryHandle = setInterval(() => {
                    console.log("Retry sending", msg.type, "on channel", this.channel);
                    this.hub.broadcast("*", { sender: this.name, initiator: this.initiator, data: msg });
                }, 10000);
            }
        })

        this.peer.on('connect', () => {
            // wait for 'connect' event before using the data channel
            console.log("Client connected with", peerName, "on channel", this.channel);
            this.connected = true;
            this.emit("connected", true);
            if (retryHandle) {
                clearInterval(retryHandle);
                retryHandle = undefined;
            }
            if (pinger) {
                clearInterval(pinger);
                pinger = undefined;
            }
            subscription.destroy();
            subscription = undefined;
        })

        this.peer.on('data', data => {
            // got a data channel message
            //debug('got a message of length '+ data.length+ 'from peer1: ' + peerName);       
            this.emit("data", data);
            this.bytesReceived += data.length;
        });

        var self = this;
        this.peer.on('close', () => {
            console.log("Peer ", peerName, " Disconnected");
            this.connected = false;
            console.log("Client disconnected from ", peerName, "on channel", this.channel);
            this.emit("connected", false);
            this.peer.destroy();
            this.peer = undefined;
            peerName = undefined;
            this[_createPeer]();
        })
    }


    /**
     * Calculate average received bitrate  
     */
    getAvgReceivedBitrate() {
        let ret = 0.0;
        const time = new Date();
        if (this.lastBitrateReceivedRequestTime) {
            const duration = time - this.lastBitrateReceivedRequestTime;
            ret = (this.bytesReceived - this.lastBitrateReceivedRequestBytesReceived) / 1024.0 / 128.0 / (duration / 1000.0);
            this.lastBitrateReceivedRequestBytesReceived = this.bytesReceived;
        }

        this.lastBitrateReceivedRequestTime = new Date();
        return ret;
    }
}


