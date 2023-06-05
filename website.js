const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');

const os = require('os');

const hostname = os.hostname();

const app = express();
const port = 3000;

// Middleware to parse the request body
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Endpoint to get the current tagConfigs data
app.get('/tagConfigs', (req, res) => {
  fs.readFile('tagConfigs.json', 'utf8', (err, data) => {
    if (err) throw err;
    res.send(data);
  });
});

// Endpoint to remove a tag
app.delete('/tagConfigs/:alias', (req, res) => {
  const { alias } = req.params;
  fs.readFile('tagConfigs.json', 'utf8', (err, data) => {
    if (err) throw err;
    const tagConfigs = JSON.parse(data);
    const index = tagConfigs.findIndex((tag) => tag.alias === alias);
    if (index === -1) {
      res.status(404).send({ error: 'Tag not found' });
      return;
    }
    tagConfigs.splice(index, 1);
    fs.writeFile('tagConfigs.json', JSON.stringify(tagConfigs), (err) => {
      if (err) throw err;
      res.send({ message: 'Tag removed successfully' });
    });
  });
});

// Endpoint to add a tag
app.post('/tagConfigs', (req, res) => {
  const { name, alias } = req.body;
  fs.readFile('tagConfigs.json', 'utf8', (err, data) => {
    if (err) throw err;
    const tagConfigs = JSON.parse(data);
    const index = tagConfigs.findIndex((tag) => tag.alias === alias);
    if (index !== -1) {
      res.status(400).send({ error: 'Alias already exists' });
      return;
    }
    tagConfigs.push({ name, alias });
    fs.writeFile('tagConfigs.json', JSON.stringify(tagConfigs), (err) => {
      if (err) throw err;
      res.send({ message: 'Tag added successfully' });
    });
  });
});

// Endpoint to render the HTML page for adding and removing tags
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Endpoint to handle form submission for adding tags
app.post('/addTag', (req, res) => {
  const { name, alias } = req.body;
  fs.readFile('tagConfigs.json', 'utf8', (err, data) => {
    if (err) throw err;
    const tagConfigs = JSON.parse(data);
    const index = tagConfigs.findIndex((tag) => tag.alias === alias);
    if (index !== -1) {
      res.send(`<p>${alias} already exists with value ${tagConfigs[index].name}</p>`);
      return;
    }
    tagConfigs.push({ name, alias });
    fs.writeFile('tagConfigs.json', JSON.stringify(tagConfigs), (err) => {
      if (err) throw err;
      res.send(`<p>Tag ${name} (${alias}) added successfully</p>`);
    });
  });
});

app.post('/removeTag', (req, res) => {
    const { alias } = req.body;
    fs.readFile('tagConfigs.json', 'utf8', (err, data) => {
      if (err) throw err;
      const tagConfigs = JSON.parse(data);
      const index = tagConfigs.findIndex((tag) => tag.alias === alias);
      if (index === -1) {
        res.send(`<p>${alias} not found</p>`);
        return;
      }
      tagConfigs.splice(index, 1);
      fs.writeFile('tagConfigs.json', JSON.stringify(tagConfigs), (err) => {
        if (err) throw err;
        res.send(`<p>Tag ${alias} removed successfully</p>`);
      });
    });
  });

app.listen(port, () => {
  console.log(`${hostname}:${port}`);
});