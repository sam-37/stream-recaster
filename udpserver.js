'use strict'

const dgram = require('dgram');
const EventEmitter = require('events');
const checkIp = require('check-ip');
const Url = require('url');

// privateMethods
const _init = Symbol('init');


module.exports = class UdpServer extends EventEmitter {

    constructor(options) {
        super();

        this.url = options && options.url || '0.0.0.0';
        if (!options.url)
            throw new Error('Input url not present');

        const urlParsed = Url.parse(this.url);
        this.name = options ? options.name : undefined;
        this.mode = options ? options.mode : 'RX';
        this.timeout = options.timeout;
        
        let nic;
        if(!options.nic && urlParsed.path){
            const parseReg = /((\/nic=)(?<NIC>\d+.\d+.\d+.\d+))?/g;
            const match = parseReg.exec(urlParsed.path);
            nic = match[3];
        }
            

        this.nic = options && options.nic || nic || '0.0.0.0';
        this.reuseAddr = (options && options.reuseAddr === false) ? false : true;
        this.udpServer = dgram.createSocket({ type: 'udp4', reuseAddr: this.reuseAddr });
        this.address = urlParsed.hostname || 'localhost';
        this.port = urlParsed.port ? Number(urlParsed.port) : 30120;
        this.exclusive = options && options.exclusive || false;
        this.ttl = options && options.ttl || 128;
        this.multicastLoopback = options && options.multicastLoopback || true;

        const chIp = checkIp(this.address);
        if (!chIp.isValid) {
            this.emit("error", new Error('Address not valid'));
        }

        this.isMulticast = chIp.isMulticast;

        this.lastReceivedTime = 0;
        this.timoutReported = false;

        this.bytesReceived = 0;
        this.lastBitrateReceivedRequestTime = undefined;
        this.lastBitrateReceivedRequestBytesReceived = 0;

        this.bytesSent = 0;
        this.lastBitrateSentRequestTime = undefined;
        this.lastBitrateSentRequestBytesSent = 0;
    }

    start() {
        this[_init]();

        if(this.timeout && this.timeout > 0) {
            this.timeoutTimer = setInterval(()=>{
                if(Date.now() - this.lastReceivedTime > this.timeout) {
                    if(!this.timoutReported) {
                        this.emit("timeout", 'on');
                        this.timoutReported = true;
                    }
                }
                else{
                    if(this.timoutReported) {
                        this.emit("timeout", 'off');
                        this.timoutReported = false;
                    }
                }
            }, this.timeout)
        }
    }

    stop() {
        if(this.timeoutTimer)
            clearInterval(this.timeoutTimer);
    }

    /**
     * Initialize and start receiving data   
     */
    [_init]() {

        this.udpServer.on('error', (err) => {
            console.log(`server error:\n${err.stack}`);
            this.udpServer.close();
            this.emit("error", err);
        });

        this.udpServer.on('listening', () => {
            this.emit("started", this.udpServer.address());
        });

        if (this.mode == 'RX') {
            if (this.isMulticast) {
                this.udpServer.bind({
                    port: this.port,
                    exclusive: this.exclusive
                }, () => {
                    this.udpServer.addMembership(this.address, this.nic);
                    this.udpServer.setMulticastTTL(this.ttl);
                    this.udpServer.setMulticastLoopback(this.multicastLoopback);
                });
            }
            else {

                this.udpServer.bind({
                    address: this.address,
                    port: this.port,
                    exclusive: this.exclusive
                }, () => {
                    this.udpServer.setTTL(this.ttl);
                });

            }
        }
        else 
         if (this.isMulticast) {
            this.udpServer.bind({
                port: this.port,
                exclusive: this.exclusive
            }, () => {
                this.udpServer.setMulticastInterface(this.nic);
                this.udpServer.setMulticastTTL(this.ttl);
                this.udpServer.setMulticastLoopback(this.multicastLoopback);
            });
        }
         

        this.udpServer.on('message', (msg, rinfo) => {
            this.lastReceivedTime = Date.now();
            this.bytesReceived += msg.length;
            this.emit("data", msg);
        });
    }

    /**
     * Send data
     */
    send(data) {
        this.udpServer.send(data, this.port, this.address);
        this.bytesSent += data.length;
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

    /**
     * Calculate average sent bitrate  
     */
    getAvgSentBitrate() {
        let ret = 0.0;
        const time = new Date();
        if (this.lastBitrateSentRequestTime) {
            const duration = time - this.lastBitrateSentRequestTime;
            ret = (this.bytesSent - this.lastBitrateSentRequestBytesSent) / 1024.0 / 128.0 / (duration / 1000.0);
            this.lastBitrateSentRequestBytesSent = this.bytesSent;
        }

        this.lastBitrateSentRequestTime = new Date();
        return ret;
    }


}

