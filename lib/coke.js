#! /usr/bin/env node

var argv = require('minimist')(process.argv.slice(2));
var files = argv._;
var fs = require('fs');
var vm = require('vm');
var cokescript = require('../dist/cokescript');
var glob = require("glob");
var pattern = argv.g || argv.glob;

if(pattern) {
  var f = glob.sync(pattern);
  files = files.concat(f || []);
}

if(argv.help || files.length === 0) {
  console.log(["Usage of the coke command",
  "  coke <file name> <file name 2> ... ",
  "Options",
  "  -c or --commonjs  generate a commonJs module",
  "  -o or --output    write the output to a single file",
  "  -e or --execute   execute the generated javascript",
  "  -g or --glob      select all files matched by a glob expression",
  "  -w or --write     write each individual file to disk with a .js extension",
  ].join('\n'));
  return;
}

var out = [];
var filesSource = [];
var allKeys = [];

// generate code
for(var i=0; i<files.length; i++) {
  var content = fs.readFileSync(files[i]);
  var result = cokescript.generateModule(content);
  filesSource.push({
    code:result.code, 
    ns:result.ns,
    filename: files[i]
  });

  allKeys = allKeys.concat(Object.keys(result.ns).filter(function(it) {
    return allKeys.indexOf(it) === -1;
  }));
}

// write files
if(argv.w || argv.write) {
  for(var i=0; i<filesSource.length; i++) {
    var out = [];
    out.push(filesSource[i].code);
    if(argv.commonjs || argv.c) {
      out.push(cokescript.generateExports(filesSource[i].ns));
    }
    var filename = filesSource[i].filename + '.js';
    fs.writeFileSync(filename, out.join(""));
    console.log('File ' + filename + ' written on disk.');
  }
  return;
}

// execute
if(argv.e || argv.execute) {
  var source = generateAllSource();
  console.log(vm.runInThisContext(source));
  return;
}

function generateAllSource() {
  var out = [];
  for(var i=0; i<filesSource.length; i++) {
    out.push(filesSource[i].code);
  }
  if(argv.commonjs || argv.c) {
    out.push(cokescript.generateExports(allKeys));
  }
  return out.join("");
}

if(argv.o) {
  var filename = argv.o;
  fs.writeFileSync(filename, generateAllSource());
  console.log('File ' + filename + ' written on disk.');
} else {
  console.log(generateAllSource());
}