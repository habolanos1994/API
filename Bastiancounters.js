const Service = require('node-windows').Service

const svc = new Service({
    name: "Bastian counter server",
    description: "Bastian count for model and spur",
    script:  "C:\\inetpub\\wwwroot\\returns plc\\index3.js"
})

svc.on('install', function(){
    svc.start()
}).on('error', (err) => {
    console.error(err + year + "-" + month + "-" + date + " " + hours + ":" + minutes + ":" + seconds);
  });

svc.uninstall()