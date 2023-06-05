const Service = require('node-windows').Service

const svc = new Service({
    name: "Bastian MongoDB server",
    description: "PLC READ AND POST VALUE for OEE in a non sql database",
    script:  "C:\\inetpub\\wwwroot\\returns plc\\index2.js"
})

svc.on('install', function(){
    svc.start()
}).on('error', (err) => {
    console.error(err + year + "-" + month + "-" + date + " " + hours + ":" + minutes + ":" + seconds);
  });

svc.install()