const Service = require('node-windows').Service

const svc = new Service({
    name: "Bastian Receivers Count server",
    description: "Bastian total count of clarify transaction for receivers",
    script:  "C:\\inetpub\\wwwroot\\returns plc\\index4.js"
})

svc.on('install', function(){
    svc.start()
}).on('error', (err) => {
    console.error(err + year + "-" + month + "-" + date + " " + hours + ":" + minutes + ":" + seconds);
  });

svc.install()
