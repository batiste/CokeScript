#! /usr/bin/env node

var argv = require('minimist')(process.argv.slice(2));
var files = argv._;
var fs = require('fs');
var cokescript = require('../dist/cokescript');

var out = [];

for(var i=0; i<files.length; i++) {
  var content = fs.readFileSync(files[0]);
  var result = cokescript.generateModule(content);
  out.push(result.code);
}

if(argv.o) {
  fs.writeFileSync(argv.o, out.join(''));
  console.log('File written at ' + argv.o);
} else {
  console.log(out.join(''));
}