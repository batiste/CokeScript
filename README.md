# CokeScript

CokeScript is a whitespace sensitive language inspired by Python and Ruby that compile to JavaScript. This project is still at an early stage. The CokeScript compiler is written in CokeScript. 

How does it compare against CoffeeScript:

  - Scoping is not broken (https://donatstudios.com/CoffeeScript-Madness)
  - Multiline string don't necessitate backslashes
  - Virtual Dom support within the language
  - The source code of the language is rather simple and short
  - [Language specification](/doc/spec.md)
  - [Interactive demo](http://batiste.info/CokeScript)

![Style matters](https://raw.githubusercontent.com/batiste/CokeScript/master/css/eg-coke.png)

## Atom support

 - Syntax highlighting for Atom https://atom.io/packages/language-cokescript 
 - A linter for Atom https://atom.io/packages/linter-cokescript

## API

### Import CokeScript

    <script src='dist/cokescript.js'></script>

or

    var cokescript = require('cokescript');

## Usage

### cokescript.generateModule(input)

Return object of form

    {
      ast:  Abstract syntax trees,
      code: JavaScript code,
      ns:   Namespace of the module
    }

### cokescript.generateExports(keys)

Return a commonJs module export statement with the keys provided. If none are provided
the module level keys of the last compiled module will be used.

## Command line tool

    $ lib/coke.js
    Usage of the coke command
    
      coke <filename> <filename N> <options>
    
    Options
      -m or --commonjs  generate a commonJs module
      -o or --output    write the output to a single file
      -e or --execute   execute the generated javascript
      -g or --glob      select all files matched by a glob expression
      -c or --convert   convert each input file to JavaScript
      
### Grammar parser

CokeScript use EPEG.js https://github.com/batiste/EPEG.js/
