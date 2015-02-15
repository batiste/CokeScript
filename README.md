# CokeScript

CokeScript is a whitespace sensitive language that compile to JavaScript. This project is still at toy language because it lack support for many important features like regular expression.

How does it compare against CoffeScript:

  - Scoping is not broken (https://donatstudios.com/CoffeeScript-Madness)
  - Multiline string don't necessitate backslashes
  - Virtual Dom support within the language
  - The source code is simpler and shorter
  - The language is simpler

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
      coke <file name> <file name 2> ...
    Options
      -c or --commonjs  generate a commonJs module
      -o or --output    write the output to a file
      -e or --execute   execute the generated javascript
