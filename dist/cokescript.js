!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.cokescript=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
  CokeScript language by Batiste Bieler 2015
  Implemented using EPEG.JS
*/
"use strict";

var epegjs = require("epegjs");

var depth = 0;
var forLoopCount = 1;
var namespaces = [{}];
var levelStack = [0];

function currentNs() {
  return namespaces[namespaces.length -1];
}

function newNs() {
  namespaces.push({});
  return namespaces[namespaces.length -1];
}

function resetGlobal() {
  namespaces = [{}];
  forLoopCount = 1;
  levelStack = [0];
  depth = 0;
}

// token are matched in order of declaration
// TODO: add functions
var tokenDef = [
  {key:"string", func:stringDef},
  {key:"comment", func:commentDef},
  {key:"function_def", func: defDef, verbose:"function definition"},
  {key:"class", reg:/^class /},
  {key:"ret", reg:/^return/, verbose:"return"},
  {key:"if", reg:/^if /},
  {key:"try", reg:/^try/},
  {key:"catch", reg:/^catch/},
  {key:"throw", reg:/^throw /},
  {key:"tag", reg:/^<[a-zA-Z_$][0-9a-zA-Z_]{0,29}/},
  {key:">", reg:/^>/},
  {key:"elseif", reg:/^elseif /},
  {key:"else", reg:/^else/},
  {key:"for_loop", reg:/^for /, verbose:"for loop"},
  {key:"in", reg:/^in /},
  {key:"name", reg:/^[a-zA-Z_$][0-9a-zA-Z_]{0,29}/}, // 30 chars max
  {key:"regexp", func:regExpDef, verbose:"regular epression"},
  {key:"math_operators", reg:/^(\+\+|\-\-)/, verbose:"math operator"},
  {key:"binary_operators", reg:/^(\&\&|\|\||\&|\||<<|\>\>)/, verbose:"binary operator"},
  {key:"comparison", reg:/^(<=|>=|<|>|!=|==)/},
  {key:"assign", reg:/^(\+=|-=|=|:=)/},
  {key:"number", reg:/^[0-9]+\.?[0-9]*/}, // only positive for now
  {key:"comma", reg:/^\,/},
  {key:"dot", reg:/^\./},
  {key:"colon", reg:/^\:/, verbose:":"},
  {key:"open_par", reg:/^\(/, verbose:"("},
  {key:"close_par", reg:/^\)/, verbose:")"},
  {key:"open_bra", reg:/^\[/, verbose:"["},
  {key:"close_bra", reg:/^\]/, verbose:"]"},
  {key:"open_curly", reg:/^\{/, verbose:"{"},
  {key:"close_curly", reg:/^\}/, verbose:"}"},
  {key:"math", reg:/^[-|\+|\*|/|%]/},
  {key:"samedent", func:dent('samedent'), verbose:"same indentation"},
  {key:"dedent", func:dent('dedent')},
  {key:"indent", func:dent('indent')},
  //newline: /^(\r?\n|$)/,
  {key:"W", reg:/^[ ]/, verbose:"single whitespace"},
];

function startStr(input, stream) {
  var last = stream[stream.length-1];
  if(last && last.value === '\\') {
    return;
  }
  if(input.match(/^#{/)) {
    return '#{';
  }
}

var strInterpolationTokenDef = [
  {key:"start", func:startStr},
  {key:"end", reg:/^}/},
  {key:"name", reg:/^[a-zA-Z_$][0-9a-zA-Z_]{0,29}/},
  {key:"dot", reg:/^\./},
  {key:"char", reg:/^./},
];

var strInterpolationGrammarDef = {
  "START": {rules:["EL* EOF"]},
  "EL": {rules:["VAR", "char", "name", "start", "end", "dot"]},
  "VAR": {rules:["start NAME end"]},
  "NAME": {rules:["name dot NAME", "name"]},
};

var strGram = epegjs.compileGrammar(strInterpolationGrammarDef, strInterpolationTokenDef);

function generateStringCode(node) {
  if(node.type === 'VAR') {
    return '" + ' + generateStringCode(node.children[1]) + ' + "';
  }
  if(node.value !== undefined) {
    return node.value;
  }
  var str = "", i;
  if(!node.children) {
    return '';
  }
  for(i=0;i<node.children.length; i++) {
    str += generateStringCode(node.children[i]);
  }
  return str;
}

function currentLevel() {
  return levelStack[levelStack.length - 1];
}

function indentType(l) {
  if(l > currentLevel()) {
    return 'indent';
  }
  if(l < currentLevel()) {
    return 'dedent';
  }
  if(l === currentLevel()) {
    return 'samedent';
  }
}

function dent(dentType) {
  return function _dent(input) {
    // empty line is a samedent
    var m = input.match(/^\n[\s]*/);
    if(m) {
      var lines = m[0].split("\n");
      var indent = lines[lines.length - 1].length;
      if(indentType(indent) === dentType) {
        if(dentType == 'dedent') {
          levelStack.pop();
          return '';
        }
        if(dentType == 'indent') {
          levelStack.push(indent);
        }
        return m[0];
      }
    }
  };
}

function stringDef(input) {
  if(input.charAt(0) === '"') {
    var i = 1;
    while(input.charAt(i)) {
      var ch = input.charAt(i);
      if(ch === '\\') {
        i++;
      } else if(ch === '"') {
        return input.slice(0, i+1);
      }
      i++;
    }
  }
}

function regExpDef(input) {
  if(input.charAt(0) === '/') {
    var i = 1;
    while(input.charAt(i)) {
      var ch = input.charAt(i);
      if(ch === '\\') {
        i++;
      } else if(ch === '/') {
        return input.slice(0, i+1);
      }
      i++;
    }
  }
}

function defDef(input) {
  if(input.indexOf("def(") === 0) {
    return "def";
  }
  if(input.indexOf("def ") === 0) {
    return "def";
  }
  if(input.indexOf("def\n") === 0) {
    return "def";
  }
  if(input.indexOf("dom ") === 0) {
    return "dom";
  }
}

function commentDef(input) {
  var m = input.match(/^#/);
  if(m) {
    var i = m[0].length;
    while(input.charAt(i)) {
      var ch = input.charAt(i);
      if(ch === '\n') {
        return input.slice(0, i);
      }
      i++;
    }
  }
}

function f_def(params) {
  return {def:params.fd, fn:params.fn, params:params.p, block:params.b};
}

function lambda_def(params) {
  return {fn:params.fn, params:params.p, block:params.b};
}

function else_def(params) {
  return [params.b];
}

function else_if_def(params) {
  return [params.e, params.b];
}

function if_def(params) {
  return [params.e, params.b, params.elif, params.el];
}

function forLoop(params) {
  return [params.k, params.v, params.a, params.b];
}

var grammarDef = {
  "START": {rules:["LINE* EOF"]},
  "ELC": {rules:["W* comment"], verbose:"comment"},
  "LINE": {rules:["STATEMENT ELC? samedent+", "STATEMENT ELC? !dedent", "ELC? samedent", "ELC !dedent"], verbose:"new line"},
  "BLOCK": {rules: ["indent LINE+ dedent"]},
  "STATEMENT": {rules:["ASSIGN", "IF", "FOR", "EXPR", "RETURN", "CLASS", "TAG", "DOM_ASSIGN", "TRY_CATCH", "THROW"]},
  "CLASS_METHODS": {
      rules: ["samedent* f:FUNC_DEF samedent*"],
      hooks: [ function(p){ return p.f; }]
  },
  "CLASS": {
    rules: [
      "class n:name open_par p:name close_par indent m:CLASS_METHODS+ dedent",
      "class n:name indent m:CLASS_METHODS+ dedent"
    ],
    hooks: [
      function(p){ return {name:p.n, methods:p.m, parent:p.p}; },
      function(p){ return {name:p.n, methods:p.m}; }
    ]
  },
  "FUNC_DEF_PARAMS": {rules:[
      "p1:FUNC_DEF_PARAMS comma W p2:FUNC_DEF_PARAMS",
      "p1:name assign e:EXPR",
      "p1:name",
    ],
    verbose:"function parameters"
  },
  "LAMBDA": {rules:[
      "function_def open_par p:FUNC_DEF_PARAMS? close_par W b:EXPR",
      "function_def W fn:name open_par p:FUNC_DEF_PARAMS? close_par W b:EXPR",
      "function_def W b:EXPR",
    ],
    hooks: [lambda_def, lambda_def, lambda_def]
  },
  "FUNC_DEF": {rules:[
      "fd:function_def open_par p:FUNC_DEF_PARAMS? close_par b:BLOCK",
      "fd:function_def W fn:name open_par p:FUNC_DEF_PARAMS? close_par b:BLOCK",
      "fd:function_def W fn:name b:BLOCK",
      "fd:function_def b:BLOCK",
    ],
    hooks: [f_def, f_def, f_def, f_def],
    verbose:"function definition"
  },
  "ELSE_IF": {rules:["samedent elseif e:EXPR b:BLOCK"], hooks:[else_if_def]},
  "ELSE": {rules:["samedent else b:BLOCK"], hooks:[else_def]},
  "IF": {rules:["if e:EXPR b:BLOCK elif:ELSE_IF* el:ELSE?"], hooks:[if_def]},
  "MATH": {rules:["e1:EXPR W op:math W e2:EXPR"]},
  "PATH": {rules:["PATH dot name", "PATH open_bra number close_bra", "name"]},
  "ASSIGN": {rules:["left:EXPR W op:assign W right:EXPR"], hooks:[
    function(p){
      return {left:p.left, op:p.op, right:p.right};
    }]
  },
  "W_OR_SAMEDENT": {rules:["W", "samedent"], verbose: "samedent or whitespace"},
  "W_SAMEDENT_INDENT": {rules:["W", "samedent", "indent"], verbose: "indent or samedent or whitespace"},
  "ANY_SPACE": {rules:["W", "samedent", "indent", "dedent"], verbose: "any space"},
  "FUNC_CALL_PARAMS": {rules:["FUNC_CALL_PARAMS comma ANY_SPACE+ EXPR ANY_SPACE*", "EXPR"]},
  "FUNC_CALL": {rules:[
    "open_par FUNC_CALL_PARAMS? close_par",
    "open_par indent FUNC_CALL_PARAMS? dedent samedent close_par",
    "open_par indent FUNC_CALL_PARAMS? close_par dedent"
  ]},

  "FOR": {rules:[
    "for_loop k:name comma W v:name W in a:name b:BLOCK",
    "for_loop v:name W in a:name b:BLOCK"],
    hooks: [forLoop, forLoop]
  },

  "COMMA_SEPARATED_EXPR": {rules:[
    "EXPR comma ANY_SPACE+ COMMA_SEPARATED_EXPR",
    "EXPR"
  ]},

  "ARRAY": {rules:[
    "open_bra c:COMMA_SEPARATED_EXPR? close_bra",
    "open_bra indent c:COMMA_SEPARATED_EXPR? dedent samedent close_bra",
    "open_bra indent c:COMMA_SEPARATED_EXPR? close_bra dedent",
  ]},

  "MEMBERS": {rules:[
    "name colon W EXPR comma ANY_SPACE+ MEMBERS",
    "name colon W EXPR"
  ]},

  "OBJECT": {rules:[
    "open_curly MEMBERS? close_curly",
    "open_curly indent MEMBERS? dedent samedent close_curly",
    "open_curly indent MEMBERS? close_curly dedent",
  ]},

  "TAG_PARAMS": {rules:[
      "left:TAG_PARAMS W right:TAG_PARAMS",
      "n:name assign e:EXPR",
      "n:name",
    ],
    hooks:[
      function(p){ return {left:p.left, right:p.right};},
      function(p){ return {n:p.n, e:p.e};},
      function(p){ return {n:p.n};},
    ],
    verbose:"tag parameters"
  },

  "TAG": {rules:[
    "tag:tag W? tp:TAG_PARAMS? end:>? b:BLOCK?",
  ],
  hooks:[
    function(p){
      return {tag:p.tag, params:p.tp, block:p.b};
    }]
  },

  "DOM_ASSIGN": {rules:[
    "assign EXPR",
  ]},

  "TRY_CATCH": {
    rules:[
      "try b1:BLOCK samedent? catch open_par err:name? close_par b2:BLOCK",
    ],
    hooks:[function(p){ return p; }],
  },
  "THROW": {rules:[
    "throw EXPR",
  ]},

  "RETURN": {rules:["ret W EXPR", "ret"]},
  "RIGHT_EXPR": {rules: [
    "math_operators",
    "W binary_operators W EXPR",
    "W comparison W EXPR",
    "W > W EXPR",
    "dot EXPR",
    "open_bra EXPR close_bra",
    "FUNC_CALL"
    ],
    verbose:"expression"
  },
  "EXPR": {rules: [
    "MATH",
    "OBJECT",
    "FUNC_DEF",
    "EXPR RIGHT_EXPR",
    //"FUNC_CALL",
    "LAMBDA",
    "number",
    "regexp",
    "open_par EXPR close_par",
    "string",
    "name",
    "PATH",
    "ARRAY"],
    verbose:"expression"
  },
};

function spacer(n) {
  var out = "";
  for(var i=0; i<n; i++) {
    out += " ";
  }
  return out;
}

function sp(mod) {
  if(mod) {
    return spacer(2 * (depth+mod));
  }
  return spacer(2 * depth);
}

var nc = 1;
// children name
function CN() {
  return '__c' + nc;
}
function pushCN() {
  nc++;
  return '__c' + nc;
}
function popCN() {
  nc--;
  return '__c' + nc;
}

var backend = {

  'dedent': function(node) {
    depth = Math.max(0, depth - 1);
    return '';
  },
  'indent': function(node) {
    depth = depth + 1;
    return '\n'+sp();
  },
  'samedent': function(node) {
    return '\n'+sp();
  },
  'DOM_ASSIGN': function(node) {
    var name = CN();
    return name+'.push(String(' + generateCode(node.children[1]) + '))';
  },
  'TAG_PARAMS': function(node) {
    if(node.children.left) {
      return generateCode(node.children.left) + ', ' + generateCode(node.children.right);
    }
    if(node.children.e) {
      return node.children.n.value + ':' + generateCode(node.children.e);
    } else {
      return node.children.n.value + ': true';
    }
  },
  'TAG': function(node) {
    var str = '', i, params = "{";
    var name = node.children.tag.value.substring(1);
    if(node.children.params) {
      params += generateCode(node.children.params);
    }
    params += '}';
    var sub = '[]';
    if(node.children.block) {
      sub = pushCN();
      str += 'var ' + CN() + ' = [];';
      str += generateCode(node.children.block);
      popCN();
    }
    str += '\n' + sp(1) + CN() + '.push(h("'+name+'", '+params+', '+sub+'))';
    return str;
  },
  'CLASS': function(node) {
    var name = node.children.name.value, i;
    var funcs = node.children.methods;
    var parent = node.children.parent;
    var str = '';
    var constructor = null;
    for(i=0;i<funcs.length; i++) {
      var func_def = funcs[i].children;
      var func_name = func_def.children.fn.value;
      if(func_name === 'constructor') {
        constructor = func_def;
      } else {
        str += '\n' + sp() + name + '.prototype.' + func_name + ' = ' + generateCode(func_def);
      }
    }
    var ns = currentNs();
    ns[name] = true;
    ns = newNs();

    var params = constructor && constructor.children.params;
    if(params) {
      params = generateCode(params);
    } else {
      params = '';
    }
    var body = constructor && constructor.children.block;
    var cons_str = 'var ' + name + ' = function ' + name + '('+ params + ') {';
    cons_str += '\n'+sp(1)+'if(!(this instanceof '+name+')){ return new '+name+'('+Object.keys(ns).join(',')+');}';
    for(var key in ns) {
      if(ns[key] !== true && ns[key] !== undefined) {
        cons_str += '\n'+sp(1)+'if('+key+' === undefined) {'+key+' = '+generateCode(ns[key])+'};';
      }
    }
    if(body) {
      cons_str += generateCode(body);
    }
    cons_str += sp() + '\n}';

    if(parent) {
      cons_str += '\n'+sp() + name + '.prototype = Object.create(' + parent.value + '.prototype);';
      cons_str += '\n'+sp() + name + '.prototype.constructor = '+name+'';
      //cons_str += '\n'+sp() + name + '.prototype.super = function(){' + parent.value + '.apply(this, arguments);}';
    }

    namespaces.pop();
    return cons_str + str;
  },
  'FUNC_DEF': function(node) {
    var name = "";
    var ns = currentNs();
    if(node.children.fn) {
      name = node.children.fn.value;
      ns[name] = true;
    }
    ns = newNs();
    var str = "function " + name + "(";
    if(node.children.params) {
      str += generateCode(node.children.params);
    }
    str += ') {';
    for(var key in ns) {
      if(ns[key] !== true && ns[key] !== undefined) {
        str += '\n'+sp(1)+'if('+key+' === undefined) {'+key+' = '+generateCode(ns[key])+'};';
      }
    }
    if(node.children.def.value === 'dom') {
      str += '\n'+sp(1) + 'var ' + CN() + ' = [];';
    }

    if(node.children.block) {
      str += generateCode(node.children.block);
    }
    namespaces.pop();

    if(node.children.def.value === 'dom') {
      str += '\n'+sp(1) + 'return ' + CN() + ';';
    }
    return str + '\n'+sp()+'}';
  },
  'FUNC_DEF_PARAMS': function(node) {
    var str = "", i;
    var ns = currentNs();
    if(node.children[0].type === 'name') {
      ns[node.children[0].value] = true;
      if(node.children[1] && node.children[1].type === 'assign') {
        ns[node.children[0].value] = node.children[2];
      }
    }
    for(i=0;i<node.children.length; i++) {
      var n = node.children[i];
      if(n.type === 'name' || n.type === 'FUNC_DEF_PARAMS' || n.type === 'comma' || n.type === 'window') {
        str += generateCode(node.children[i]);
      }
    }
    return str;
  },
  'LAMBDA': function(node) {
    var name = "";
    var ns = newNs();
    if(node.children.fn) {
      name = node.children.fn.value;
    }
    var str = "function " + name + "(";
    if(node.children.params) {
      str += generateCode(node.children.params, ns);
    }
    str += ') { return ';
    if(node.children.block) {
      str += generateCode(node.children.block, ns);
    }
    namespaces.pop();
    return str + "; }";
  },
  'ASSIGN': function(node) {
    var prefix = "";
    var op = node.children.op.value;
    var ns = currentNs();
    if(node.children.left.children[0].type === 'name') {
      var ch = node.children.left.children[0];
      if(ns[ch.value] === undefined) {
        if(op == ':=') {
          op = '=';
        } else {
          prefix = 'var ';
        }
        ns[ch.value] = true;
      }
    }
    return prefix+generateCode(node.children.left) + ' ' + op + ' ' + generateCode(node.children.right);
  },
  'STATEMENT': function(node) {
    return generateCode(node.children[0]) + ';';
  },
  'IF': function(node) {
    var str = '';
    str = 'if('+generateCode(node.children[0]) + '){' + generateCode(node.children[1]) + '\n'+sp()+'}';
    if(node.children[2]) {
      if(Array.isArray(node.children[2])) {
        for (var i = 0; i < node.children[2].length; i++) {
          str += generateCode(node.children[2][i]);
        }
      } else {
        str += generateCode(node.children[2]);
      }
    }
    if(node.children[3]) {
      str += generateCode(node.children[3]);
    }
    return str;
  },
  'FOR': function(node) {
    var keyIndexName = "_index" + forLoopCount;
    var keyArrayName = "_keys" + forLoopCount;
    forLoopCount++;
    var indexName = false;
    if(node.children[0]) {
      indexName = node.children[0].value;
    }
    var str = 'var '+keyArrayName+' = Object.keys('+node.children[2].value+');\n';
    str += sp() + 'for(var '+keyIndexName+' = 0; '+keyIndexName+' < '+keyArrayName+'.length; '+keyIndexName+'++ ) {\n';
    if(indexName) {
      str += sp(1) + 'var ' + indexName + ' = ' + keyArrayName +'[' + keyIndexName + '];\n';
    }
    str += sp(1) + 'var ' + node.children[1].value + ' = ' + node.children[2].value + '[' + keyArrayName +'[' + keyIndexName + ']];';
    str += generateCode(node.children[3]) +'\n'+sp()+'}';
    return str;
  },
  'ELSE_IF': function(node) {
    return ' else if('+generateCode(node.children[0])+') {'+generateCode(node.children[1])+ '\n'+sp()+'}';
  },
  'ELSE': function(node) {
    return ' else {'+generateCode(node.children[0])+ '\n'+sp()+'}';
  },
  'TRY_CATCH': function(node) {
    var str = "try {";
    str += generateCode(node.children.b1);
    str += '\n'+sp()+"} catch("+generateCode(node.children.err)+") {";
    str += generateCode(node.children.b2);
    return str+'\n'+sp()+"}";
  },
  'string': function(node) {
    var v = node.value;
    v = v.replace(/\n/g, "\\n");
    var ast = strGram.parse(v);
    if(!ast.complete) {
      throw new Error(ast.hint);
    }
    return generateStringCode(ast);
  },
  'comment': function(node) {
    return node.value.replace(/^#/g, "//");
  },
  'comparison': function(node) {
    if(node.value == '==') {
      return '===';
    }
    if(node.value == '!=') {
      return '!==';
    }
    return node.value;
  }
};

function generateCode(node, ns) {
  if(!node) {
    //debugger
  }
  if(backend[node.type]) {
    return backend[node.type](node);
  }
  if(node.value !== undefined) {
    return node.value;
  }
  var str = "", i;
  if(!node.children) {
    return '';
  }
  for(i=0;i<node.children.length; i++) {
    str += generateCode(node.children[i], ns);
  }
  return str;
}

function generateExports(keys) {
  var str = '\nmodule.exports = {';
  keys = keys || Object.keys(currentNs());
  for(var i=0; i < keys.length; i++) {
    str += '\n  ' + keys[i] + ': ' + keys[i] + ',';
  }
  return str + '\n}';
}

function generateModule(input, opts) {
  resetGlobal();
  var ast = gram.parse(input + "\n");
  if(!ast.complete) {
    throw new Error(ast.hint);
  }
  var obj = {ast:ast, code:generateCode(ast), ns:currentNs()};
  return obj;
}

var gram = epegjs.compileGrammar(grammarDef, tokenDef);

module.exports = {
  grammar: gram,
  strGrammar: strGram,
  grammarDef: grammarDef,
  epegjs:epegjs,
  tokenDef: tokenDef,
  generateModule: generateModule,
  generateCode: generateCode,
  generateExports: generateExports
};


},{"epegjs":2}],2:[function(require,module,exports){
(function (global){
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.EPEG=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
  JavaScript implementation of a Packrat Parsers with left Recursion Support
  http://www.vpri.org/pdf/tr2007002_packrat.pdf

  No Indirect Left Recursion yet :-(

  Batiste Bieler 2014
*/
"use strict";

function tokenize(input, gram) {
  var keys = gram.tokenKeys;
  var tokens = gram.tokenMap;
  var stream = [];
  var len = input.length, candidate, i, key, copy = input, lastToken = null;
  var pointer = 0;

  while(pointer < len) {
    candidate = null;
    for(i=0; i<keys.length; i++) {
      key = keys[i];
      var token = tokens[key], match;
      if(token.func) {
        match = token.func(input, stream);
        if(match !== undefined) {
          candidate = match;
          break;
        }
      } else if(token.reg){
        match = input.match(token.reg);
        if(match !== null) {
          candidate = match[0];
          break;
        }
      } else {
        throw new Error("Tokenizer error: Invalid token " + key + " without a reg or func property");
      }
    }
    if(candidate !== null) {
      lastToken = {type:key, value:candidate, pointer:pointer};
      stream.push(lastToken);
      pointer += candidate.length;
      input = input.substr(candidate.length);
    } else {
      if(stream.length === 0) {
        throw new Error("Tokenizer error: total match failure");
      }
      if(lastToken)
        lastToken.pointer += lastToken.value.length;
      var msg = errorMsg(copy, stream[stream.length - 1], "Tokenizer error", "No matching token found");
      if(lastToken)
        msg += "\n" + "Before token of type " + lastToken.type + ": " + lastToken.value;
      throw new Error(msg);
    }
  }
  stream.push({type:'EOF', value:""});
  return stream;
}

function copyToken(stoken, rtoken) {
  var t = {
    type:stoken.type,
    value:stoken.value,
    repeat:rtoken.repeat
  };
  if(rtoken.name) {
    t.name = rtoken.name;
  }
  return t;
}

function createParams(tokens) {
  var params = {};
  var j = 0;
  tokens.map(function(i) {
    if(i.name) {
      if(i.repeat == '*' || i.repeat == '+') {
        if(!params[i.name]) {
          params[i.name] = [];
        }
        params[i.name].push(i);
      } else {
        params[i.name] = i;
      }
    }
    params['$'+j] = i;
    j++;
  });
  return params;
}

function growLR(grammar, rule, stream, pos, memo) {
  var sp, result, progress = false;
  var hook = grammar[rule.key].hooks[rule.index];

  while(true) {
    sp = pos;

    result = evalRuleBody(grammar, rule, stream, sp);

    // ensure some progress is made
    if(result === false || result.sp <= memo.sp) {
      return progress;
    }

    // apply rule hooks
    if(hook && !result.hooked) {
      result.children = hook(createParams(result.children));
      result.hooked = true;
    }
    result.hooked = true;

    // it's very important to update the memoized value
    // this is actually growing the seed in the memoization
    memo.children = result.children;
    memo.sp = result.sp;
    memo.start = result.start;
    memo.hooked = result.hooked;
    progress = result;
  }
  return progress;
}

function memoEval(grammar, rule, stream, pointer) {

  var key = rule.key+';'+pointer+';'+rule.index;

  // avoid infinite recursion
  // This is faster than filter
  var i = stack.length - 1;
  while(i >= 0) {
    if(stack[i][0] == key) {
      return false;
    }
    i = i-1;
  }

  var memo_entry = memoization[rule.key+';'+pointer];
  if(memo_entry !== undefined) {
    return memo_entry;
  }

  stack.push([key, rule]);
  var result = evalRuleBody(grammar, rule, stream, pointer);
  stack.pop();

  return result;
}

function canFail(token, node) {
  if(token.repeat === '*' || token.repeat === '?') {
    return true;
  }
  if(token.repeat === '+' && node.children.length && node.children[node.children.length - 1].type == token.type) {
    return true;
  }
  return false;
}

function canRepeat(token) {
  return token.repeat === '*' || token.repeat === '+';
}

function evalRuleBody(grammar, rule, stream, pointer) {

  var sp = pointer; // stream pointer
  var rp = 0;       // rule pointer
  var j, result;
  var currentNode = {type: rule.key, children:[], start:pointer, name:rule.name};

  var rtoken = rule.tokens[rp];
  var stoken = stream[sp];

  while(rtoken && stoken) {

    // Case one: we have a rule we need to develop
    if(grammar[rtoken.type]) {

      var expand_rules = grammar[rtoken.type].rules;
      var hooks = grammar[rtoken.type].hooks;
      result = false;

      var m = memoization[rtoken.type+';'+sp];
      if(m) {
        result = m;
      }

      if(!result) {
        for(j=0; j<expand_rules.length; j++) {
          var r = expand_rules[j];
          var hook = hooks && hooks[j];

          result = memoEval(grammar, r, stream, sp);

          if(result) {

            if(hook && !result.hooked) {
              result.children = hook(createParams(result.children));
            }
            result.hooked = true;

            memoization[r.key+';'+sp] = result;

            if(rtoken.repeat === false) {
              var n_result = growLR(grammar, rule, stream, sp, result);
              if(n_result !== false) {
                return n_result;
              }
            }
            break;
          }
        }
      }

      if(result) {
        sp = result.sp;
        currentNode.children.push({
            type: rtoken.type,
            children:result.children,
            sp:result.sp,
            name:rtoken.name,
            repeat: rtoken.repeat
          });
        if(!canRepeat(rtoken)) {
          rp++;
        }
      } else {
        if(!canFail(rtoken, currentNode)) {
          return false;
        }
        rp++;
      }

    // Case two: we have a proper token
    } else {
      if(stoken.type === rtoken.type) {
        //currentNode.children.push(copyToken(stoken, rtoken));
        if(!rtoken.nonCapturing) {
          currentNode.children.push(copyToken(stoken, rtoken));
          sp++;
        }
        if(!canRepeat(rtoken)) {
          rp++;
        }
      } else {
        if(!canFail(rtoken, currentNode)) {
          return false;
        }
        rp++;
      }

    }

    // information used for debugging purpose
    if(best_p === sp) {
      best_parse.candidates.push([rule, rule.tokens[rp]]);
    }
    if(best_p < sp) {
      best_parse = {sp:sp, candidates:[[rule, rule.tokens[rp]]]};
      best_p = sp;
    }

    // fetch next rule and stream token
    rtoken = rule.tokens[rp];
    stoken = stream[sp];

    // rule satisfied
    if(rtoken === undefined) {
      currentNode.sp = sp;
      currentNode.rp = rp;
      return currentNode;
    }

    // no more tokens
    if(stoken === undefined) {
      if(canFail(rtoken, currentNode)) {
        // This does not happen often because of EOF,
        // As it stands the last token as always to be EOF
        currentNode.sp = sp;
        currentNode.rp = rp;
        return currentNode;
      }
      return false;
    }

  } // end rule body loop

  return false;
}

function splitTrim(l, split) {
  return l.split(split).map(function(i){ return i.trim(); });
}

function grammarToken(token) {
  var nonCapturing = token.charAt(0) === '!';
  if(nonCapturing) {
    token = token.substr(1);
  }
  var repeat = token.charAt(token.length - 1);
  if(repeat === '*' || repeat === '?' || repeat === '+') {
    token = token.substr(0, token.length - 1);
  } else {
    repeat = false;
  }
  var named = token.split(":"), t;
  if(named.length === 2) {
    t = {
      'type': named[1],
      'name' :named[0]
    };
  } else {
    t = {'type': token };
  }
  t.repeat = repeat;
  if((repeat === '*' || repeat === '+') && nonCapturing) {
    throw new Error("Impossible to have non capturing token that repeats");
  }
  if(nonCapturing) {
    t.nonCapturing = nonCapturing;
  }
  return t;
}

function compileGrammar(grammar, tokenDef) {
  var keys = Object.keys(grammar), i, j, k;
  var gram = {}, optional, nonCapturing;

  gram.tokenDef = tokenDef;
  gram.tokenKeys = [];
  gram.tokenMap = {};
  tokenDef.map(function(t) {
    gram.tokenMap[t.key] = t;
    gram.tokenKeys.push(t.key);
  });

  var allValidKeys = keys.concat(gram.tokenKeys);

  for(i=0; i<keys.length; i++) {
    var line = grammar[keys[i]];
    var key = keys[i];
    var rules = line.rules;

    var splitted_rules = [];

    for(j=0; j<rules.length; j++) {
      var tokens = splitTrim(rules[j], ' ');
      optional = 0;
      for(k=0; k<tokens.length; k++) {
        var token = tokens[k] = grammarToken(tokens[k]);
        if(allValidKeys.indexOf(token.type) === -1 && token.type !== 'EOF') {
          throw new Error("Invalid token type used in the grammar rule "+key+": " + token.type + ', valid tokens are: '+allValidKeys.join(', '));
        }
        if(token.repeat === '*') {
          optional += 1;
        }
        if(token.nonCapturing) {
          if(tokens[tokens.length - 1] != tokens[k]) {
            throw new Error("A non capturing token can only be the last one in the rule: " + token.type);
          }
        }
      }
      if(optional === tokens.length) {
        throw new Error("Rule " + rules[j] + " only has optional greedy tokens.");
      }
      splitted_rules.push({key: key, index:j, tokens:tokens});
    }
    // todo: use a property
    gram[key] = {rules: splitted_rules, hooks: line.hooks || [], verbose:line.verbose};
  }
  gram.parse = function(stream) {
    return parse(stream, gram);
  };
  return gram;
}

function spacer(n) {
  var out = "";
  for(var i=0; i<n; i++) {
    out += " ";
  }
  return out;
}

function errorMsg(input, token, errorType, m) {

  var charn = token.pointer || 0;
  var lines = input.split("\n"), i, charCounter = 0, charOnLine = 0;

  for(i=0; i<lines.length; i++) {
    charCounter += lines[i].length + 1;
    if(charCounter >= charn) {
      break;
    }
    charOnLine += lines[i].length + 1;
  }

  var ln = Math.max(0, i); // line number
  var msg = errorType + " at line "+(ln+1)+" char "+ (charn - charOnLine) +": ";
  var indicator = "\n" + spacer((charn - charOnLine) + ((ln) + ': ').length);

  if(lines[ln-1] !== undefined) {
    msg = msg + "\n" + (ln) + ': ' + lines[ln-1];
  }
  msg = msg + "\n" + (ln+1) + ': ' + lines[ln] + indicator;
  msg = msg + "^-- " + m;

  if(lines[ln+1] !== undefined) {
    msg = msg + "\n" + (ln+2) + ': ' + lines[ln+1];
  }

  return msg;
}

function verboseName(grammar, type) {
  var tokendef = grammar.tokenMap[type];
  if(tokendef && tokendef.verbose) {
    return tokendef.verbose;
  }
  if(grammar[type] && grammar[type].verbose) {
    return grammar[type].verbose;
  }
  return type;
}

function hint(input, stream, best_parse, grammar) {
  if(!best_parse || !best_parse.candidates[0]) {
    return "Complete failure to parse";
  }
  var rule = best_parse.candidates[0][0];

  var array = [];
  best_parse.candidates.map(function(r) {
    if(!r[1]) { return; }
    var name = verboseName(grammar, r[1].type);
    if(array.indexOf(name) === -1) {
      array.push(name);
    }
  });
  var candidates = array.join(' or ');

  var msg = errorMsg(input, stream[best_parse.sp], "Parser error", "Rule " + verboseName(grammar, rule.key));
  msg = msg + "\nExpect " + candidates;
  var lastToken = stream[best_parse.sp] || {type:"EOF"};
  msg = msg + "\nBut got " + verboseName(grammar, lastToken.type) + " instead";

  return msg;
}

// those are module globals
var stack = [];
var memoization = {};
var best_parse = null;
var best_p = 0;

function parse(input, grammar) {
  var bestResult = {type:'START', sp:0, complete:false}, i, result, stream;
  //if(typeof input === 'string') {
  stream = tokenize(input, grammar);
  //}
  best_parse = {sp:0, candidates:[]};
  best_p = 0;
  for(i=0; i<grammar.START.rules.length; i++) {
    stack = [];
    memoization = {};
    result = memoEval(grammar, grammar.START.rules[i], stream, 0);
    if(result && result.sp > bestResult.sp) {
      bestResult = {
        type:'START',
        children:result.children,
        sp: result.sp,
        complete:result.sp === stream.length,
        inputLength:stream.length,
      };
    }
  }
  bestResult.bestParse = best_parse;
  if(best_parse && !bestResult.complete) {
    bestResult.hint = hint(input, stream, best_parse, grammar);
  }
  return bestResult;
}

module.exports = {
  parse: parse,
  stack: stack,
  compileGrammar: compileGrammar,
  tokenize: tokenize,
  memoization: memoization
};

},{}]},{},[1])(1)
});


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb2tlc2NyaXB0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBRGh0QkE7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qXG4gIENva2VTY3JpcHQgbGFuZ3VhZ2UgYnkgQmF0aXN0ZSBCaWVsZXIgMjAxNVxuICBJbXBsZW1lbnRlZCB1c2luZyBFUEVHLkpTXG4qL1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBlcGVnanMgPSByZXF1aXJlKFwiZXBlZ2pzXCIpO1xuXG52YXIgZGVwdGggPSAwO1xudmFyIGZvckxvb3BDb3VudCA9IDE7XG52YXIgbmFtZXNwYWNlcyA9IFt7fV07XG52YXIgbGV2ZWxTdGFjayA9IFswXTtcblxuZnVuY3Rpb24gY3VycmVudE5zKCkge1xuICByZXR1cm4gbmFtZXNwYWNlc1tuYW1lc3BhY2VzLmxlbmd0aCAtMV07XG59XG5cbmZ1bmN0aW9uIG5ld05zKCkge1xuICBuYW1lc3BhY2VzLnB1c2goe30pO1xuICByZXR1cm4gbmFtZXNwYWNlc1tuYW1lc3BhY2VzLmxlbmd0aCAtMV07XG59XG5cbmZ1bmN0aW9uIHJlc2V0R2xvYmFsKCkge1xuICBuYW1lc3BhY2VzID0gW3t9XTtcbiAgZm9yTG9vcENvdW50ID0gMTtcbiAgbGV2ZWxTdGFjayA9IFswXTtcbiAgZGVwdGggPSAwO1xufVxuXG4vLyB0b2tlbiBhcmUgbWF0Y2hlZCBpbiBvcmRlciBvZiBkZWNsYXJhdGlvblxuLy8gVE9ETzogYWRkIGZ1bmN0aW9uc1xudmFyIHRva2VuRGVmID0gW1xuICB7a2V5Olwic3RyaW5nXCIsIGZ1bmM6c3RyaW5nRGVmfSxcbiAge2tleTpcImNvbW1lbnRcIiwgZnVuYzpjb21tZW50RGVmfSxcbiAge2tleTpcImZ1bmN0aW9uX2RlZlwiLCBmdW5jOiBkZWZEZWYsIHZlcmJvc2U6XCJmdW5jdGlvbiBkZWZpbml0aW9uXCJ9LFxuICB7a2V5OlwiY2xhc3NcIiwgcmVnOi9eY2xhc3MgL30sXG4gIHtrZXk6XCJyZXRcIiwgcmVnOi9ecmV0dXJuLywgdmVyYm9zZTpcInJldHVyblwifSxcbiAge2tleTpcImlmXCIsIHJlZzovXmlmIC99LFxuICB7a2V5OlwidHJ5XCIsIHJlZzovXnRyeS99LFxuICB7a2V5OlwiY2F0Y2hcIiwgcmVnOi9eY2F0Y2gvfSxcbiAge2tleTpcInRocm93XCIsIHJlZzovXnRocm93IC99LFxuICB7a2V5OlwidGFnXCIsIHJlZzovXjxbYS16QS1aXyRdWzAtOWEtekEtWl9dezAsMjl9L30sXG4gIHtrZXk6XCI+XCIsIHJlZzovXj4vfSxcbiAge2tleTpcImVsc2VpZlwiLCByZWc6L15lbHNlaWYgL30sXG4gIHtrZXk6XCJlbHNlXCIsIHJlZzovXmVsc2UvfSxcbiAge2tleTpcImZvcl9sb29wXCIsIHJlZzovXmZvciAvLCB2ZXJib3NlOlwiZm9yIGxvb3BcIn0sXG4gIHtrZXk6XCJpblwiLCByZWc6L15pbiAvfSxcbiAge2tleTpcIm5hbWVcIiwgcmVnOi9eW2EtekEtWl8kXVswLTlhLXpBLVpfXXswLDI5fS99LCAvLyAzMCBjaGFycyBtYXhcbiAge2tleTpcInJlZ2V4cFwiLCBmdW5jOnJlZ0V4cERlZiwgdmVyYm9zZTpcInJlZ3VsYXIgZXByZXNzaW9uXCJ9LFxuICB7a2V5OlwibWF0aF9vcGVyYXRvcnNcIiwgcmVnOi9eKFxcK1xcK3xcXC1cXC0pLywgdmVyYm9zZTpcIm1hdGggb3BlcmF0b3JcIn0sXG4gIHtrZXk6XCJiaW5hcnlfb3BlcmF0b3JzXCIsIHJlZzovXihcXCZcXCZ8XFx8XFx8fFxcJnxcXHx8PDx8XFw+XFw+KS8sIHZlcmJvc2U6XCJiaW5hcnkgb3BlcmF0b3JcIn0sXG4gIHtrZXk6XCJjb21wYXJpc29uXCIsIHJlZzovXig8PXw+PXw8fD58IT18PT0pL30sXG4gIHtrZXk6XCJhc3NpZ25cIiwgcmVnOi9eKFxcKz18LT18PXw6PSkvfSxcbiAge2tleTpcIm51bWJlclwiLCByZWc6L15bMC05XStcXC4/WzAtOV0qL30sIC8vIG9ubHkgcG9zaXRpdmUgZm9yIG5vd1xuICB7a2V5OlwiY29tbWFcIiwgcmVnOi9eXFwsL30sXG4gIHtrZXk6XCJkb3RcIiwgcmVnOi9eXFwuL30sXG4gIHtrZXk6XCJjb2xvblwiLCByZWc6L15cXDovLCB2ZXJib3NlOlwiOlwifSxcbiAge2tleTpcIm9wZW5fcGFyXCIsIHJlZzovXlxcKC8sIHZlcmJvc2U6XCIoXCJ9LFxuICB7a2V5OlwiY2xvc2VfcGFyXCIsIHJlZzovXlxcKS8sIHZlcmJvc2U6XCIpXCJ9LFxuICB7a2V5Olwib3Blbl9icmFcIiwgcmVnOi9eXFxbLywgdmVyYm9zZTpcIltcIn0sXG4gIHtrZXk6XCJjbG9zZV9icmFcIiwgcmVnOi9eXFxdLywgdmVyYm9zZTpcIl1cIn0sXG4gIHtrZXk6XCJvcGVuX2N1cmx5XCIsIHJlZzovXlxcey8sIHZlcmJvc2U6XCJ7XCJ9LFxuICB7a2V5OlwiY2xvc2VfY3VybHlcIiwgcmVnOi9eXFx9LywgdmVyYm9zZTpcIn1cIn0sXG4gIHtrZXk6XCJtYXRoXCIsIHJlZzovXlstfFxcK3xcXCp8L3wlXS99LFxuICB7a2V5Olwic2FtZWRlbnRcIiwgZnVuYzpkZW50KCdzYW1lZGVudCcpLCB2ZXJib3NlOlwic2FtZSBpbmRlbnRhdGlvblwifSxcbiAge2tleTpcImRlZGVudFwiLCBmdW5jOmRlbnQoJ2RlZGVudCcpfSxcbiAge2tleTpcImluZGVudFwiLCBmdW5jOmRlbnQoJ2luZGVudCcpfSxcbiAgLy9uZXdsaW5lOiAvXihcXHI/XFxufCQpLyxcbiAge2tleTpcIldcIiwgcmVnOi9eWyBdLywgdmVyYm9zZTpcInNpbmdsZSB3aGl0ZXNwYWNlXCJ9LFxuXTtcblxuZnVuY3Rpb24gc3RhcnRTdHIoaW5wdXQsIHN0cmVhbSkge1xuICB2YXIgbGFzdCA9IHN0cmVhbVtzdHJlYW0ubGVuZ3RoLTFdO1xuICBpZihsYXN0ICYmIGxhc3QudmFsdWUgPT09ICdcXFxcJykge1xuICAgIHJldHVybjtcbiAgfVxuICBpZihpbnB1dC5tYXRjaCgvXiN7LykpIHtcbiAgICByZXR1cm4gJyN7JztcbiAgfVxufVxuXG52YXIgc3RySW50ZXJwb2xhdGlvblRva2VuRGVmID0gW1xuICB7a2V5Olwic3RhcnRcIiwgZnVuYzpzdGFydFN0cn0sXG4gIHtrZXk6XCJlbmRcIiwgcmVnOi9efS99LFxuICB7a2V5OlwibmFtZVwiLCByZWc6L15bYS16QS1aXyRdWzAtOWEtekEtWl9dezAsMjl9L30sXG4gIHtrZXk6XCJkb3RcIiwgcmVnOi9eXFwuL30sXG4gIHtrZXk6XCJjaGFyXCIsIHJlZzovXi4vfSxcbl07XG5cbnZhciBzdHJJbnRlcnBvbGF0aW9uR3JhbW1hckRlZiA9IHtcbiAgXCJTVEFSVFwiOiB7cnVsZXM6W1wiRUwqIEVPRlwiXX0sXG4gIFwiRUxcIjoge3J1bGVzOltcIlZBUlwiLCBcImNoYXJcIiwgXCJuYW1lXCIsIFwic3RhcnRcIiwgXCJlbmRcIiwgXCJkb3RcIl19LFxuICBcIlZBUlwiOiB7cnVsZXM6W1wic3RhcnQgTkFNRSBlbmRcIl19LFxuICBcIk5BTUVcIjoge3J1bGVzOltcIm5hbWUgZG90IE5BTUVcIiwgXCJuYW1lXCJdfSxcbn07XG5cbnZhciBzdHJHcmFtID0gZXBlZ2pzLmNvbXBpbGVHcmFtbWFyKHN0ckludGVycG9sYXRpb25HcmFtbWFyRGVmLCBzdHJJbnRlcnBvbGF0aW9uVG9rZW5EZWYpO1xuXG5mdW5jdGlvbiBnZW5lcmF0ZVN0cmluZ0NvZGUobm9kZSkge1xuICBpZihub2RlLnR5cGUgPT09ICdWQVInKSB7XG4gICAgcmV0dXJuICdcIiArICcgKyBnZW5lcmF0ZVN0cmluZ0NvZGUobm9kZS5jaGlsZHJlblsxXSkgKyAnICsgXCInO1xuICB9XG4gIGlmKG5vZGUudmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9XG4gIHZhciBzdHIgPSBcIlwiLCBpO1xuICBpZighbm9kZS5jaGlsZHJlbikge1xuICAgIHJldHVybiAnJztcbiAgfVxuICBmb3IoaT0wO2k8bm9kZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgIHN0ciArPSBnZW5lcmF0ZVN0cmluZ0NvZGUobm9kZS5jaGlsZHJlbltpXSk7XG4gIH1cbiAgcmV0dXJuIHN0cjtcbn1cblxuZnVuY3Rpb24gY3VycmVudExldmVsKCkge1xuICByZXR1cm4gbGV2ZWxTdGFja1tsZXZlbFN0YWNrLmxlbmd0aCAtIDFdO1xufVxuXG5mdW5jdGlvbiBpbmRlbnRUeXBlKGwpIHtcbiAgaWYobCA+IGN1cnJlbnRMZXZlbCgpKSB7XG4gICAgcmV0dXJuICdpbmRlbnQnO1xuICB9XG4gIGlmKGwgPCBjdXJyZW50TGV2ZWwoKSkge1xuICAgIHJldHVybiAnZGVkZW50JztcbiAgfVxuICBpZihsID09PSBjdXJyZW50TGV2ZWwoKSkge1xuICAgIHJldHVybiAnc2FtZWRlbnQnO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRlbnQoZGVudFR5cGUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIF9kZW50KGlucHV0KSB7XG4gICAgLy8gZW1wdHkgbGluZSBpcyBhIHNhbWVkZW50XG4gICAgdmFyIG0gPSBpbnB1dC5tYXRjaCgvXlxcbltcXHNdKi8pO1xuICAgIGlmKG0pIHtcbiAgICAgIHZhciBsaW5lcyA9IG1bMF0uc3BsaXQoXCJcXG5cIik7XG4gICAgICB2YXIgaW5kZW50ID0gbGluZXNbbGluZXMubGVuZ3RoIC0gMV0ubGVuZ3RoO1xuICAgICAgaWYoaW5kZW50VHlwZShpbmRlbnQpID09PSBkZW50VHlwZSkge1xuICAgICAgICBpZihkZW50VHlwZSA9PSAnZGVkZW50Jykge1xuICAgICAgICAgIGxldmVsU3RhY2sucG9wKCk7XG4gICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICB9XG4gICAgICAgIGlmKGRlbnRUeXBlID09ICdpbmRlbnQnKSB7XG4gICAgICAgICAgbGV2ZWxTdGFjay5wdXNoKGluZGVudCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1bMF07XG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuXG5mdW5jdGlvbiBzdHJpbmdEZWYoaW5wdXQpIHtcbiAgaWYoaW5wdXQuY2hhckF0KDApID09PSAnXCInKSB7XG4gICAgdmFyIGkgPSAxO1xuICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSkge1xuICAgICAgdmFyIGNoID0gaW5wdXQuY2hhckF0KGkpO1xuICAgICAgaWYoY2ggPT09ICdcXFxcJykge1xuICAgICAgICBpKys7XG4gICAgICB9IGVsc2UgaWYoY2ggPT09ICdcIicpIHtcbiAgICAgICAgcmV0dXJuIGlucHV0LnNsaWNlKDAsIGkrMSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHJlZ0V4cERlZihpbnB1dCkge1xuICBpZihpbnB1dC5jaGFyQXQoMCkgPT09ICcvJykge1xuICAgIHZhciBpID0gMTtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpIHtcbiAgICAgIHZhciBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxcXCcpIHtcbiAgICAgICAgaSsrO1xuICAgICAgfSBlbHNlIGlmKGNoID09PSAnLycpIHtcbiAgICAgICAgcmV0dXJuIGlucHV0LnNsaWNlKDAsIGkrMSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGRlZkRlZihpbnB1dCkge1xuICBpZihpbnB1dC5pbmRleE9mKFwiZGVmKFwiKSA9PT0gMCkge1xuICAgIHJldHVybiBcImRlZlwiO1xuICB9XG4gIGlmKGlucHV0LmluZGV4T2YoXCJkZWYgXCIpID09PSAwKSB7XG4gICAgcmV0dXJuIFwiZGVmXCI7XG4gIH1cbiAgaWYoaW5wdXQuaW5kZXhPZihcImRlZlxcblwiKSA9PT0gMCkge1xuICAgIHJldHVybiBcImRlZlwiO1xuICB9XG4gIGlmKGlucHV0LmluZGV4T2YoXCJkb20gXCIpID09PSAwKSB7XG4gICAgcmV0dXJuIFwiZG9tXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tbWVudERlZihpbnB1dCkge1xuICB2YXIgbSA9IGlucHV0Lm1hdGNoKC9eIy8pO1xuICBpZihtKSB7XG4gICAgdmFyIGkgPSBtWzBdLmxlbmd0aDtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpIHtcbiAgICAgIHZhciBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxuJykge1xuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGZfZGVmKHBhcmFtcykge1xuICByZXR1cm4ge2RlZjpwYXJhbXMuZmQsIGZuOnBhcmFtcy5mbiwgcGFyYW1zOnBhcmFtcy5wLCBibG9jazpwYXJhbXMuYn07XG59XG5cbmZ1bmN0aW9uIGxhbWJkYV9kZWYocGFyYW1zKSB7XG4gIHJldHVybiB7Zm46cGFyYW1zLmZuLCBwYXJhbXM6cGFyYW1zLnAsIGJsb2NrOnBhcmFtcy5ifTtcbn1cblxuZnVuY3Rpb24gZWxzZV9kZWYocGFyYW1zKSB7XG4gIHJldHVybiBbcGFyYW1zLmJdO1xufVxuXG5mdW5jdGlvbiBlbHNlX2lmX2RlZihwYXJhbXMpIHtcbiAgcmV0dXJuIFtwYXJhbXMuZSwgcGFyYW1zLmJdO1xufVxuXG5mdW5jdGlvbiBpZl9kZWYocGFyYW1zKSB7XG4gIHJldHVybiBbcGFyYW1zLmUsIHBhcmFtcy5iLCBwYXJhbXMuZWxpZiwgcGFyYW1zLmVsXTtcbn1cblxuZnVuY3Rpb24gZm9yTG9vcChwYXJhbXMpIHtcbiAgcmV0dXJuIFtwYXJhbXMuaywgcGFyYW1zLnYsIHBhcmFtcy5hLCBwYXJhbXMuYl07XG59XG5cbnZhciBncmFtbWFyRGVmID0ge1xuICBcIlNUQVJUXCI6IHtydWxlczpbXCJMSU5FKiBFT0ZcIl19LFxuICBcIkVMQ1wiOiB7cnVsZXM6W1wiVyogY29tbWVudFwiXSwgdmVyYm9zZTpcImNvbW1lbnRcIn0sXG4gIFwiTElORVwiOiB7cnVsZXM6W1wiU1RBVEVNRU5UIEVMQz8gc2FtZWRlbnQrXCIsIFwiU1RBVEVNRU5UIEVMQz8gIWRlZGVudFwiLCBcIkVMQz8gc2FtZWRlbnRcIiwgXCJFTEMgIWRlZGVudFwiXSwgdmVyYm9zZTpcIm5ldyBsaW5lXCJ9LFxuICBcIkJMT0NLXCI6IHtydWxlczogW1wiaW5kZW50IExJTkUrIGRlZGVudFwiXX0sXG4gIFwiU1RBVEVNRU5UXCI6IHtydWxlczpbXCJBU1NJR05cIiwgXCJJRlwiLCBcIkZPUlwiLCBcIkVYUFJcIiwgXCJSRVRVUk5cIiwgXCJDTEFTU1wiLCBcIlRBR1wiLCBcIkRPTV9BU1NJR05cIiwgXCJUUllfQ0FUQ0hcIiwgXCJUSFJPV1wiXX0sXG4gIFwiQ0xBU1NfTUVUSE9EU1wiOiB7XG4gICAgICBydWxlczogW1wic2FtZWRlbnQqIGY6RlVOQ19ERUYgc2FtZWRlbnQqXCJdLFxuICAgICAgaG9va3M6IFsgZnVuY3Rpb24ocCl7IHJldHVybiBwLmY7IH1dXG4gIH0sXG4gIFwiQ0xBU1NcIjoge1xuICAgIHJ1bGVzOiBbXG4gICAgICBcImNsYXNzIG46bmFtZSBvcGVuX3BhciBwOm5hbWUgY2xvc2VfcGFyIGluZGVudCBtOkNMQVNTX01FVEhPRFMrIGRlZGVudFwiLFxuICAgICAgXCJjbGFzcyBuOm5hbWUgaW5kZW50IG06Q0xBU1NfTUVUSE9EUysgZGVkZW50XCJcbiAgICBdLFxuICAgIGhvb2tzOiBbXG4gICAgICBmdW5jdGlvbihwKXsgcmV0dXJuIHtuYW1lOnAubiwgbWV0aG9kczpwLm0sIHBhcmVudDpwLnB9OyB9LFxuICAgICAgZnVuY3Rpb24ocCl7IHJldHVybiB7bmFtZTpwLm4sIG1ldGhvZHM6cC5tfTsgfVxuICAgIF1cbiAgfSxcbiAgXCJGVU5DX0RFRl9QQVJBTVNcIjoge3J1bGVzOltcbiAgICAgIFwicDE6RlVOQ19ERUZfUEFSQU1TIGNvbW1hIFcgcDI6RlVOQ19ERUZfUEFSQU1TXCIsXG4gICAgICBcInAxOm5hbWUgYXNzaWduIGU6RVhQUlwiLFxuICAgICAgXCJwMTpuYW1lXCIsXG4gICAgXSxcbiAgICB2ZXJib3NlOlwiZnVuY3Rpb24gcGFyYW1ldGVyc1wiXG4gIH0sXG4gIFwiTEFNQkRBXCI6IHtydWxlczpbXG4gICAgICBcImZ1bmN0aW9uX2RlZiBvcGVuX3BhciBwOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIFcgYjpFWFBSXCIsXG4gICAgICBcImZ1bmN0aW9uX2RlZiBXIGZuOm5hbWUgb3Blbl9wYXIgcDpGVU5DX0RFRl9QQVJBTVM/IGNsb3NlX3BhciBXIGI6RVhQUlwiLFxuICAgICAgXCJmdW5jdGlvbl9kZWYgVyBiOkVYUFJcIixcbiAgICBdLFxuICAgIGhvb2tzOiBbbGFtYmRhX2RlZiwgbGFtYmRhX2RlZiwgbGFtYmRhX2RlZl1cbiAgfSxcbiAgXCJGVU5DX0RFRlwiOiB7cnVsZXM6W1xuICAgICAgXCJmZDpmdW5jdGlvbl9kZWYgb3Blbl9wYXIgcDpGVU5DX0RFRl9QQVJBTVM/IGNsb3NlX3BhciBiOkJMT0NLXCIsXG4gICAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGZuOm5hbWUgb3Blbl9wYXIgcDpGVU5DX0RFRl9QQVJBTVM/IGNsb3NlX3BhciBiOkJMT0NLXCIsXG4gICAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGZuOm5hbWUgYjpCTE9DS1wiLFxuICAgICAgXCJmZDpmdW5jdGlvbl9kZWYgYjpCTE9DS1wiLFxuICAgIF0sXG4gICAgaG9va3M6IFtmX2RlZiwgZl9kZWYsIGZfZGVmLCBmX2RlZl0sXG4gICAgdmVyYm9zZTpcImZ1bmN0aW9uIGRlZmluaXRpb25cIlxuICB9LFxuICBcIkVMU0VfSUZcIjoge3J1bGVzOltcInNhbWVkZW50IGVsc2VpZiBlOkVYUFIgYjpCTE9DS1wiXSwgaG9va3M6W2Vsc2VfaWZfZGVmXX0sXG4gIFwiRUxTRVwiOiB7cnVsZXM6W1wic2FtZWRlbnQgZWxzZSBiOkJMT0NLXCJdLCBob29rczpbZWxzZV9kZWZdfSxcbiAgXCJJRlwiOiB7cnVsZXM6W1wiaWYgZTpFWFBSIGI6QkxPQ0sgZWxpZjpFTFNFX0lGKiBlbDpFTFNFP1wiXSwgaG9va3M6W2lmX2RlZl19LFxuICBcIk1BVEhcIjoge3J1bGVzOltcImUxOkVYUFIgVyBvcDptYXRoIFcgZTI6RVhQUlwiXX0sXG4gIFwiUEFUSFwiOiB7cnVsZXM6W1wiUEFUSCBkb3QgbmFtZVwiLCBcIlBBVEggb3Blbl9icmEgbnVtYmVyIGNsb3NlX2JyYVwiLCBcIm5hbWVcIl19LFxuICBcIkFTU0lHTlwiOiB7cnVsZXM6W1wibGVmdDpFWFBSIFcgb3A6YXNzaWduIFcgcmlnaHQ6RVhQUlwiXSwgaG9va3M6W1xuICAgIGZ1bmN0aW9uKHApe1xuICAgICAgcmV0dXJuIHtsZWZ0OnAubGVmdCwgb3A6cC5vcCwgcmlnaHQ6cC5yaWdodH07XG4gICAgfV1cbiAgfSxcbiAgXCJXX09SX1NBTUVERU5UXCI6IHtydWxlczpbXCJXXCIsIFwic2FtZWRlbnRcIl0sIHZlcmJvc2U6IFwic2FtZWRlbnQgb3Igd2hpdGVzcGFjZVwifSxcbiAgXCJXX1NBTUVERU5UX0lOREVOVFwiOiB7cnVsZXM6W1wiV1wiLCBcInNhbWVkZW50XCIsIFwiaW5kZW50XCJdLCB2ZXJib3NlOiBcImluZGVudCBvciBzYW1lZGVudCBvciB3aGl0ZXNwYWNlXCJ9LFxuICBcIkFOWV9TUEFDRVwiOiB7cnVsZXM6W1wiV1wiLCBcInNhbWVkZW50XCIsIFwiaW5kZW50XCIsIFwiZGVkZW50XCJdLCB2ZXJib3NlOiBcImFueSBzcGFjZVwifSxcbiAgXCJGVU5DX0NBTExfUEFSQU1TXCI6IHtydWxlczpbXCJGVU5DX0NBTExfUEFSQU1TIGNvbW1hIEFOWV9TUEFDRSsgRVhQUiBBTllfU1BBQ0UqXCIsIFwiRVhQUlwiXX0sXG4gIFwiRlVOQ19DQUxMXCI6IHtydWxlczpbXG4gICAgXCJvcGVuX3BhciBGVU5DX0NBTExfUEFSQU1TPyBjbG9zZV9wYXJcIixcbiAgICBcIm9wZW5fcGFyIGluZGVudCBGVU5DX0NBTExfUEFSQU1TPyBkZWRlbnQgc2FtZWRlbnQgY2xvc2VfcGFyXCIsXG4gICAgXCJvcGVuX3BhciBpbmRlbnQgRlVOQ19DQUxMX1BBUkFNUz8gY2xvc2VfcGFyIGRlZGVudFwiXG4gIF19LFxuXG4gIFwiRk9SXCI6IHtydWxlczpbXG4gICAgXCJmb3JfbG9vcCBrOm5hbWUgY29tbWEgVyB2Om5hbWUgVyBpbiBhOm5hbWUgYjpCTE9DS1wiLFxuICAgIFwiZm9yX2xvb3AgdjpuYW1lIFcgaW4gYTpuYW1lIGI6QkxPQ0tcIl0sXG4gICAgaG9va3M6IFtmb3JMb29wLCBmb3JMb29wXVxuICB9LFxuXG4gIFwiQ09NTUFfU0VQQVJBVEVEX0VYUFJcIjoge3J1bGVzOltcbiAgICBcIkVYUFIgY29tbWEgQU5ZX1NQQUNFKyBDT01NQV9TRVBBUkFURURfRVhQUlwiLFxuICAgIFwiRVhQUlwiXG4gIF19LFxuXG4gIFwiQVJSQVlcIjoge3J1bGVzOltcbiAgICBcIm9wZW5fYnJhIGM6Q09NTUFfU0VQQVJBVEVEX0VYUFI/IGNsb3NlX2JyYVwiLFxuICAgIFwib3Blbl9icmEgaW5kZW50IGM6Q09NTUFfU0VQQVJBVEVEX0VYUFI/IGRlZGVudCBzYW1lZGVudCBjbG9zZV9icmFcIixcbiAgICBcIm9wZW5fYnJhIGluZGVudCBjOkNPTU1BX1NFUEFSQVRFRF9FWFBSPyBjbG9zZV9icmEgZGVkZW50XCIsXG4gIF19LFxuXG4gIFwiTUVNQkVSU1wiOiB7cnVsZXM6W1xuICAgIFwibmFtZSBjb2xvbiBXIEVYUFIgY29tbWEgQU5ZX1NQQUNFKyBNRU1CRVJTXCIsXG4gICAgXCJuYW1lIGNvbG9uIFcgRVhQUlwiXG4gIF19LFxuXG4gIFwiT0JKRUNUXCI6IHtydWxlczpbXG4gICAgXCJvcGVuX2N1cmx5IE1FTUJFUlM/IGNsb3NlX2N1cmx5XCIsXG4gICAgXCJvcGVuX2N1cmx5IGluZGVudCBNRU1CRVJTPyBkZWRlbnQgc2FtZWRlbnQgY2xvc2VfY3VybHlcIixcbiAgICBcIm9wZW5fY3VybHkgaW5kZW50IE1FTUJFUlM/IGNsb3NlX2N1cmx5IGRlZGVudFwiLFxuICBdfSxcblxuICBcIlRBR19QQVJBTVNcIjoge3J1bGVzOltcbiAgICAgIFwibGVmdDpUQUdfUEFSQU1TIFcgcmlnaHQ6VEFHX1BBUkFNU1wiLFxuICAgICAgXCJuOm5hbWUgYXNzaWduIGU6RVhQUlwiLFxuICAgICAgXCJuOm5hbWVcIixcbiAgICBdLFxuICAgIGhvb2tzOltcbiAgICAgIGZ1bmN0aW9uKHApeyByZXR1cm4ge2xlZnQ6cC5sZWZ0LCByaWdodDpwLnJpZ2h0fTt9LFxuICAgICAgZnVuY3Rpb24ocCl7IHJldHVybiB7bjpwLm4sIGU6cC5lfTt9LFxuICAgICAgZnVuY3Rpb24ocCl7IHJldHVybiB7bjpwLm59O30sXG4gICAgXSxcbiAgICB2ZXJib3NlOlwidGFnIHBhcmFtZXRlcnNcIlxuICB9LFxuXG4gIFwiVEFHXCI6IHtydWxlczpbXG4gICAgXCJ0YWc6dGFnIFc/IHRwOlRBR19QQVJBTVM/IGVuZDo+PyBiOkJMT0NLP1wiLFxuICBdLFxuICBob29rczpbXG4gICAgZnVuY3Rpb24ocCl7XG4gICAgICByZXR1cm4ge3RhZzpwLnRhZywgcGFyYW1zOnAudHAsIGJsb2NrOnAuYn07XG4gICAgfV1cbiAgfSxcblxuICBcIkRPTV9BU1NJR05cIjoge3J1bGVzOltcbiAgICBcImFzc2lnbiBFWFBSXCIsXG4gIF19LFxuXG4gIFwiVFJZX0NBVENIXCI6IHtcbiAgICBydWxlczpbXG4gICAgICBcInRyeSBiMTpCTE9DSyBzYW1lZGVudD8gY2F0Y2ggb3Blbl9wYXIgZXJyOm5hbWU/IGNsb3NlX3BhciBiMjpCTE9DS1wiLFxuICAgIF0sXG4gICAgaG9va3M6W2Z1bmN0aW9uKHApeyByZXR1cm4gcDsgfV0sXG4gIH0sXG4gIFwiVEhST1dcIjoge3J1bGVzOltcbiAgICBcInRocm93IEVYUFJcIixcbiAgXX0sXG5cbiAgXCJSRVRVUk5cIjoge3J1bGVzOltcInJldCBXIEVYUFJcIiwgXCJyZXRcIl19LFxuICBcIlJJR0hUX0VYUFJcIjoge3J1bGVzOiBbXG4gICAgXCJtYXRoX29wZXJhdG9yc1wiLFxuICAgIFwiVyBiaW5hcnlfb3BlcmF0b3JzIFcgRVhQUlwiLFxuICAgIFwiVyBjb21wYXJpc29uIFcgRVhQUlwiLFxuICAgIFwiVyA+IFcgRVhQUlwiLFxuICAgIFwiZG90IEVYUFJcIixcbiAgICBcIm9wZW5fYnJhIEVYUFIgY2xvc2VfYnJhXCIsXG4gICAgXCJGVU5DX0NBTExcIlxuICAgIF0sXG4gICAgdmVyYm9zZTpcImV4cHJlc3Npb25cIlxuICB9LFxuICBcIkVYUFJcIjoge3J1bGVzOiBbXG4gICAgXCJNQVRIXCIsXG4gICAgXCJPQkpFQ1RcIixcbiAgICBcIkZVTkNfREVGXCIsXG4gICAgXCJFWFBSIFJJR0hUX0VYUFJcIixcbiAgICAvL1wiRlVOQ19DQUxMXCIsXG4gICAgXCJMQU1CREFcIixcbiAgICBcIm51bWJlclwiLFxuICAgIFwicmVnZXhwXCIsXG4gICAgXCJvcGVuX3BhciBFWFBSIGNsb3NlX3BhclwiLFxuICAgIFwic3RyaW5nXCIsXG4gICAgXCJuYW1lXCIsXG4gICAgXCJQQVRIXCIsXG4gICAgXCJBUlJBWVwiXSxcbiAgICB2ZXJib3NlOlwiZXhwcmVzc2lvblwiXG4gIH0sXG59O1xuXG5mdW5jdGlvbiBzcGFjZXIobikge1xuICB2YXIgb3V0ID0gXCJcIjtcbiAgZm9yKHZhciBpPTA7IGk8bjsgaSsrKSB7XG4gICAgb3V0ICs9IFwiIFwiO1xuICB9XG4gIHJldHVybiBvdXQ7XG59XG5cbmZ1bmN0aW9uIHNwKG1vZCkge1xuICBpZihtb2QpIHtcbiAgICByZXR1cm4gc3BhY2VyKDIgKiAoZGVwdGgrbW9kKSk7XG4gIH1cbiAgcmV0dXJuIHNwYWNlcigyICogZGVwdGgpO1xufVxuXG52YXIgbmMgPSAxO1xuLy8gY2hpbGRyZW4gbmFtZVxuZnVuY3Rpb24gQ04oKSB7XG4gIHJldHVybiAnX19jJyArIG5jO1xufVxuZnVuY3Rpb24gcHVzaENOKCkge1xuICBuYysrO1xuICByZXR1cm4gJ19fYycgKyBuYztcbn1cbmZ1bmN0aW9uIHBvcENOKCkge1xuICBuYy0tO1xuICByZXR1cm4gJ19fYycgKyBuYztcbn1cblxudmFyIGJhY2tlbmQgPSB7XG5cbiAgJ2RlZGVudCc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBkZXB0aCA9IE1hdGgubWF4KDAsIGRlcHRoIC0gMSk7XG4gICAgcmV0dXJuICcnO1xuICB9LFxuICAnaW5kZW50JzogZnVuY3Rpb24obm9kZSkge1xuICAgIGRlcHRoID0gZGVwdGggKyAxO1xuICAgIHJldHVybiAnXFxuJytzcCgpO1xuICB9LFxuICAnc2FtZWRlbnQnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgcmV0dXJuICdcXG4nK3NwKCk7XG4gIH0sXG4gICdET01fQVNTSUdOJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBuYW1lID0gQ04oKTtcbiAgICByZXR1cm4gbmFtZSsnLnB1c2goU3RyaW5nKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblsxXSkgKyAnKSknO1xuICB9LFxuICAnVEFHX1BBUkFNUyc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBpZihub2RlLmNoaWxkcmVuLmxlZnQpIHtcbiAgICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5sZWZ0KSArICcsICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5yaWdodCk7XG4gICAgfVxuICAgIGlmKG5vZGUuY2hpbGRyZW4uZSkge1xuICAgICAgcmV0dXJuIG5vZGUuY2hpbGRyZW4ubi52YWx1ZSArICc6JyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbm9kZS5jaGlsZHJlbi5uLnZhbHVlICsgJzogdHJ1ZSc7XG4gICAgfVxuICB9LFxuICAnVEFHJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBzdHIgPSAnJywgaSwgcGFyYW1zID0gXCJ7XCI7XG4gICAgdmFyIG5hbWUgPSBub2RlLmNoaWxkcmVuLnRhZy52YWx1ZS5zdWJzdHJpbmcoMSk7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5wYXJhbXMpIHtcbiAgICAgIHBhcmFtcyArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMpO1xuICAgIH1cbiAgICBwYXJhbXMgKz0gJ30nO1xuICAgIHZhciBzdWIgPSAnW10nO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uYmxvY2spIHtcbiAgICAgIHN1YiA9IHB1c2hDTigpO1xuICAgICAgc3RyICs9ICd2YXIgJyArIENOKCkgKyAnID0gW107JztcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5ibG9jayk7XG4gICAgICBwb3BDTigpO1xuICAgIH1cbiAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArIENOKCkgKyAnLnB1c2goaChcIicrbmFtZSsnXCIsICcrcGFyYW1zKycsICcrc3ViKycpKSc7XG4gICAgcmV0dXJuIHN0cjtcbiAgfSxcbiAgJ0NMQVNTJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBuYW1lID0gbm9kZS5jaGlsZHJlbi5uYW1lLnZhbHVlLCBpO1xuICAgIHZhciBmdW5jcyA9IG5vZGUuY2hpbGRyZW4ubWV0aG9kcztcbiAgICB2YXIgcGFyZW50ID0gbm9kZS5jaGlsZHJlbi5wYXJlbnQ7XG4gICAgdmFyIHN0ciA9ICcnO1xuICAgIHZhciBjb25zdHJ1Y3RvciA9IG51bGw7XG4gICAgZm9yKGk9MDtpPGZ1bmNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgZnVuY19kZWYgPSBmdW5jc1tpXS5jaGlsZHJlbjtcbiAgICAgIHZhciBmdW5jX25hbWUgPSBmdW5jX2RlZi5jaGlsZHJlbi5mbi52YWx1ZTtcbiAgICAgIGlmKGZ1bmNfbmFtZSA9PT0gJ2NvbnN0cnVjdG9yJykge1xuICAgICAgICBjb25zdHJ1Y3RvciA9IGZ1bmNfZGVmO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyICs9ICdcXG4nICsgc3AoKSArIG5hbWUgKyAnLnByb3RvdHlwZS4nICsgZnVuY19uYW1lICsgJyA9ICcgKyBnZW5lcmF0ZUNvZGUoZnVuY19kZWYpO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBuc1tuYW1lXSA9IHRydWU7XG4gICAgbnMgPSBuZXdOcygpO1xuXG4gICAgdmFyIHBhcmFtcyA9IGNvbnN0cnVjdG9yICYmIGNvbnN0cnVjdG9yLmNoaWxkcmVuLnBhcmFtcztcbiAgICBpZihwYXJhbXMpIHtcbiAgICAgIHBhcmFtcyA9IGdlbmVyYXRlQ29kZShwYXJhbXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJhbXMgPSAnJztcbiAgICB9XG4gICAgdmFyIGJvZHkgPSBjb25zdHJ1Y3RvciAmJiBjb25zdHJ1Y3Rvci5jaGlsZHJlbi5ibG9jaztcbiAgICB2YXIgY29uc19zdHIgPSAndmFyICcgKyBuYW1lICsgJyA9IGZ1bmN0aW9uICcgKyBuYW1lICsgJygnKyBwYXJhbXMgKyAnKSB7JztcbiAgICBjb25zX3N0ciArPSAnXFxuJytzcCgxKSsnaWYoISh0aGlzIGluc3RhbmNlb2YgJytuYW1lKycpKXsgcmV0dXJuIG5ldyAnK25hbWUrJygnK09iamVjdC5rZXlzKG5zKS5qb2luKCcsJykrJyk7fSc7XG4gICAgZm9yKHZhciBrZXkgaW4gbnMpIHtcbiAgICAgIGlmKG5zW2tleV0gIT09IHRydWUgJiYgbnNba2V5XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnNfc3RyICs9ICdcXG4nK3NwKDEpKydpZignK2tleSsnID09PSB1bmRlZmluZWQpIHsnK2tleSsnID0gJytnZW5lcmF0ZUNvZGUobnNba2V5XSkrJ307JztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYoYm9keSkge1xuICAgICAgY29uc19zdHIgKz0gZ2VuZXJhdGVDb2RlKGJvZHkpO1xuICAgIH1cbiAgICBjb25zX3N0ciArPSBzcCgpICsgJ1xcbn0nO1xuXG4gICAgaWYocGFyZW50KSB7XG4gICAgICBjb25zX3N0ciArPSAnXFxuJytzcCgpICsgbmFtZSArICcucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSgnICsgcGFyZW50LnZhbHVlICsgJy5wcm90b3R5cGUpOyc7XG4gICAgICBjb25zX3N0ciArPSAnXFxuJytzcCgpICsgbmFtZSArICcucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gJytuYW1lKycnO1xuICAgICAgLy9jb25zX3N0ciArPSAnXFxuJytzcCgpICsgbmFtZSArICcucHJvdG90eXBlLnN1cGVyID0gZnVuY3Rpb24oKXsnICsgcGFyZW50LnZhbHVlICsgJy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO30nO1xuICAgIH1cblxuICAgIG5hbWVzcGFjZXMucG9wKCk7XG4gICAgcmV0dXJuIGNvbnNfc3RyICsgc3RyO1xuICB9LFxuICAnRlVOQ19ERUYnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG5hbWUgPSBcIlwiO1xuICAgIHZhciBucyA9IGN1cnJlbnROcygpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uZm4pIHtcbiAgICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuLmZuLnZhbHVlO1xuICAgICAgbnNbbmFtZV0gPSB0cnVlO1xuICAgIH1cbiAgICBucyA9IG5ld05zKCk7XG4gICAgdmFyIHN0ciA9IFwiZnVuY3Rpb24gXCIgKyBuYW1lICsgXCIoXCI7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5wYXJhbXMpIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMpO1xuICAgIH1cbiAgICBzdHIgKz0gJykgeyc7XG4gICAgZm9yKHZhciBrZXkgaW4gbnMpIHtcbiAgICAgIGlmKG5zW2tleV0gIT09IHRydWUgJiYgbnNba2V5XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHN0ciArPSAnXFxuJytzcCgxKSsnaWYoJytrZXkrJyA9PT0gdW5kZWZpbmVkKSB7JytrZXkrJyA9ICcrZ2VuZXJhdGVDb2RlKG5zW2tleV0pKyd9Oyc7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKG5vZGUuY2hpbGRyZW4uZGVmLnZhbHVlID09PSAnZG9tJykge1xuICAgICAgc3RyICs9ICdcXG4nK3NwKDEpICsgJ3ZhciAnICsgQ04oKSArICcgPSBbXTsnO1xuICAgIH1cblxuICAgIGlmKG5vZGUuY2hpbGRyZW4uYmxvY2spIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5ibG9jayk7XG4gICAgfVxuICAgIG5hbWVzcGFjZXMucG9wKCk7XG5cbiAgICBpZihub2RlLmNoaWxkcmVuLmRlZi52YWx1ZSA9PT0gJ2RvbScpIHtcbiAgICAgIHN0ciArPSAnXFxuJytzcCgxKSArICdyZXR1cm4gJyArIENOKCkgKyAnOyc7XG4gICAgfVxuICAgIHJldHVybiBzdHIgKyAnXFxuJytzcCgpKyd9JztcbiAgfSxcbiAgJ0ZVTkNfREVGX1BBUkFNUyc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgc3RyID0gXCJcIiwgaTtcbiAgICB2YXIgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBpZihub2RlLmNoaWxkcmVuWzBdLnR5cGUgPT09ICduYW1lJykge1xuICAgICAgbnNbbm9kZS5jaGlsZHJlblswXS52YWx1ZV0gPSB0cnVlO1xuICAgICAgaWYobm9kZS5jaGlsZHJlblsxXSAmJiBub2RlLmNoaWxkcmVuWzFdLnR5cGUgPT09ICdhc3NpZ24nKSB7XG4gICAgICAgIG5zW25vZGUuY2hpbGRyZW5bMF0udmFsdWVdID0gbm9kZS5jaGlsZHJlblsyXTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yKGk9MDtpPG5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBuID0gbm9kZS5jaGlsZHJlbltpXTtcbiAgICAgIGlmKG4udHlwZSA9PT0gJ25hbWUnIHx8IG4udHlwZSA9PT0gJ0ZVTkNfREVGX1BBUkFNUycgfHwgbi50eXBlID09PSAnY29tbWEnIHx8IG4udHlwZSA9PT0gJ3dpbmRvdycpIHtcbiAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuW2ldKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHN0cjtcbiAgfSxcbiAgJ0xBTUJEQSc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgbmFtZSA9IFwiXCI7XG4gICAgdmFyIG5zID0gbmV3TnMoKTtcbiAgICBpZihub2RlLmNoaWxkcmVuLmZuKSB7XG4gICAgICBuYW1lID0gbm9kZS5jaGlsZHJlbi5mbi52YWx1ZTtcbiAgICB9XG4gICAgdmFyIHN0ciA9IFwiZnVuY3Rpb24gXCIgKyBuYW1lICsgXCIoXCI7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5wYXJhbXMpIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMsIG5zKTtcbiAgICB9XG4gICAgc3RyICs9ICcpIHsgcmV0dXJuICc7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrLCBucyk7XG4gICAgfVxuICAgIG5hbWVzcGFjZXMucG9wKCk7XG4gICAgcmV0dXJuIHN0ciArIFwiOyB9XCI7XG4gIH0sXG4gICdBU1NJR04nOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHByZWZpeCA9IFwiXCI7XG4gICAgdmFyIG9wID0gbm9kZS5jaGlsZHJlbi5vcC52YWx1ZTtcbiAgICB2YXIgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBpZihub2RlLmNoaWxkcmVuLmxlZnQuY2hpbGRyZW5bMF0udHlwZSA9PT0gJ25hbWUnKSB7XG4gICAgICB2YXIgY2ggPSBub2RlLmNoaWxkcmVuLmxlZnQuY2hpbGRyZW5bMF07XG4gICAgICBpZihuc1tjaC52YWx1ZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZihvcCA9PSAnOj0nKSB7XG4gICAgICAgICAgb3AgPSAnPSc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcHJlZml4ID0gJ3ZhciAnO1xuICAgICAgICB9XG4gICAgICAgIG5zW2NoLnZhbHVlXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBwcmVmaXgrZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ubGVmdCkgKyAnICcgKyBvcCArICcgJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnJpZ2h0KTtcbiAgfSxcbiAgJ1NUQVRFTUVOVCc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICByZXR1cm4gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bMF0pICsgJzsnO1xuICB9LFxuICAnSUYnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHN0ciA9ICcnO1xuICAgIHN0ciA9ICdpZignK2dlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzBdKSArICcpeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblsxXSkgKyAnXFxuJytzcCgpKyd9JztcbiAgICBpZihub2RlLmNoaWxkcmVuWzJdKSB7XG4gICAgICBpZihBcnJheS5pc0FycmF5KG5vZGUuY2hpbGRyZW5bMl0pKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbm9kZS5jaGlsZHJlblsyXS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblsyXVtpXSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblsyXSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKG5vZGUuY2hpbGRyZW5bM10pIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblszXSk7XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG4gIH0sXG4gICdGT1InOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIGtleUluZGV4TmFtZSA9IFwiX2luZGV4XCIgKyBmb3JMb29wQ291bnQ7XG4gICAgdmFyIGtleUFycmF5TmFtZSA9IFwiX2tleXNcIiArIGZvckxvb3BDb3VudDtcbiAgICBmb3JMb29wQ291bnQrKztcbiAgICB2YXIgaW5kZXhOYW1lID0gZmFsc2U7XG4gICAgaWYobm9kZS5jaGlsZHJlblswXSkge1xuICAgICAgaW5kZXhOYW1lID0gbm9kZS5jaGlsZHJlblswXS52YWx1ZTtcbiAgICB9XG4gICAgdmFyIHN0ciA9ICd2YXIgJytrZXlBcnJheU5hbWUrJyA9IE9iamVjdC5rZXlzKCcrbm9kZS5jaGlsZHJlblsyXS52YWx1ZSsnKTtcXG4nO1xuICAgIHN0ciArPSBzcCgpICsgJ2Zvcih2YXIgJytrZXlJbmRleE5hbWUrJyA9IDA7ICcra2V5SW5kZXhOYW1lKycgPCAnK2tleUFycmF5TmFtZSsnLmxlbmd0aDsgJytrZXlJbmRleE5hbWUrJysrICkge1xcbic7XG4gICAgaWYoaW5kZXhOYW1lKSB7XG4gICAgICBzdHIgKz0gc3AoMSkgKyAndmFyICcgKyBpbmRleE5hbWUgKyAnID0gJyArIGtleUFycmF5TmFtZSArJ1snICsga2V5SW5kZXhOYW1lICsgJ107XFxuJztcbiAgICB9XG4gICAgc3RyICs9IHNwKDEpICsgJ3ZhciAnICsgbm9kZS5jaGlsZHJlblsxXS52YWx1ZSArICcgPSAnICsgbm9kZS5jaGlsZHJlblsyXS52YWx1ZSArICdbJyArIGtleUFycmF5TmFtZSArJ1snICsga2V5SW5kZXhOYW1lICsgJ11dOyc7XG4gICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzNdKSArJ1xcbicrc3AoKSsnfSc7XG4gICAgcmV0dXJuIHN0cjtcbiAgfSxcbiAgJ0VMU0VfSUYnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgcmV0dXJuICcgZWxzZSBpZignK2dlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzBdKSsnKSB7JytnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblsxXSkrICdcXG4nK3NwKCkrJ30nO1xuICB9LFxuICAnRUxTRSc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICByZXR1cm4gJyBlbHNlIHsnK2dlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzBdKSsgJ1xcbicrc3AoKSsnfSc7XG4gIH0sXG4gICdUUllfQ0FUQ0gnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHN0ciA9IFwidHJ5IHtcIjtcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYjEpO1xuICAgIHN0ciArPSAnXFxuJytzcCgpK1wifSBjYXRjaChcIitnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lcnIpK1wiKSB7XCI7XG4gICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIyKTtcbiAgICByZXR1cm4gc3RyKydcXG4nK3NwKCkrXCJ9XCI7XG4gIH0sXG4gICdzdHJpbmcnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHYgPSBub2RlLnZhbHVlO1xuICAgIHYgPSB2LnJlcGxhY2UoL1xcbi9nLCBcIlxcXFxuXCIpO1xuICAgIHZhciBhc3QgPSBzdHJHcmFtLnBhcnNlKHYpO1xuICAgIGlmKCFhc3QuY29tcGxldGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihhc3QuaGludCk7XG4gICAgfVxuICAgIHJldHVybiBnZW5lcmF0ZVN0cmluZ0NvZGUoYXN0KTtcbiAgfSxcbiAgJ2NvbW1lbnQnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgcmV0dXJuIG5vZGUudmFsdWUucmVwbGFjZSgvXiMvZywgXCIvL1wiKTtcbiAgfSxcbiAgJ2NvbXBhcmlzb24nOiBmdW5jdGlvbihub2RlKSB7XG4gICAgaWYobm9kZS52YWx1ZSA9PSAnPT0nKSB7XG4gICAgICByZXR1cm4gJz09PSc7XG4gICAgfVxuICAgIGlmKG5vZGUudmFsdWUgPT0gJyE9Jykge1xuICAgICAgcmV0dXJuICchPT0nO1xuICAgIH1cbiAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgfVxufTtcblxuZnVuY3Rpb24gZ2VuZXJhdGVDb2RlKG5vZGUsIG5zKSB7XG4gIGlmKCFub2RlKSB7XG4gICAgLy9kZWJ1Z2dlclxuICB9XG4gIGlmKGJhY2tlbmRbbm9kZS50eXBlXSkge1xuICAgIHJldHVybiBiYWNrZW5kW25vZGUudHlwZV0obm9kZSk7XG4gIH1cbiAgaWYobm9kZS52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG5vZGUudmFsdWU7XG4gIH1cbiAgdmFyIHN0ciA9IFwiXCIsIGk7XG4gIGlmKCFub2RlLmNoaWxkcmVuKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG4gIGZvcihpPTA7aTxub2RlLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuW2ldLCBucyk7XG4gIH1cbiAgcmV0dXJuIHN0cjtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVFeHBvcnRzKGtleXMpIHtcbiAgdmFyIHN0ciA9ICdcXG5tb2R1bGUuZXhwb3J0cyA9IHsnO1xuICBrZXlzID0ga2V5cyB8fCBPYmplY3Qua2V5cyhjdXJyZW50TnMoKSk7XG4gIGZvcih2YXIgaT0wOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgIHN0ciArPSAnXFxuICAnICsga2V5c1tpXSArICc6ICcgKyBrZXlzW2ldICsgJywnO1xuICB9XG4gIHJldHVybiBzdHIgKyAnXFxufSc7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlTW9kdWxlKGlucHV0LCBvcHRzKSB7XG4gIHJlc2V0R2xvYmFsKCk7XG4gIHZhciBhc3QgPSBncmFtLnBhcnNlKGlucHV0ICsgXCJcXG5cIik7XG4gIGlmKCFhc3QuY29tcGxldGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYXN0LmhpbnQpO1xuICB9XG4gIHZhciBvYmogPSB7YXN0OmFzdCwgY29kZTpnZW5lcmF0ZUNvZGUoYXN0KSwgbnM6Y3VycmVudE5zKCl9O1xuICByZXR1cm4gb2JqO1xufVxuXG52YXIgZ3JhbSA9IGVwZWdqcy5jb21waWxlR3JhbW1hcihncmFtbWFyRGVmLCB0b2tlbkRlZik7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBncmFtbWFyOiBncmFtLFxuICBzdHJHcmFtbWFyOiBzdHJHcmFtLFxuICBncmFtbWFyRGVmOiBncmFtbWFyRGVmLFxuICBlcGVnanM6ZXBlZ2pzLFxuICB0b2tlbkRlZjogdG9rZW5EZWYsXG4gIGdlbmVyYXRlTW9kdWxlOiBnZW5lcmF0ZU1vZHVsZSxcbiAgZ2VuZXJhdGVDb2RlOiBnZW5lcmF0ZUNvZGUsXG4gIGdlbmVyYXRlRXhwb3J0czogZ2VuZXJhdGVFeHBvcnRzXG59O1xuXG4iXX0=
