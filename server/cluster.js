var sticky = require('sticky-listen'),
    recluster = require("recluster"),
    path = require("path"),
    os = require("os");

var cluster = recluster(path.join(__dirname, 'index.js'), {
    readyWhen: 'ready'
});

cluster.run();

process.on('SIGUSR2', function () {
    console.log('Got SIGUSR2, reloading cluster...');
    cluster.reload();
});

console.log("spawned cluster, kill -s SIGUSR2", process.pid, "to reload");

// Added for the sticky listener: 

var balancer = sticky.createBalancer({
    behindProxy: false,
    activeWorkers: cluster.activeWorkers,
    maxRetries: 5,
    retryDelay: 100
});

function getIP() {
    var interfaces = os.networkInterfaces();
    var addresses = [];
    for (var k in interfaces) {
        for (var k2 in interfaces[k]) {
            var address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }
    ip = addresses[0]
    return addresses[0];
}

balancer.listen(9000, "localhost", function () {
    console.log("Sticky balancer listening on port", 9000);
});