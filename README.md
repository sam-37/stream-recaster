# Stream Recaster

**Stream Recaster** is an application that provides recasting and stream tunneling services. 
You can recast udp unicast / multicast streams to multiple udp (unicast / multicast ) or tcp targets.

![StreamRecaster](./images/streamRecaster.png)

## Usage

```
streamRecaster -i udp://127.0.0.1:30120 -o udp://227.1.1.1:30122
```

### Options

| Flag     |      Name     | Description |
|----------|:-------------:|:--------------------------------------------|
| -i       |  --input      | Input url |
| -o       |  --output     | List of output urls (should be passed as a string, for example -o 'udp://227.1.1.1:30122 tcp://127.0.0.1:1234') |
| -m       | --mode        | Operational mode: recaster/server/client. Default recaster' |
| -t       | --timeout     | Stream timeout detection in ms |
|          | --printUsage  | Print args description (true/false) |
| -v       | --version     | Version |


Additional flags for web RTC version
| Flag     |      Name     | Description |
|----------|:-------------:|:-------------------------------------------|
| -n       | --name        | Peer name |
| -c       | --channel     | Channel name |
| -s       | --signal      | Comma separated private signaling Url list |
| -p       | --protocol    | peer protocol (defaultValue: 'webrtc') |

### Usage

> Note. For compiled version, use **streamRecaster.exe** instead of  **node app.js**


#### UDP / TCP recasting

1. Recasting UDP unicast to multicast or vice versa:

```
node app.js -i udp://127.0.0.1:30120 -o udp://227.1.1.1:30122'
``` 
> Note, if you need to select specific network interface, add  **/nic=X.X.X.X** (for example **/nic=192.168.99.1**) to the **url**

2. Recasting UDP unicast/multicast to tcp:

```
node app.js -i udp://127.0.0.1:30120 -o tcp://127.0.0.1:1234
```

3. Recasting to multiple targets:
It is possilbe to combine different output stream protocols. For example, as shown below, you can simultaneousy recast to **udp** and **tcp** targets.
```
node app.js -i udp://127.0.0.1:30120 -o 'udp://227.1.1.1:30122 tcp://127.0.0.1:1234'
```

#### WebRTC tunneling 

1. On the remote (server) machine run the Recaster, specifying the peer and and channel names and providing the input / output urls. For example:
```
node app.js -i udp://127.0.0.1:30120 -o udp://227.1.1.1:30120 -m server -n peer1 -c channel1
``` 

2. On the local (client) machine run the Recaster with corresponding arguments. For example:
```
node app.js -i udp://227.1.1.1:30120 -o udp://127.0.0.1:30120  -m client -n peer1 -c channel1
```

Now, the client should connect to the server, establishing a session.
```
Name: peer1
Mode: client
Adding recast target: udp://127.0.0.1:30120
Init peer- channel1
Recaster listening on 0.0.0.0:30120
Create peer- channel1
Received:  0.00 MB Avg bitrate (Local):  0.00 Mb/s  Avg bitrate (Peer):  0.00 Mb/s WebRTC- answer
Received:  0.00 MB Avg bitrate (Local):  0.00 Mb/s  Avg bitrate (Peer):  0.00 Mb/s Client connected with peer1-lo4bmt8ieugzpy on channel channel1
Received:  0.00 MB Avg bitrate (Local):  0.00 Mb/s  Avg bitrate (Peer):  0.00 Mb/s
```

When streaming is started, the information on the sent / received data will be shown at both server and client