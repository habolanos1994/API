const { ControllerManager, TagGroup, TagList } = require("st-ethernet-ip");
const mqtt = require("mqtt");
const pcname = require('os');
const encoder = new TextDecoder('utf-8')
const cm = new ControllerManager();
const schedule = require('node-schedule');
const rule = new schedule.RecurrenceRule();
rule.second = 1;
//const { writeTag } = require('./writetag')
//const { writeTagTotal } = require('./writeTagTotal')






const client = mqtt.connect("mqtt://pcv1engmqtt01", {
  clientId: (pcname.hostname() + 'V1.1'),
});

const cont32 = cm.addController("10.63.192.32", 0, 300, true, 1000, {})
const cont33 = cm.addController("10.63.192.33", 0, 300, true, 1000, {})
const cont35 = cm.addController("10.63.192.35", 0, 300, true, 1000, {})
const cont34 = cm.addController("10.63.192.34", 0, 300, true, 1000, {})




// all connection

//Connection Bastian 

cont32.on("Connected", () => {
  client.publish("returns/OnlinePLC/Bastian/Status", "Connected", {
    qos: 1,
  });
});

cont32.on("Error", (err) => {
  client.publish("returns/OnlinePLC/Bastian/Status", err.message, {
    qos: 1,
  });
});

//Connection AEC 1 

cont33.on("Connected", () => {
  client.publish("returns/OnlinePLC/AEC/ELP/Status", "Connected", {
    qos: 0,
  });
});

cont33.on("Error", (err) => {
  client.publish("returns/OnlinePLC/AEC/ELP/Status", err.message, {
    qos: 0,
  });
});

//Connection AEC 2


cont35.on("Connected", () => {
  client.publish("returns/OnlinePLC/AEC/SPA/Status", "Connected", {
    qos: 0,
  });
});

cont35.on("Error", (err) => {
  client.publish("returns/OnlinePLC/AEC/SPA/Status", err.message, {
    qos: 0,
  });
});

//Connection clarify
cont34.on("Connected", () => {
  client.publish("returns/OnlinePLC/Clarify/Status", "Connected", {
    qos: 0,
  });
});

cont34.on("Error", (err) => {
  client.publish("returns/OnlinePLC/Clarify/Status", err.message, {
    qos: 0,
  });
});

// tag read AEC 1
cont33.on("TagChanged", (tag, prevValue) => {
  if (tag.value)
    client.publish("returns/AEC/Status/" + tag.displayName.slice(0, 5), tag.displayName.slice(6), {
      qos: 1,
    });
});

// tag read AEC 2
cont35.on("TagChanged", (tag, prevValue) => {

  if (tag.value)
    client.publish("returns/AEC/Status/" + tag.displayName.slice(0, 5), tag.displayName.slice(6), {
      qos: 1,
    });
});

// tag read CLARIFY
cont34.on("TagChanged", (tag, prevValue) => {

  if (tag.displayName === "Serial")
    client.publish("returns/Bastian/scanner/Clarify/" + tag.displayName, JSON.stringify(tag._valueObj), {
      qos: 0,
    });
  //writeTagTotal(tag); 
  if (tag.value)
    client.publish("returns/Bastian/Clarify/" + tag.displayName, tag.displayName, {
      qos: 0,
    });
});

// tag read Bastian
//sorter record
cont32.on("TagChanged", (tag, prevValue) => {
  if (tag.displayName === "Sorter SN Scanner" || tag.displayName === "DivertConfirm" || tag.displayName === "DivertLine" || tag.displayName === "Sorter TrackID")
    client.publish("returns/Bastian/scanner/Sorter/" + tag.displayName, JSON.stringify(tag.value), {
      qos: 1,
    });

  //Pense que este era sick camaras pero no solo era la misma data que el tag de sorter sick 
  /**/
  if (tag.displayName === "sickheartbeat") {
    const arr = new Uint8Array(tag.value.Data.slice(7, 19))
    const srt = encoder.decode(arr)
    client.publish("returns/Bastian/scanner/Sorter/" + tag.displayName, JSON.stringify(srt), {
      qos: 1,
    });
  }
  /**/
  // marks status
  if (tag.displayName.includes('MARK'))
    client.publish("returns/Bastian/Marks/" + tag.displayName, JSON.stringify(tag.value), {
      qos: 1,
    });
  //status conveyor
  if (tag.displayName === "Running" || tag.displayName === "Faulted" || tag.displayName === "Stop" || tag.displayName === "EStop")
    client.publish("returns/OnlinePLC/Bastian/Status/" + tag.displayName, JSON.stringify(tag.value), {
      qos: 1,
    });
  // error tags
  if (tag.displayName === "AirPressure" || tag.displayName === "Comunication" || tag.displayName === "Jam" || tag.displayName === "Overload" || tag.displayName === "No Comm Clarify")
    client.publish("returns/OnlinePLC/Bastian/Status/ERROR", tag.displayName + JSON.stringify(tag.value), {
      qos: 1,
    });

  if (tag.displayName.includes('Spur'))
    client.publish("returns/Bastian/Spur/" + tag.displayName, JSON.stringify(tag.value), {
      qos: 1,
    });
  //sensors
  if (tag.value)
    client.publish("returns/Bastian/sensors", tag.displayName, {
      qos: 1,
    });

});


cont32.connect();

//marks status
cont32.addTag("MARK001.Out_Running", "MARK1");
cont32.addTag("MARK002.Out_Running", "MARK2");
cont32.addTag("MARK003.Out_Running", "MARK3");
cont32.addTag("MARK004.Out_Running", "MARK4");
cont32.addTag("MARK005.Out_Running", "MARK5");
cont32.addTag("MARK006.Out_Running", "MARK6");
cont32.addTag("MARK007.Out_Running", "MARK7");
cont32.addTag("MARK008.Out_Running", "MARK8");
cont32.addTag("MARK009.Out_Running", "MARK9");
cont32.addTag("MARK010.Out_Running", "MARK10");
cont32.addTag("MARK011.Out_Running", "MARK11");
cont32.addTag("MARK012.Out_Running", "MARK12");
//count sensors
cont32.addTag("MPA_RACK1:11:I.0", "Ramp Middle");
cont32.addTag("MPA_RACK1:10:I.1", "Rams Start");
cont32.addTag("MPA_RACK1:11:I.3", "Ramp Top");
cont32.addTag("MPA_RACK1:11:I.4", "IHS");
//conveyour status
cont32.addTag("MPA_RACK1:11:I.5", "Sorter");
cont32.addTag("System1.Inp_SystemEStop", "EStop");
cont32.addTag("System1.Out_SystemRun", "Running");
cont32.addTag("System1.Inp_CBFault", "Faulted");
cont32.addTag("System1.Inp_SystemStop", "Stop");
cont32.addTag("System1.Inp_AirPressure", "AirPressure");
cont32.addTag("MPA_RACK1:17:O.3", "Overload");
cont32.addTag("System1.Inp_CommunicationFault", "Comunication");
cont32.addTag("MPA.Inp_BlueLight", "Jam");
cont32.addTag("System1.Inp_AORFault", "No Comm Clarify");
//serial number data
cont32.addTag("WebAPI_DivertConfirm_strCode", "DivertConfirm");
cont32.addTag("WebAPI_DivertConfirm_strLane", "DivertLine");
cont32.addTag("WebAPI_DivertConfirm_strTrackId", "Sorter TrackID");
cont32.addTag("WebAPI_DivertConfimData_strBarcode", "Sorter SN Scanner");
cont32.addTag("Scanner1:I", "sickheartbeat");
cont32.addTag("ClarifyHeartBeat", "ClarifyHeartBeat");
//spours

cont32.addTag("MARK016.IB_PartialFullPE", "Spur_1");
cont32.addTag("MARK020.IB_PartialFullPE", "Spur_2");
cont32.addTag("MARK024.IB_PartialFullPE", "Spur_3");
cont32.addTag("MARK028.IB_PartialFullPE", "Spur_4");
cont32.addTag("MARK032.IB_PartialFullPE", "Spur_5");
cont32.addTag("MARK014.IB_PartialFullPE", "Spur_6");
cont32.addTag("MARK018.IB_PartialFullPE", "Spur_7");
cont32.addTag("MARK022.IB_PartialFullPE", "Spur_8");
cont32.addTag("MARK026.IB_PartialFullPE", "Spur_9");
cont32.addTag("MARK030.IB_PartialFullPE", "Spur_10");


cont32.addTag("Lane_W_FullTime[1,1]", "SpurT_1");
cont32.addTag("Lane_W_FullTime[1,2]", "SpurT_2");
cont32.addTag("Lane_W_FullTime[1,3]", "SpurT_3");
cont32.addTag("Lane_W_FullTime[1,5]", "SpurT_4");
cont32.addTag("Lane_W_FullTime[1,6]", "SpurT_5");
cont32.addTag("Lane_W_FullTime[1,7]", "SpurT_6");
cont32.addTag("Lane_W_FullTime[1,8]", "SpurT_7");
cont32.addTag("Lane_W_FullTime[1,9]", "SpurT_8");
cont32.addTag("Lane_W_FullTime[1,10]", "SpurT_9");
cont32.addTag("Lane_W_FullTime[1,11]", "SpurT_10");



cont35.connect();

cont35.addTag("AEC_BO3_GL", "BOX 3 Running");
cont35.addTag("AEC_BO3_RL", "BOX 3 Stop");


cont33.connect();

cont33.addTag("AEC_BO1_GL_ON", "BOX 1 Running");
cont33.addTag("AEC_BO1_RL_ON", "BOX 1 Stop");

cont33.addTag("AEC_BO2_GL_ON", "BOX 2 Running");
cont33.addTag("AEC_BO2_RL_ON", "BOX 2 Stop");


cont34.connect()


cont34.addTag("INTERNAL_ProcSerialsQ", "Serial");
cont34.addTag("Local:1:I.Data.0", "Reset Button");

//heartbit all system

const job = schedule.scheduleJob('*/8 * * * * *', function () {

  //writeTag();
  client.publish("returns/online/" + pcname.hostname(), "Bastian mqtt-ok", {
    qos: 0,
  });
  if (cont32.connected === true)
    client.publish("returns/OnlinePLC/Bastian/Status", "Connected", {
      qos: 0,
    });
  if (cont33.connected === true)
    client.publish("returns/OnlinePLC/AEC/ELP/Status", "Connected", {
      qos: 0,
    });
  if (cont34.connected === true)
    client.publish("returns/OnlinePLC/Clarify/Status", "Connected", {
      qos: 0,
    });
  if (cont35.connected === true)
    client.publish("returns/OnlinePLC/AEC/SPA/Status", "Connected", {
      qos: 0,
    });

});
