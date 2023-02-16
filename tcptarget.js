const Net = require('net');
const Url = require('url');
const EventEmitter = require('events');

// privateMethods
const _init = Symbol('init');

module.exports = class TcpTarget extends EventEmitter {

    constructor(options) {
        super();

        this.url = options.url;

        this.client = undefined;
        this.bytesCount = 0;
        this.lastBitrateTime = undefined;
        this.lastBitrateRequestBytesSent = 0;
    }

    start() {
        this[_init]();
    }

    send(data) {
        if (this.client && this.client.readyState == 'open') {
            this.client.write(data);
            this.bytesCount += data.length;
        }
    }

    close() {
        if (this.client) {
            this.client.destroy();
            this.client.unref()
        }
    }


    [_init]() {

        // console.log("Init tcp target ", this.url);
        const urlParsed = Url.parse(this.url);
        if (urlParsed.protocol != 'tcp:') {
            throw (new Error('Url must start with "tcp://"'));
        }

        this.client = new Net.Socket();
        this.client.connect(Number(urlParsed.port), urlParsed.hostname)
            .on('connect', () => {
                //console.log("Connected to ", this.url);
                this.emit('message', 'Connected to ' + this.url);
            })
            .on('end', () => {
                console.log('disconnected from server');
            })
            .on('error', e => {
                this.client.destroy();
                this.client.unref()
                const errorMessage = `${e.code}: ${e.message}, retrying...`;
                //console.log(errorMessage);
                this.emit('error', new Error(errorMessage));
                setTimeout(() => {
                    this[_init]();
                }, 2000);

            });
    }



    /**
     * Calculate average sent bitrate  
     */
    getAvgSentBitrate() {
        let ret = 0.0;
        const time = new Date();
        if (this.lastBitrateRequestTime) {
            const duration = time - this.lastBitrateRequestTime;
            ret = (this.bytesCount - this.lastBitrateRequestBytesCount) / 1024.0 / 128.0 / (duration / 1000.0);
            this.lastBitrateRequestBytesCount = this.bytesCount;
        }

        this.lastBitrateRequestTime = new Date();
        return ret;
    }

}
