# CokeScript

CokeScript is a whitespace sensitive language inspired by Python and Ruby that compile to JavaScript. This project is still at it's infancy and no significant program has been written with it.

How does it compare against CoffeScript:

  - Scoping is not broken (https://donatstudios.com/CoffeeScript-Madness)
  - Multiline string don't necessitate backslashes
  - Virtual Dom support within the language
  - The source code of the language is way shorter

![Style matters](https://raw.githubusercontent.com/batiste/CokeScript/master/css/eg-coke.png)

Demo http://batiste.info/CokeScript

CokeScript use EPEG.js https://github.com/batiste/EPEG.js/

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
