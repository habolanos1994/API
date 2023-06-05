const Service = require('node-windows').Service

const svc = new Service({
    name: "Bastian Mqtt server",
    description: "PLC READ AND POST VALUE for OEE",
    script:  "C:\\inetpub\\wwwroot\\returns plc\\index.js"
})

svc.on('install', function(){
    svc.start()
}).on('error', (err) => {
    console.error(err + year + "-" + month + "-" + date + " " + hours + ":" + minutes + ":" + seconds);
  });

svc.install()