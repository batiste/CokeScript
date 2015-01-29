#! /usr/bin/env node

var argv = require('minimist')(process.argv.slice(2));
var files = argv._;
var fs = require('fs');
var vm = require('vm');
var cokescript = require('../dist/cokescript');

if(argv.help || files.length == 0) {
  console.log(["Usage of the coke command",
  "  coke <file name> <file name 2> ... ",
  "Options",
  "  -c or --commonjs  generate a commonJs module",
  "  -o or --output    write the output to a file",
  "  -e or --execute   execute the generated javascript"
  ].join('\n'));
  return;
}

var out = [];
var nsKey = [];

for(var i=0; i<files.length; i++) {
  var content = fs.readFileSync(files[i]);
  var result = cokescript.generateModule(content);
  nsKey = nsKey.concat(Object.keys(result.ns).filter(function(it){
    return nsKey.indexOf(it) === -1;
  }));
  out.push(result.code);
}

if(argv.commonjs || argv.c) {
  out.push(cokescript.generateExports(nsKey));
}

var source = out.join('');

if(argv.e || argv.execute) {
  console.log(vm.runInThisContext(source));
  return;
}

if(argv.o) {
  var filename = argv.o;
  if(filename === true) {
    filename = files[0] + '.js';
  }
  fs.writeFileSync(filename, source);
  console.log('File '+filename+' written on disk.');
} else {
  console.log(source);
}