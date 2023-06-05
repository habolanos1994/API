const mqtt = require("mqtt");
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const schedule = require('node-schedule');
const path = require("path");
const { findmodel } = require("./model");
const { sendsmtp } = require("./smtp")

const os = require('os');
const hostname = os.hostname();

let uniqueSerials = new Set();
let KeyenceSerialsSet = new Set();
let SorterSerialsSet= new Set();
let QRASerialsSet= new Set();
let SickSerialsSet= new Set();
let NoRaSet= new Set();

let messageQueue = [];

let connectionAttempts = 0;
const maxAttempts = 10;


// At the end of the day clear all the data
let rule = new schedule.RecurrenceRule();
rule.dayOfWeek = [0, new schedule.Range(1, 6)];
rule.hour = 23;
rule.minute = 59;
rule.tz = 'America/Denver';

const countersFile = path.join(__dirname, "TotalUnits.json");

const csvFileDir = path.join(__dirname, 'csvFiles');
if (!fs.existsSync(csvFileDir)){
    fs.mkdirSync(csvFileDir, { recursive: true });
}

const AllSerials = path.join(csvFileDir, 'serials.csv');

const SickSerials = path.join(csvFileDir, 'SickSerials.csv');
const KeyenceSerials = path.join(csvFileDir, 'KeyenceSerials.csv');
const SorterSerials = path.join(csvFileDir, 'SorterSerials.csv');
const QRASerials = path.join(csvFileDir, 'QRASerials.csv');
const NoRA = path.join(csvFileDir, 'NoRa.csv');
const undefined = path.join(csvFileDir, 'undefined.csv');

let counters = {
  Models: {}
};


fs.writeFileSync(countersFile, JSON.stringify(counters, null, 2));



const options = {
  host: "10.123.84.36",
  port: 1883,
  protocol: "mqtt",
  rejectUnauthorized: false,
  clientId: `client${hostname}PLC${uuidv4()}`,
};

let client = mqtt.connect(options);
let isConnected = false;
let connectionInterval;

// Function to subscribe to topics
function subscribeToTopics() {
  client.subscribe('ELP/Returns/PROXY/SickClarify/DDATA', { qos: 2 });
  client.subscribe('ELP/Returns/PROXY/Keyence/DDATA', { qos: 2 });
  client.subscribe('ELP/Returns/PROXY/Receiver_Sorter/DDATA', { qos: 2 });
  client.subscribe('ELP/QRA/+/DDATA', { qos: 2 });
}

// Handle 'connect' event
client.on('connect', () => {
  isConnected = true;
  if (connectionInterval) {
    clearInterval(connectionInterval);
    connectionInterval = null;
  }
  subscribeToTopics();
});

// Handle 'error' event
client.on('error', (err) => {
  console.error('MQTT Error:', err);
  if (isConnected) {
    isConnected = false;
  }
  if (!connectionInterval) {
    connectionInterval = setInterval(() => {
      if (!isConnected) {
        sendsmtp(`Error mqtt conection ${options} Counter PLC service`)
        console.log('Attempting to reconnect...');
        client.end();
        client = mqtt.connect(options);
        connectionAttempts++;
        if (connectionAttempts > maxAttempts) {
          console.error(`Could not connect after ${maxAttempts} attempts, exiting.`);
          process.exit(1);
        }
      }
    }, 30 * 1000); // try to reconnect every 30 seconds
  }
});

// Function to load serials from file
function loadSerialsFromFile(filePath, set) {
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const serials = data.split('\n').filter(serial => serial.trim() !== '');
      for (const serial of serials) {
        set.add(serial);
      }
      console.log(`Loaded ${set.size} unique serial numbers from file ${filePath}.`);
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
    }
  }
}

function loadModelsFromFile(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const serials = data.split('\n').filter(serial => serial.trim() !== '');
      for (const serial of serials) {
        let model = findmodel(serial);
        counters.Models[model] = (counters.Models[model] || 0) + 1;
        getallcount()
      }
      console.log(`Loaded ${Object.keys(counters.Models).length} models from file ${filePath}.`);
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
    }
  }
}

function getallcount(){
  const data = {
    Cameras: {
      TotalReceiversScan: uniqueSerials.size,
      TotalSickClarify: SickSerialsSet.size,
      TotalKeyenceClarify: KeyenceSerialsSet.size,
      TotalQRA: QRASerialsSet.size,
      TotalSorter: SorterSerialsSet.size,
      TotalNoRAReceivers: NoRaSet.size  // change NoRA to NoRaSet
    },
    Models: counters.Models
  }
  fs.writeFileSync(countersFile, JSON.stringify(data, null, 2));
}



loadModelsFromFile(AllSerials)
loadSerialsFromFile(AllSerials, uniqueSerials);
loadSerialsFromFile(SickSerials, SickSerialsSet);
loadSerialsFromFile(KeyenceSerials, KeyenceSerialsSet);
loadSerialsFromFile(SorterSerials, SorterSerialsSet);
loadSerialsFromFile(QRASerials, QRASerialsSet);
loadSerialsFromFile(NoRA, NoRaSet);
getallcount()

if (fs.existsSync(countersFile)) {
  try {
    const data = fs.readFileSync(countersFile, 'utf-8');
    counters = JSON.parse(data);
  } catch (error) {
    console.error('Error reading counters file:', error);
  }
}

processMessageQueue();

// Function to handle messages
client.on('message', (topic, message) => {
  messageQueue.push({ topic, message });
});




let clearDataJob = schedule.scheduleJob(rule, function(){
  try {
    uniqueSerials.clear();
    SickSerialsSet.clear();
    KeyenceSerialsSet.clear();
    SorterSerialsSet.clear();
    QRASerialsSet.clear();
    NoRaSet.clear();
    counters = {};
    counters.Models = {};

    fs.writeFileSync(AllSerials, '');
    fs.writeFileSync(SickSerials, '');
    fs.writeFileSync(KeyenceSerials, '');
    fs.writeFileSync(SorterSerials, '');
    fs.writeFileSync(QRASerials, '');
    fs.writeFileSync(NoRA, '');
    fs.writeFileSync(undefined, '');
    fs.writeFileSync(countersFile, JSON.stringify(counters, null, 2));
    console.log('Data has been cleared.');
  } catch (error) {
    console.error('Error clearing data:', error);
  }
});


async function processMessageQueue() {
  if (messageQueue.length > 0) {
    const { topic, message } = messageQueue.shift();
    // Process the message here
    try {
      const msg = JSON.parse(message.toString());

      let serial;
      if ('ReceiverData' in msg && 'Serial Number' in msg.ReceiverData) {
        serial = msg.ReceiverData['Serial Number'];
      } else if ('data' in msg && 'serial' in msg.data) {
        serial = msg.data.serial;
      } else if ('serial' in msg) {
        serial = msg.serial;
      }
      let model = findmodel(serial);
  
  
      if(!uniqueSerials.has(serial)) {
        if (model != 'undefined') {
           uniqueSerials.add(serial);
           fs.appendFileSync(AllSerials, serial + '\n');
        }
      }
  
  
      if (model) {
        counters.Models[model] = (counters.Models[model] || 0) + 1;
        //fs.writeFileSync(countersFile, JSON.stringify(counters, null, 2));
      }
      
      if (model != 'undefined') {
      if (topic.includes("SickClarify")) {
        SickSerialsSet.add(serial);
        fs.appendFileSync(SickSerials, serial + '\n');
      } else if (topic.includes("Keyence")) {
        KeyenceSerialsSet.add(serial);
        fs.appendFileSync(KeyenceSerials, serial + '\n');
      } else if (topic.includes("Receiver_Sorter")) {
        SorterSerialsSet.add(serial);
        fs.appendFileSync(SorterSerials, serial + '\n');
      } else if (topic.includes("QRA")) {
        QRASerialsSet.add(serial);
        fs.appendFileSync(QRASerials, serial + '\n');
  
        if (msg.ReceiverResultData['TestResult'] != 'QRA|WHS') {
          NoRaSet.add(serial);
          fs.appendFileSync(NoRA, serial + '\n');
        }
      } 
    
  
  
      
      
    } else {
      fs.appendFileSync(undefined, `${serial}\n`);
    }
  
    getallcount()
      // Rest of your message processing code...
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }
  // Wait for some time before processing the next message
  setTimeout(processMessageQueue, 100);  // Adjust the delay as needed
}

sendsmtp(`counter service Returns Start, Display name: Bastian Receivers Count server`)