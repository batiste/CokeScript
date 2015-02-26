#! /usr/bin/env node

var argv = require('minimist')(process.argv.slice(2));
var files = argv._;
var fs = require('fs');
var vm = require('vm');
var cokescript = require('../dist/cokescript');
var glob = require("glob");
var pattern = argv.g || argv.glob;
var colors = require("colors");

if(pattern) {
  var f = glob.sync(pattern);
  files = files.concat(f || []);
}

if(argv.help || files.length === 0) {
  console.log(["Usage of the coke command",
  "",
  "  coke <filename> <filename N> <options>",
  "",
  "Options",
  "  -m or --commonjs  generate a commonJs module",
  "  -o or --output    write the output to a single file",
  "  -e or --execute   execute the generated javascript",
  "  -g or --glob      select all files matched by a glob expression",
  "  -c or --convert   convert each input file to JavaScript",
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
    filename: files[i],
    percent: result.code.length / content.length 
  });

  allKeys = allKeys.concat(Object.keys(result.ns).filter(function(it) {
    return allKeys.indexOf(it) === -1;
  }));
}

function fileWrittenLog(filename, percent) {
  var str = '[' + 'coke'.green + "] File '" + filename.cyan + "' written on disk.";
  if(percent) {
    str += " " + (String(Math.round(percent * 100)) + '% of original').grey;
  }
  console.log(str);
}

// write files
if(argv.c || argv.convert) {
  for(var i=0; i<filesSource.length; i++) {
    var out = [];
    out.push(filesSource[i].code);
    if(argv.commonjs || argv.m) {
      out.push(cokescript.generateExports(filesSource[i].ns));
    }
    var filename = filesSource[i].filename + '.js';
    fs.writeFileSync(filename, out.join(""));
    fileWrittenLog(filename, filesSource[i].percent);
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
  fileWrittenLog(filename);
} else {
  console.log(generateAllSource());
}