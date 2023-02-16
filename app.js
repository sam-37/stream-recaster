// To package as .exe, run pkg app.js --output streamRecaster.exe
// To build a docker image run "docker build -t streamrecaster ."
// To run a container run "docker run --network="host" streamrecaster -it -i udp://227.1.1.1:30120 -o udp://227.1.1.2:30122 --printUsage false"

const colors = require('colors/safe');
const UdpServer = require('./udpserver');
//const Peer = require('./peer');
const checkIp = require('check-ip');
const Url = require('url');
const log = require('single-line-log').stdout;
const TcpTarget = require('./tcptarget');

let peer;
let udpsource;
let timeoutState = false;
const targets = [];

const ArgumentParser = require('argparse').ArgumentParser;
const parser = new ArgumentParser({ addHelp: true, description: 'Stream recaster', epilog: 'Start recasting...' });
parser.addArgument(['-i', '--input'], { metavar: '', help: 'Input url' });
parser.addArgument(['-o', '--output'], { metavar: '', defaultValue: '', help: 'List of output urls' });
parser.addArgument(['-m', '--mode'], { metavar: '', choices: ['recaster', 'server', 'client'], defaultValue: 'recaster', help: 'Mode: recaster/server/client. Default recaster' });
parser.addArgument(['-t', '--timeout'], { metavar: '', defaultValue: 2000, help: 'Stream timeout detection in ms' });
parser.addArgument('--printUsage', { metavar: '', defaultValue: 'true', help: 'Print args description (true/false)' });
parser.addArgument(['-v', '--version'], {  metavar: '', help: 'Version' });

//parser.addArgument(['-n', '--name'], { help: 'Peer name' });
//parser.addArgument(['-c', '--channel'], { help: 'Channel name' });
//parser.addArgument(['-s', '--signal'], { help: 'comma separated private signaling Url list' });
//parser.addArgument(['-p', '--protocol'], { defaultValue: 'webrtc', help: 'peer protocol' });


const argv = parser.parseArgs();
if(JSON.parse(argv.printUsage.trim()))
    parser.printHelp();

if (argv.help || process.argv.length < 3) {
    parser.printHelp();
    process.exit(0);
}

if (argv.version) {
    console.log(require('./package.json').version)
    process.exit(0);
}

argv.mode = argv.mode.trim();

if(argv.name)
    console.log(' Name: ' + colors.yellow(argv.name.trim()));
if(argv.input)
    console.log(` Stream source:  ${ colors.yellow(argv.input.trim())}`);
console.log(` Mode: ${colors.yellow(argv.mode)}`);

const verifyUrls = () => {
    if (!argv.input.trim()) {
        console.log(colors.red('No input url found'));
        parser.printHelp();
        process.exit(0);
    }

    if (!validateUrl(argv.input)) {
        parser.printHelp();
        process.exit(0);
    }
}

const configurePeer = () => {

    // Temprarely cloesd.
    // peer = new Peer({
    //     name: argv.name,
    //     channel: argv.channel,
    //     signalURLs: argv.signal,
    //     initiator: argv.mode.trim() == 'client'
    // })
    //     .on('connected', state => {

    //     })
    //     .on('data', data => {

    //         targets.forEach(target => {
    //             target.send(data);
    //         });
    //     });
}


const confugureUdpReceiver = () => {
  
    // Create source stream receiver
    udpsource = new UdpServer({ name: 'Input', url: argv.input.trim(), mode: 'RX', timeout: argv.timeout });

    udpsource
        .on('data', data => {

            targets.forEach(target => {
                target.send(data);
            });

            if (peer && peer.connected)
                peer.send(data);
        })
        .on('started', addr => {
            console.log(colors.green('Recaster listening on ' + addr.address.toString() + ':' + addr.port.toString()));
            if(peer)
                peer.create();
        })
        .on('timeout', state => {
            timeoutState = state === 'on';
            console.log(colors.red(`${timeoutState ? '\n':''}Stream timeout "${state}" (at ${new Date().toLocaleString()})`));          
        })
        .on('error', err => {

        });

}

const configureConsolePrintout = () => {
    switch (argv.mode.trim()) {
        case 'recaster':
            setInterval(() => {
                if (!timeoutState) {
                    let logItems = [];
                    logItems.push('Received: ' + colors.yellow((udpsource.bytesReceived / 1024.0 / 1024.0).toFixed(2)) + colors.gray(' MB'));
                    logItems.push(' Bitrate: ' + colors.yellow(udpsource.getAvgReceivedBitrate().toFixed(2)) + colors.gray(' Mb/s'));

                    for (let i = 0; i < targets.length; i++) {
                        logItems.push(` Target (${i}) ${colors.yellow(targets[i].getAvgSentBitrate().toFixed(2))} Mb/s`);
                    }

                    log(logItems);
                }
            }, 250);
            break;

        case 'client':

            break;
        case 'server':

            break;
    }
}

const configureRtcServer = () => {
  // Temprarely cloesd.
    // peer.create();
    // setInterval(() => {
    //     log('Received: ', colors.yellow((peer.bytesReceived / 1024.0 / 1024.0).toFixed(2)), colors.gray('MB'), 'Avg bitrate (Peer): ', colors.yellow(peer.getAvgReceivedBitrate().toFixed(2)), colors.gray('Mb/s '));
    // }, 250);
}


const validateUrl = url => {
    const urlParsed = Url.parse(url);
    if (urlParsed.protocol != 'udp:' && urlParsed.protocol != 'tcp:') {
        console.log(colors.red('Must start with "udp://" - ' + url));
        return false;
    }

    if (!checkIp(urlParsed.hostname).isValid) {
        console.log(colors.red('Hostname not valid " - ' + urlParsed.hostname));
        return false;
    }

    return true;
}


const startProcessing = () => {

    switch (argv.mode.trim()) {
        case 'recaster':
            verifyUrls();
            confugureUdpReceiver();
            break;

        case 'client':
            verifyUrls();
            configurePeer();
            confugureUdpReceiver();
            break;

        case 'server':
            configurePeer();
            break;

        default:
            console.log(colors.red('Unknown operation mode'));
            parser.printHelp();
            process.exit(0);
            break;
    }

    if (udpsource)
        udpsource.start();
}



const createTargets = () => {

    const targetUrls = argv.output.trim();

    // Add targets
    if (targetUrls) {
        console.log(` Targets:`);
        let logItems = [];
        const targetUrlArray = targetUrls.split(/\s+/);
        targetUrlArray.forEach(url => {
           
            let target;
            const urlParsed = Url.parse(url);
            switch (urlParsed.protocol) {
                case 'udp:':
                    target = new UdpServer({ name: 'Output', url: url, mode: 'TX' });
                    break;

                case 'tcp:':
                    target = new TcpTarget({ url: url });                  
                    break;
            }
            
            if(target) {
                target.on('message', message => {
                    console.log('   ' + colors.cyan(message));
                })
                .on('error', err => {
                    console.log('   ' + colors.red(err.message));
                })
            }
         
            targets.push(target);
            logItems.push(` ${ colors.cyan(url)}`);          
        });

        log(logItems);
        targets.map(t=>{
            t.start();
        })
        console.log('\n');
    }
}


createTargets();
startProcessing();
configureConsolePrintout();
 

// Return those to package json to build with webrtc
/*
 "signalhub": "^4.9.0",
 "simple-peer": "^9.2.1",
 "single-line-log": "^1.1.2",
 "wrtc": "^0.3.5"
*/

