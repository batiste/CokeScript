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

var strInterpolationTokenDef = [
  {key:"start", reg:/^#{/},
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
    var m = input.match(/^\n[ ]*/);
    if(m) {
      var indent = m[0].length - 1;
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
  if(input.indexOf("dom ") === 0) {
    return "dom";
  }
}

function commentDef(input) {
  var m = input.match(/^\/\//) || input.match(/^#/);
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
  return [params.fn, params.p, params.b];
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
  "LINE": {rules:["STATEMENT samedent+", "STATEMENT !dedent", "comment? samedent"], verbose:"new line"},
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
    ],
    hooks: [lambda_def, lambda_def]
  },
  "FUNC_DEF": {rules:[
      "fd:function_def open_par p:FUNC_DEF_PARAMS? close_par b:BLOCK",
      "fd:function_def W fn:name open_par p:FUNC_DEF_PARAMS? close_par b:BLOCK",
    ],
    hooks: [f_def, f_def],
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
  "FUNC_CALL_PARAMS": {rules:["FUNC_CALL_PARAMS comma W_OR_SAMEDENT EXPR samedent?", "EXPR samedent?"]},
  "FUNC_CALL": {rules:["name open_par FUNC_CALL_PARAMS? close_par"]},

  "FOR": {rules:[
    "for_loop k:name comma W v:name W in a:name b:BLOCK",
    "for_loop v:name W in a:name b:BLOCK"],
    hooks: [forLoop, forLoop]
  },

  "COMMA_SEPARATED_EXPR": {rules:[
    "EXPR comma W_OR_SAMEDENT COMMA_SEPARATED_EXPR",
    "EXPR"
  ]},

  "ARRAY": {rules:[
    "open_bra c:COMMA_SEPARATED_EXPR? close_bra",
    "open_bra indent c:COMMA_SEPARATED_EXPR? dedent samedent close_bra",
  ]},

  "MEMBERS": {rules:[
    "name colon W EXPR comma W_OR_SAMEDENT? MEMBERS",
    "name colon W EXPR"
  ]},

  "OBJECT": {rules:[
    "open_curly MEMBERS? close_curly",
    "open_curly indent MEMBERS? dedent samedent close_curly",
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
    ],
    verbose:"expression"
  },
  "EXPR": {rules: [
    "MATH",
    "OBJECT",
    "EXPR RIGHT_EXPR",
    "FUNC_CALL",
    "FUNC_DEF",
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
    if(node.children[0]) {
      name = node.children[0].value;
    }
    var str = "function " + name + "(";
    if(node.children[1]) {
      str += generateCode(node.children[1], ns);
    }
    str += ') { return ';
    if(node.children[2]) {
      str += generateCode(node.children[2], ns);
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
    var keyIndexName = "_index"+forLoopCount;
    var keyArrayName = "_keys"+forLoopCount;
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
        match = token.func(input);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb2tlc2NyaXB0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QURwckJBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKlxuICBDb2tlU2NyaXB0IGxhbmd1YWdlIGJ5IEJhdGlzdGUgQmllbGVyIDIwMTVcbiAgSW1wbGVtZW50ZWQgdXNpbmcgRVBFRy5KU1xuKi9cblwidXNlIHN0cmljdFwiO1xuXG52YXIgZXBlZ2pzID0gcmVxdWlyZShcImVwZWdqc1wiKTtcblxudmFyIGRlcHRoID0gMDtcbnZhciBmb3JMb29wQ291bnQgPSAxO1xudmFyIG5hbWVzcGFjZXMgPSBbe31dO1xudmFyIGxldmVsU3RhY2sgPSBbMF07XG5cbmZ1bmN0aW9uIGN1cnJlbnROcygpIHtcbiAgcmV0dXJuIG5hbWVzcGFjZXNbbmFtZXNwYWNlcy5sZW5ndGggLTFdO1xufVxuXG5mdW5jdGlvbiBuZXdOcygpIHtcbiAgbmFtZXNwYWNlcy5wdXNoKHt9KTtcbiAgcmV0dXJuIG5hbWVzcGFjZXNbbmFtZXNwYWNlcy5sZW5ndGggLTFdO1xufVxuXG5mdW5jdGlvbiByZXNldEdsb2JhbCgpIHtcbiAgbmFtZXNwYWNlcyA9IFt7fV07XG4gIGZvckxvb3BDb3VudCA9IDE7XG4gIGxldmVsU3RhY2sgPSBbMF07XG4gIGRlcHRoID0gMDtcbn1cblxuLy8gdG9rZW4gYXJlIG1hdGNoZWQgaW4gb3JkZXIgb2YgZGVjbGFyYXRpb25cbi8vIFRPRE86IGFkZCBmdW5jdGlvbnNcbnZhciB0b2tlbkRlZiA9IFtcbiAge2tleTpcInN0cmluZ1wiLCBmdW5jOnN0cmluZ0RlZn0sXG4gIHtrZXk6XCJjb21tZW50XCIsIGZ1bmM6Y29tbWVudERlZn0sXG4gIHtrZXk6XCJmdW5jdGlvbl9kZWZcIiwgZnVuYzogZGVmRGVmLCB2ZXJib3NlOlwiZnVuY3Rpb24gZGVmaW5pdGlvblwifSxcbiAge2tleTpcImNsYXNzXCIsIHJlZzovXmNsYXNzIC99LFxuICB7a2V5OlwicmV0XCIsIHJlZzovXnJldHVybi8sIHZlcmJvc2U6XCJyZXR1cm5cIn0sXG4gIHtrZXk6XCJpZlwiLCByZWc6L15pZiAvfSxcbiAge2tleTpcInRyeVwiLCByZWc6L150cnkvfSxcbiAge2tleTpcImNhdGNoXCIsIHJlZzovXmNhdGNoL30sXG4gIHtrZXk6XCJ0aHJvd1wiLCByZWc6L150aHJvdyAvfSxcbiAge2tleTpcInRhZ1wiLCByZWc6L148W2EtekEtWl8kXVswLTlhLXpBLVpfXXswLDI5fS99LFxuICB7a2V5OlwiPlwiLCByZWc6L14+L30sXG4gIHtrZXk6XCJlbHNlaWZcIiwgcmVnOi9eZWxzZWlmIC99LFxuICB7a2V5OlwiZWxzZVwiLCByZWc6L15lbHNlL30sXG4gIHtrZXk6XCJmb3JfbG9vcFwiLCByZWc6L15mb3IgLywgdmVyYm9zZTpcImZvciBsb29wXCJ9LFxuICB7a2V5OlwiaW5cIiwgcmVnOi9eaW4gL30sXG4gIHtrZXk6XCJuYW1lXCIsIHJlZzovXlthLXpBLVpfJF1bMC05YS16QS1aX117MCwyOX0vfSwgLy8gMzAgY2hhcnMgbWF4XG4gIHtrZXk6XCJyZWdleHBcIiwgZnVuYzpyZWdFeHBEZWYsIHZlcmJvc2U6XCJyZWd1bGFyIGVwcmVzc2lvblwifSxcbiAge2tleTpcIm1hdGhfb3BlcmF0b3JzXCIsIHJlZzovXihcXCtcXCt8XFwtXFwtKS8sIHZlcmJvc2U6XCJtYXRoIG9wZXJhdG9yXCJ9LFxuICB7a2V5OlwiYmluYXJ5X29wZXJhdG9yc1wiLCByZWc6L14oXFwmXFwmfFxcfFxcfHxcXCZ8XFx8fDw8fFxcPlxcPikvLCB2ZXJib3NlOlwiYmluYXJ5IG9wZXJhdG9yXCJ9LFxuICB7a2V5OlwiY29tcGFyaXNvblwiLCByZWc6L14oPD18Pj18PHw+fCE9fD09KS99LFxuICB7a2V5OlwiYXNzaWduXCIsIHJlZzovXihcXCs9fC09fD18Oj0pL30sXG4gIHtrZXk6XCJudW1iZXJcIiwgcmVnOi9eWzAtOV0rXFwuP1swLTldKi99LCAvLyBvbmx5IHBvc2l0aXZlIGZvciBub3dcbiAge2tleTpcImNvbW1hXCIsIHJlZzovXlxcLC99LFxuICB7a2V5OlwiZG90XCIsIHJlZzovXlxcLi99LFxuICB7a2V5OlwiY29sb25cIiwgcmVnOi9eXFw6LywgdmVyYm9zZTpcIjpcIn0sXG4gIHtrZXk6XCJvcGVuX3BhclwiLCByZWc6L15cXCgvLCB2ZXJib3NlOlwiKFwifSxcbiAge2tleTpcImNsb3NlX3BhclwiLCByZWc6L15cXCkvLCB2ZXJib3NlOlwiKVwifSxcbiAge2tleTpcIm9wZW5fYnJhXCIsIHJlZzovXlxcWy8sIHZlcmJvc2U6XCJbXCJ9LFxuICB7a2V5OlwiY2xvc2VfYnJhXCIsIHJlZzovXlxcXS8sIHZlcmJvc2U6XCJdXCJ9LFxuICB7a2V5Olwib3Blbl9jdXJseVwiLCByZWc6L15cXHsvLCB2ZXJib3NlOlwie1wifSxcbiAge2tleTpcImNsb3NlX2N1cmx5XCIsIHJlZzovXlxcfS8sIHZlcmJvc2U6XCJ9XCJ9LFxuICB7a2V5OlwibWF0aFwiLCByZWc6L15bLXxcXCt8XFwqfC98JV0vfSxcbiAge2tleTpcInNhbWVkZW50XCIsIGZ1bmM6ZGVudCgnc2FtZWRlbnQnKSwgdmVyYm9zZTpcInNhbWUgaW5kZW50YXRpb25cIn0sXG4gIHtrZXk6XCJkZWRlbnRcIiwgZnVuYzpkZW50KCdkZWRlbnQnKX0sXG4gIHtrZXk6XCJpbmRlbnRcIiwgZnVuYzpkZW50KCdpbmRlbnQnKX0sXG4gIC8vbmV3bGluZTogL14oXFxyP1xcbnwkKS8sXG4gIHtrZXk6XCJXXCIsIHJlZzovXlsgXS8sIHZlcmJvc2U6XCJzaW5nbGUgd2hpdGVzcGFjZVwifSxcbl07XG5cbnZhciBzdHJJbnRlcnBvbGF0aW9uVG9rZW5EZWYgPSBbXG4gIHtrZXk6XCJzdGFydFwiLCByZWc6L14jey99LFxuICB7a2V5OlwiZW5kXCIsIHJlZzovXn0vfSxcbiAge2tleTpcIm5hbWVcIiwgcmVnOi9eW2EtekEtWl8kXVswLTlhLXpBLVpfXXswLDI5fS99LFxuICB7a2V5OlwiZG90XCIsIHJlZzovXlxcLi99LFxuICB7a2V5OlwiY2hhclwiLCByZWc6L14uL30sXG5dO1xuXG52YXIgc3RySW50ZXJwb2xhdGlvbkdyYW1tYXJEZWYgPSB7XG4gIFwiU1RBUlRcIjoge3J1bGVzOltcIkVMKiBFT0ZcIl19LFxuICBcIkVMXCI6IHtydWxlczpbXCJWQVJcIiwgXCJjaGFyXCIsIFwibmFtZVwiLCBcInN0YXJ0XCIsIFwiZW5kXCIsIFwiZG90XCJdfSxcbiAgXCJWQVJcIjoge3J1bGVzOltcInN0YXJ0IE5BTUUgZW5kXCJdfSxcbiAgXCJOQU1FXCI6IHtydWxlczpbXCJuYW1lIGRvdCBOQU1FXCIsIFwibmFtZVwiXX0sXG59O1xuXG52YXIgc3RyR3JhbSA9IGVwZWdqcy5jb21waWxlR3JhbW1hcihzdHJJbnRlcnBvbGF0aW9uR3JhbW1hckRlZiwgc3RySW50ZXJwb2xhdGlvblRva2VuRGVmKTtcblxuZnVuY3Rpb24gZ2VuZXJhdGVTdHJpbmdDb2RlKG5vZGUpIHtcbiAgaWYobm9kZS50eXBlID09PSAnVkFSJykge1xuICAgIHJldHVybiAnXCIgKyAnICsgZ2VuZXJhdGVTdHJpbmdDb2RlKG5vZGUuY2hpbGRyZW5bMV0pICsgJyArIFwiJztcbiAgfVxuICBpZihub2RlLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgfVxuICB2YXIgc3RyID0gXCJcIiwgaTtcbiAgaWYoIW5vZGUuY2hpbGRyZW4pIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgZm9yKGk9MDtpPG5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICBzdHIgKz0gZ2VuZXJhdGVTdHJpbmdDb2RlKG5vZGUuY2hpbGRyZW5baV0pO1xuICB9XG4gIHJldHVybiBzdHI7XG59XG5cbmZ1bmN0aW9uIGN1cnJlbnRMZXZlbCgpIHtcbiAgcmV0dXJuIGxldmVsU3RhY2tbbGV2ZWxTdGFjay5sZW5ndGggLSAxXTtcbn1cblxuZnVuY3Rpb24gaW5kZW50VHlwZShsKSB7XG4gIGlmKGwgPiBjdXJyZW50TGV2ZWwoKSkge1xuICAgIHJldHVybiAnaW5kZW50JztcbiAgfVxuICBpZihsIDwgY3VycmVudExldmVsKCkpIHtcbiAgICByZXR1cm4gJ2RlZGVudCc7XG4gIH1cbiAgaWYobCA9PT0gY3VycmVudExldmVsKCkpIHtcbiAgICByZXR1cm4gJ3NhbWVkZW50JztcbiAgfVxufVxuXG5mdW5jdGlvbiBkZW50KGRlbnRUeXBlKSB7XG4gIHJldHVybiBmdW5jdGlvbiBfZGVudChpbnB1dCkge1xuICAgIHZhciBtID0gaW5wdXQubWF0Y2goL15cXG5bIF0qLyk7XG4gICAgaWYobSkge1xuICAgICAgdmFyIGluZGVudCA9IG1bMF0ubGVuZ3RoIC0gMTtcbiAgICAgIGlmKGluZGVudFR5cGUoaW5kZW50KSA9PT0gZGVudFR5cGUpIHtcbiAgICAgICAgaWYoZGVudFR5cGUgPT0gJ2RlZGVudCcpIHtcbiAgICAgICAgICBsZXZlbFN0YWNrLnBvcCgpO1xuICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfVxuICAgICAgICBpZihkZW50VHlwZSA9PSAnaW5kZW50Jykge1xuICAgICAgICAgIGxldmVsU3RhY2sucHVzaChpbmRlbnQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtWzBdO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gc3RyaW5nRGVmKGlucHV0KSB7XG4gIGlmKGlucHV0LmNoYXJBdCgwKSA9PT0gJ1wiJykge1xuICAgIHZhciBpID0gMTtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpIHtcbiAgICAgIHZhciBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxcXCcpIHtcbiAgICAgICAgaSsrO1xuICAgICAgfSBlbHNlIGlmKGNoID09PSAnXCInKSB7XG4gICAgICAgIHJldHVybiBpbnB1dC5zbGljZSgwLCBpKzEpO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiByZWdFeHBEZWYoaW5wdXQpIHtcbiAgaWYoaW5wdXQuY2hhckF0KDApID09PSAnLycpIHtcbiAgICB2YXIgaSA9IDE7XG4gICAgd2hpbGUoaW5wdXQuY2hhckF0KGkpKSB7XG4gICAgICB2YXIgY2ggPSBpbnB1dC5jaGFyQXQoaSk7XG4gICAgICBpZihjaCA9PT0gJ1xcXFwnKSB7XG4gICAgICAgIGkrKztcbiAgICAgIH0gZWxzZSBpZihjaCA9PT0gJy8nKSB7XG4gICAgICAgIHJldHVybiBpbnB1dC5zbGljZSgwLCBpKzEpO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBkZWZEZWYoaW5wdXQpIHtcbiAgaWYoaW5wdXQuaW5kZXhPZihcImRlZihcIikgPT09IDApIHtcbiAgICByZXR1cm4gXCJkZWZcIjtcbiAgfVxuICBpZihpbnB1dC5pbmRleE9mKFwiZGVmIFwiKSA9PT0gMCkge1xuICAgIHJldHVybiBcImRlZlwiO1xuICB9XG4gIGlmKGlucHV0LmluZGV4T2YoXCJkb20gXCIpID09PSAwKSB7XG4gICAgcmV0dXJuIFwiZG9tXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tbWVudERlZihpbnB1dCkge1xuICB2YXIgbSA9IGlucHV0Lm1hdGNoKC9eXFwvXFwvLykgfHwgaW5wdXQubWF0Y2goL14jLyk7XG4gIGlmKG0pIHtcbiAgICB2YXIgaSA9IG1bMF0ubGVuZ3RoO1xuICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSkge1xuICAgICAgdmFyIGNoID0gaW5wdXQuY2hhckF0KGkpO1xuICAgICAgaWYoY2ggPT09ICdcXG4nKSB7XG4gICAgICAgIHJldHVybiBpbnB1dC5zbGljZSgwLCBpKTtcbiAgICAgIH1cbiAgICAgIGkrKztcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZl9kZWYocGFyYW1zKSB7XG4gIHJldHVybiB7ZGVmOnBhcmFtcy5mZCwgZm46cGFyYW1zLmZuLCBwYXJhbXM6cGFyYW1zLnAsIGJsb2NrOnBhcmFtcy5ifTtcbn1cblxuZnVuY3Rpb24gbGFtYmRhX2RlZihwYXJhbXMpIHtcbiAgcmV0dXJuIFtwYXJhbXMuZm4sIHBhcmFtcy5wLCBwYXJhbXMuYl07XG59XG5cbmZ1bmN0aW9uIGVsc2VfZGVmKHBhcmFtcykge1xuICByZXR1cm4gW3BhcmFtcy5iXTtcbn1cblxuZnVuY3Rpb24gZWxzZV9pZl9kZWYocGFyYW1zKSB7XG4gIHJldHVybiBbcGFyYW1zLmUsIHBhcmFtcy5iXTtcbn1cblxuZnVuY3Rpb24gaWZfZGVmKHBhcmFtcykge1xuICByZXR1cm4gW3BhcmFtcy5lLCBwYXJhbXMuYiwgcGFyYW1zLmVsaWYsIHBhcmFtcy5lbF07XG59XG5cbmZ1bmN0aW9uIGZvckxvb3AocGFyYW1zKSB7XG4gIHJldHVybiBbcGFyYW1zLmssIHBhcmFtcy52LCBwYXJhbXMuYSwgcGFyYW1zLmJdO1xufVxuXG52YXIgZ3JhbW1hckRlZiA9IHtcbiAgXCJTVEFSVFwiOiB7cnVsZXM6W1wiTElORSogRU9GXCJdfSxcbiAgXCJMSU5FXCI6IHtydWxlczpbXCJTVEFURU1FTlQgc2FtZWRlbnQrXCIsIFwiU1RBVEVNRU5UICFkZWRlbnRcIiwgXCJjb21tZW50PyBzYW1lZGVudFwiXSwgdmVyYm9zZTpcIm5ldyBsaW5lXCJ9LFxuICBcIkJMT0NLXCI6IHtydWxlczogW1wiaW5kZW50IExJTkUrIGRlZGVudFwiXX0sXG4gIFwiU1RBVEVNRU5UXCI6IHtydWxlczpbXCJBU1NJR05cIiwgXCJJRlwiLCBcIkZPUlwiLCBcIkVYUFJcIiwgXCJSRVRVUk5cIiwgXCJDTEFTU1wiLCBcIlRBR1wiLCBcIkRPTV9BU1NJR05cIiwgXCJUUllfQ0FUQ0hcIiwgXCJUSFJPV1wiXX0sXG4gIFwiQ0xBU1NfTUVUSE9EU1wiOiB7XG4gICAgICBydWxlczogW1wic2FtZWRlbnQqIGY6RlVOQ19ERUYgc2FtZWRlbnQqXCJdLFxuICAgICAgaG9va3M6IFsgZnVuY3Rpb24ocCl7IHJldHVybiBwLmY7IH1dXG4gIH0sXG4gIFwiQ0xBU1NcIjoge1xuICAgIHJ1bGVzOiBbXG4gICAgICBcImNsYXNzIG46bmFtZSBvcGVuX3BhciBwOm5hbWUgY2xvc2VfcGFyIGluZGVudCBtOkNMQVNTX01FVEhPRFMrIGRlZGVudFwiLFxuICAgICAgXCJjbGFzcyBuOm5hbWUgaW5kZW50IG06Q0xBU1NfTUVUSE9EUysgZGVkZW50XCJcbiAgICBdLFxuICAgIGhvb2tzOiBbXG4gICAgICBmdW5jdGlvbihwKXsgcmV0dXJuIHtuYW1lOnAubiwgbWV0aG9kczpwLm0sIHBhcmVudDpwLnB9OyB9LFxuICAgICAgZnVuY3Rpb24ocCl7IHJldHVybiB7bmFtZTpwLm4sIG1ldGhvZHM6cC5tfTsgfVxuICAgIF1cbiAgfSxcbiAgXCJGVU5DX0RFRl9QQVJBTVNcIjoge3J1bGVzOltcbiAgICAgIFwicDE6RlVOQ19ERUZfUEFSQU1TIGNvbW1hIFcgcDI6RlVOQ19ERUZfUEFSQU1TXCIsXG4gICAgICBcInAxOm5hbWUgYXNzaWduIGU6RVhQUlwiLFxuICAgICAgXCJwMTpuYW1lXCIsXG4gICAgXSxcbiAgICB2ZXJib3NlOlwiZnVuY3Rpb24gcGFyYW1ldGVyc1wiXG4gIH0sXG4gIFwiTEFNQkRBXCI6IHtydWxlczpbXG4gICAgICBcImZ1bmN0aW9uX2RlZiBvcGVuX3BhciBwOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIFcgYjpFWFBSXCIsXG4gICAgICBcImZ1bmN0aW9uX2RlZiBXIGZuOm5hbWUgb3Blbl9wYXIgcDpGVU5DX0RFRl9QQVJBTVM/IGNsb3NlX3BhciBXIGI6RVhQUlwiLFxuICAgIF0sXG4gICAgaG9va3M6IFtsYW1iZGFfZGVmLCBsYW1iZGFfZGVmXVxuICB9LFxuICBcIkZVTkNfREVGXCI6IHtydWxlczpbXG4gICAgICBcImZkOmZ1bmN0aW9uX2RlZiBvcGVuX3BhciBwOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIGI6QkxPQ0tcIixcbiAgICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBvcGVuX3BhciBwOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIGI6QkxPQ0tcIixcbiAgICBdLFxuICAgIGhvb2tzOiBbZl9kZWYsIGZfZGVmXSxcbiAgICB2ZXJib3NlOlwiZnVuY3Rpb24gZGVmaW5pdGlvblwiXG4gIH0sXG4gIFwiRUxTRV9JRlwiOiB7cnVsZXM6W1wic2FtZWRlbnQgZWxzZWlmIGU6RVhQUiBiOkJMT0NLXCJdLCBob29rczpbZWxzZV9pZl9kZWZdfSxcbiAgXCJFTFNFXCI6IHtydWxlczpbXCJzYW1lZGVudCBlbHNlIGI6QkxPQ0tcIl0sIGhvb2tzOltlbHNlX2RlZl19LFxuICBcIklGXCI6IHtydWxlczpbXCJpZiBlOkVYUFIgYjpCTE9DSyBlbGlmOkVMU0VfSUYqIGVsOkVMU0U/XCJdLCBob29rczpbaWZfZGVmXX0sXG4gIFwiTUFUSFwiOiB7cnVsZXM6W1wiZTE6RVhQUiBXIG9wOm1hdGggVyBlMjpFWFBSXCJdfSxcbiAgXCJQQVRIXCI6IHtydWxlczpbXCJQQVRIIGRvdCBuYW1lXCIsIFwiUEFUSCBvcGVuX2JyYSBudW1iZXIgY2xvc2VfYnJhXCIsIFwibmFtZVwiXX0sXG4gIFwiQVNTSUdOXCI6IHtydWxlczpbXCJsZWZ0OkVYUFIgVyBvcDphc3NpZ24gVyByaWdodDpFWFBSXCJdLCBob29rczpbXG4gICAgZnVuY3Rpb24ocCl7XG4gICAgICByZXR1cm4ge2xlZnQ6cC5sZWZ0LCBvcDpwLm9wLCByaWdodDpwLnJpZ2h0fTtcbiAgICB9XVxuICB9LFxuICBcIldfT1JfU0FNRURFTlRcIjoge3J1bGVzOltcIldcIiwgXCJzYW1lZGVudFwiXSwgdmVyYm9zZTogXCJzYW1lZGVudCBvciB3aGl0ZXNwYWNlXCJ9LFxuICBcIkZVTkNfQ0FMTF9QQVJBTVNcIjoge3J1bGVzOltcIkZVTkNfQ0FMTF9QQVJBTVMgY29tbWEgV19PUl9TQU1FREVOVCBFWFBSIHNhbWVkZW50P1wiLCBcIkVYUFIgc2FtZWRlbnQ/XCJdfSxcbiAgXCJGVU5DX0NBTExcIjoge3J1bGVzOltcIm5hbWUgb3Blbl9wYXIgRlVOQ19DQUxMX1BBUkFNUz8gY2xvc2VfcGFyXCJdfSxcblxuICBcIkZPUlwiOiB7cnVsZXM6W1xuICAgIFwiZm9yX2xvb3AgazpuYW1lIGNvbW1hIFcgdjpuYW1lIFcgaW4gYTpuYW1lIGI6QkxPQ0tcIixcbiAgICBcImZvcl9sb29wIHY6bmFtZSBXIGluIGE6bmFtZSBiOkJMT0NLXCJdLFxuICAgIGhvb2tzOiBbZm9yTG9vcCwgZm9yTG9vcF1cbiAgfSxcblxuICBcIkNPTU1BX1NFUEFSQVRFRF9FWFBSXCI6IHtydWxlczpbXG4gICAgXCJFWFBSIGNvbW1hIFdfT1JfU0FNRURFTlQgQ09NTUFfU0VQQVJBVEVEX0VYUFJcIixcbiAgICBcIkVYUFJcIlxuICBdfSxcblxuICBcIkFSUkFZXCI6IHtydWxlczpbXG4gICAgXCJvcGVuX2JyYSBjOkNPTU1BX1NFUEFSQVRFRF9FWFBSPyBjbG9zZV9icmFcIixcbiAgICBcIm9wZW5fYnJhIGluZGVudCBjOkNPTU1BX1NFUEFSQVRFRF9FWFBSPyBkZWRlbnQgc2FtZWRlbnQgY2xvc2VfYnJhXCIsXG4gIF19LFxuXG4gIFwiTUVNQkVSU1wiOiB7cnVsZXM6W1xuICAgIFwibmFtZSBjb2xvbiBXIEVYUFIgY29tbWEgV19PUl9TQU1FREVOVD8gTUVNQkVSU1wiLFxuICAgIFwibmFtZSBjb2xvbiBXIEVYUFJcIlxuICBdfSxcblxuICBcIk9CSkVDVFwiOiB7cnVsZXM6W1xuICAgIFwib3Blbl9jdXJseSBNRU1CRVJTPyBjbG9zZV9jdXJseVwiLFxuICAgIFwib3Blbl9jdXJseSBpbmRlbnQgTUVNQkVSUz8gZGVkZW50IHNhbWVkZW50IGNsb3NlX2N1cmx5XCIsXG4gIF19LFxuXG4gIFwiVEFHX1BBUkFNU1wiOiB7cnVsZXM6W1xuICAgICAgXCJsZWZ0OlRBR19QQVJBTVMgVyByaWdodDpUQUdfUEFSQU1TXCIsXG4gICAgICBcIm46bmFtZSBhc3NpZ24gZTpFWFBSXCIsXG4gICAgICBcIm46bmFtZVwiLFxuICAgIF0sXG4gICAgaG9va3M6W1xuICAgICAgZnVuY3Rpb24ocCl7IHJldHVybiB7bGVmdDpwLmxlZnQsIHJpZ2h0OnAucmlnaHR9O30sXG4gICAgICBmdW5jdGlvbihwKXsgcmV0dXJuIHtuOnAubiwgZTpwLmV9O30sXG4gICAgICBmdW5jdGlvbihwKXsgcmV0dXJuIHtuOnAubn07fSxcbiAgICBdLFxuICAgIHZlcmJvc2U6XCJ0YWcgcGFyYW1ldGVyc1wiXG4gIH0sXG5cbiAgXCJUQUdcIjoge3J1bGVzOltcbiAgICBcInRhZzp0YWcgVz8gdHA6VEFHX1BBUkFNUz8gZW5kOj4/IGI6QkxPQ0s/XCIsXG4gIF0sXG4gIGhvb2tzOltcbiAgICBmdW5jdGlvbihwKXtcbiAgICAgIHJldHVybiB7dGFnOnAudGFnLCBwYXJhbXM6cC50cCwgYmxvY2s6cC5ifTtcbiAgICB9XVxuICB9LFxuXG4gIFwiRE9NX0FTU0lHTlwiOiB7cnVsZXM6W1xuICAgIFwiYXNzaWduIEVYUFJcIixcbiAgXX0sXG5cbiAgXCJUUllfQ0FUQ0hcIjoge1xuICAgIHJ1bGVzOltcbiAgICAgIFwidHJ5IGIxOkJMT0NLIHNhbWVkZW50PyBjYXRjaCBvcGVuX3BhciBlcnI6bmFtZT8gY2xvc2VfcGFyIGIyOkJMT0NLXCIsXG4gICAgXSxcbiAgICBob29rczpbZnVuY3Rpb24ocCl7IHJldHVybiBwOyB9XSxcbiAgfSxcbiAgXCJUSFJPV1wiOiB7cnVsZXM6W1xuICAgIFwidGhyb3cgRVhQUlwiLFxuICBdfSxcblxuICBcIlJFVFVSTlwiOiB7cnVsZXM6W1wicmV0IFcgRVhQUlwiLCBcInJldFwiXX0sXG4gIFwiUklHSFRfRVhQUlwiOiB7cnVsZXM6IFtcbiAgICBcIm1hdGhfb3BlcmF0b3JzXCIsXG4gICAgXCJXIGJpbmFyeV9vcGVyYXRvcnMgVyBFWFBSXCIsXG4gICAgXCJXIGNvbXBhcmlzb24gVyBFWFBSXCIsXG4gICAgXCJXID4gVyBFWFBSXCIsXG4gICAgXCJkb3QgRVhQUlwiLFxuICAgIFwib3Blbl9icmEgRVhQUiBjbG9zZV9icmFcIixcbiAgICBdLFxuICAgIHZlcmJvc2U6XCJleHByZXNzaW9uXCJcbiAgfSxcbiAgXCJFWFBSXCI6IHtydWxlczogW1xuICAgIFwiTUFUSFwiLFxuICAgIFwiT0JKRUNUXCIsXG4gICAgXCJFWFBSIFJJR0hUX0VYUFJcIixcbiAgICBcIkZVTkNfQ0FMTFwiLFxuICAgIFwiRlVOQ19ERUZcIixcbiAgICBcIkxBTUJEQVwiLFxuICAgIFwibnVtYmVyXCIsXG4gICAgXCJyZWdleHBcIixcbiAgICBcIm9wZW5fcGFyIEVYUFIgY2xvc2VfcGFyXCIsXG4gICAgXCJzdHJpbmdcIixcbiAgICBcIm5hbWVcIixcbiAgICBcIlBBVEhcIixcbiAgICBcIkFSUkFZXCJdLFxuICAgIHZlcmJvc2U6XCJleHByZXNzaW9uXCJcbiAgfSxcbn07XG5cbmZ1bmN0aW9uIHNwYWNlcihuKSB7XG4gIHZhciBvdXQgPSBcIlwiO1xuICBmb3IodmFyIGk9MDsgaTxuOyBpKyspIHtcbiAgICBvdXQgKz0gXCIgXCI7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cblxuZnVuY3Rpb24gc3AobW9kKSB7XG4gIGlmKG1vZCkge1xuICAgIHJldHVybiBzcGFjZXIoMiAqIChkZXB0aCttb2QpKTtcbiAgfVxuICByZXR1cm4gc3BhY2VyKDIgKiBkZXB0aCk7XG59XG5cbnZhciBuYyA9IDE7XG4vLyBjaGlsZHJlbiBuYW1lXG5mdW5jdGlvbiBDTigpIHtcbiAgcmV0dXJuICdfX2MnICsgbmM7XG59XG5mdW5jdGlvbiBwdXNoQ04oKSB7XG4gIG5jKys7XG4gIHJldHVybiAnX19jJyArIG5jO1xufVxuZnVuY3Rpb24gcG9wQ04oKSB7XG4gIG5jLS07XG4gIHJldHVybiAnX19jJyArIG5jO1xufVxuXG52YXIgYmFja2VuZCA9IHtcblxuICAnZGVkZW50JzogZnVuY3Rpb24obm9kZSkge1xuICAgIGRlcHRoID0gTWF0aC5tYXgoMCwgZGVwdGggLSAxKTtcbiAgICByZXR1cm4gJyc7XG4gIH0sXG4gICdpbmRlbnQnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgZGVwdGggPSBkZXB0aCArIDE7XG4gICAgcmV0dXJuICdcXG4nK3NwKCk7XG4gIH0sXG4gICdzYW1lZGVudCc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICByZXR1cm4gJ1xcbicrc3AoKTtcbiAgfSxcbiAgJ0RPTV9BU1NJR04nOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG5hbWUgPSBDTigpO1xuICAgIHJldHVybiBuYW1lKycucHVzaChTdHJpbmcoJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzFdKSArICcpKSc7XG4gIH0sXG4gICdUQUdfUEFSQU1TJzogZnVuY3Rpb24obm9kZSkge1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ubGVmdCkge1xuICAgICAgcmV0dXJuIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmxlZnQpICsgJywgJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnJpZ2h0KTtcbiAgICB9XG4gICAgaWYobm9kZS5jaGlsZHJlbi5lKSB7XG4gICAgICByZXR1cm4gbm9kZS5jaGlsZHJlbi5uLnZhbHVlICsgJzonICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBub2RlLmNoaWxkcmVuLm4udmFsdWUgKyAnOiB0cnVlJztcbiAgICB9XG4gIH0sXG4gICdUQUcnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHN0ciA9ICcnLCBpLCBwYXJhbXMgPSBcIntcIjtcbiAgICB2YXIgbmFtZSA9IG5vZGUuY2hpbGRyZW4udGFnLnZhbHVlLnN1YnN0cmluZygxKTtcbiAgICBpZihub2RlLmNoaWxkcmVuLnBhcmFtcykge1xuICAgICAgcGFyYW1zICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnBhcmFtcyk7XG4gICAgfVxuICAgIHBhcmFtcyArPSAnfSc7XG4gICAgdmFyIHN1YiA9ICdbXSc7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgc3ViID0gcHVzaENOKCk7XG4gICAgICBzdHIgKz0gJ3ZhciAnICsgQ04oKSArICcgPSBbXTsnO1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrKTtcbiAgICAgIHBvcENOKCk7XG4gICAgfVxuICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgQ04oKSArICcucHVzaChoKFwiJytuYW1lKydcIiwgJytwYXJhbXMrJywgJytzdWIrJykpJztcbiAgICByZXR1cm4gc3RyO1xuICB9LFxuICAnQ0xBU1MnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG5hbWUgPSBub2RlLmNoaWxkcmVuLm5hbWUudmFsdWUsIGk7XG4gICAgdmFyIGZ1bmNzID0gbm9kZS5jaGlsZHJlbi5tZXRob2RzO1xuICAgIHZhciBwYXJlbnQgPSBub2RlLmNoaWxkcmVuLnBhcmVudDtcbiAgICB2YXIgc3RyID0gJyc7XG4gICAgdmFyIGNvbnN0cnVjdG9yID0gbnVsbDtcbiAgICBmb3IoaT0wO2k8ZnVuY3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBmdW5jX2RlZiA9IGZ1bmNzW2ldLmNoaWxkcmVuO1xuICAgICAgdmFyIGZ1bmNfbmFtZSA9IGZ1bmNfZGVmLmNoaWxkcmVuLmZuLnZhbHVlO1xuICAgICAgaWYoZnVuY19uYW1lID09PSAnY29uc3RydWN0b3InKSB7XG4gICAgICAgIGNvbnN0cnVjdG9yID0gZnVuY19kZWY7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgKz0gJ1xcbicgKyBzcCgpICsgbmFtZSArICcucHJvdG90eXBlLicgKyBmdW5jX25hbWUgKyAnID0gJyArIGdlbmVyYXRlQ29kZShmdW5jX2RlZik7XG4gICAgICB9XG4gICAgfVxuICAgIHZhciBucyA9IGN1cnJlbnROcygpO1xuICAgIG5zW25hbWVdID0gdHJ1ZTtcbiAgICBucyA9IG5ld05zKCk7XG5cbiAgICB2YXIgcGFyYW1zID0gY29uc3RydWN0b3IgJiYgY29uc3RydWN0b3IuY2hpbGRyZW4ucGFyYW1zO1xuICAgIGlmKHBhcmFtcykge1xuICAgICAgcGFyYW1zID0gZ2VuZXJhdGVDb2RlKHBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcmFtcyA9ICcnO1xuICAgIH1cbiAgICB2YXIgYm9keSA9IGNvbnN0cnVjdG9yICYmIGNvbnN0cnVjdG9yLmNoaWxkcmVuLmJsb2NrO1xuICAgIHZhciBjb25zX3N0ciA9ICd2YXIgJyArIG5hbWUgKyAnID0gZnVuY3Rpb24gJyArIG5hbWUgKyAnKCcrIHBhcmFtcyArICcpIHsnO1xuICAgIGNvbnNfc3RyICs9ICdcXG4nK3NwKDEpKydpZighKHRoaXMgaW5zdGFuY2VvZiAnK25hbWUrJykpeyByZXR1cm4gbmV3ICcrbmFtZSsnKCcrT2JqZWN0LmtleXMobnMpLmpvaW4oJywnKSsnKTt9JztcbiAgICBmb3IodmFyIGtleSBpbiBucykge1xuICAgICAgaWYobnNba2V5XSAhPT0gdHJ1ZSAmJiBuc1trZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc19zdHIgKz0gJ1xcbicrc3AoMSkrJ2lmKCcra2V5KycgPT09IHVuZGVmaW5lZCkgeycra2V5KycgPSAnK2dlbmVyYXRlQ29kZShuc1trZXldKSsnfTsnO1xuICAgICAgfVxuICAgIH1cbiAgICBpZihib2R5KSB7XG4gICAgICBjb25zX3N0ciArPSBnZW5lcmF0ZUNvZGUoYm9keSk7XG4gICAgfVxuICAgIGNvbnNfc3RyICs9IHNwKCkgKyAnXFxufSc7XG5cbiAgICBpZihwYXJlbnQpIHtcbiAgICAgIGNvbnNfc3RyICs9ICdcXG4nK3NwKCkgKyBuYW1lICsgJy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCcgKyBwYXJlbnQudmFsdWUgKyAnLnByb3RvdHlwZSk7JztcbiAgICAgIGNvbnNfc3RyICs9ICdcXG4nK3NwKCkgKyBuYW1lICsgJy5wcm90b3R5cGUuY29uc3RydWN0b3IgPSAnK25hbWUrJyc7XG4gICAgICAvL2NvbnNfc3RyICs9ICdcXG4nK3NwKCkgKyBuYW1lICsgJy5wcm90b3R5cGUuc3VwZXIgPSBmdW5jdGlvbigpeycgKyBwYXJlbnQudmFsdWUgKyAnLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7fSc7XG4gICAgfVxuXG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICByZXR1cm4gY29uc19zdHIgKyBzdHI7XG4gIH0sXG4gICdGVU5DX0RFRic6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgbmFtZSA9IFwiXCI7XG4gICAgdmFyIG5zID0gY3VycmVudE5zKCk7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5mbikge1xuICAgICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICBuc1tuYW1lXSA9IHRydWU7XG4gICAgfVxuICAgIG5zID0gbmV3TnMoKTtcbiAgICB2YXIgc3RyID0gXCJmdW5jdGlvbiBcIiArIG5hbWUgKyBcIihcIjtcbiAgICBpZihub2RlLmNoaWxkcmVuLnBhcmFtcykge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnBhcmFtcyk7XG4gICAgfVxuICAgIHN0ciArPSAnKSB7JztcbiAgICBmb3IodmFyIGtleSBpbiBucykge1xuICAgICAgaWYobnNba2V5XSAhPT0gdHJ1ZSAmJiBuc1trZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc3RyICs9ICdcXG4nK3NwKDEpKydpZignK2tleSsnID09PSB1bmRlZmluZWQpIHsnK2tleSsnID0gJytnZW5lcmF0ZUNvZGUobnNba2V5XSkrJ307JztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYobm9kZS5jaGlsZHJlbi5kZWYudmFsdWUgPT09ICdkb20nKSB7XG4gICAgICBzdHIgKz0gJ1xcbicrc3AoMSkgKyAndmFyICcgKyBDTigpICsgJyA9IFtdOyc7XG4gICAgfVxuXG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrKTtcbiAgICB9XG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcblxuICAgIGlmKG5vZGUuY2hpbGRyZW4uZGVmLnZhbHVlID09PSAnZG9tJykge1xuICAgICAgc3RyICs9ICdcXG4nK3NwKDEpICsgJ3JldHVybiAnICsgQ04oKSArICc7JztcbiAgICB9XG4gICAgcmV0dXJuIHN0ciArICdcXG4nK3NwKCkrJ30nO1xuICB9LFxuICAnRlVOQ19ERUZfUEFSQU1TJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBzdHIgPSBcIlwiLCBpO1xuICAgIHZhciBucyA9IGN1cnJlbnROcygpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW5bMF0udHlwZSA9PT0gJ25hbWUnKSB7XG4gICAgICBuc1tub2RlLmNoaWxkcmVuWzBdLnZhbHVlXSA9IHRydWU7XG4gICAgICBpZihub2RlLmNoaWxkcmVuWzFdICYmIG5vZGUuY2hpbGRyZW5bMV0udHlwZSA9PT0gJ2Fzc2lnbicpIHtcbiAgICAgICAgbnNbbm9kZS5jaGlsZHJlblswXS52YWx1ZV0gPSBub2RlLmNoaWxkcmVuWzJdO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IoaT0wO2k8bm9kZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIG4gPSBub2RlLmNoaWxkcmVuW2ldO1xuICAgICAgaWYobi50eXBlID09PSAnbmFtZScgfHwgbi50eXBlID09PSAnRlVOQ19ERUZfUEFSQU1TJyB8fCBuLnR5cGUgPT09ICdjb21tYScgfHwgbi50eXBlID09PSAnd2luZG93Jykge1xuICAgICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5baV0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc3RyO1xuICB9LFxuICAnTEFNQkRBJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBuYW1lID0gXCJcIjtcbiAgICB2YXIgbnMgPSBuZXdOcygpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW5bMF0pIHtcbiAgICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuWzBdLnZhbHVlO1xuICAgIH1cbiAgICB2YXIgc3RyID0gXCJmdW5jdGlvbiBcIiArIG5hbWUgKyBcIihcIjtcbiAgICBpZihub2RlLmNoaWxkcmVuWzFdKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bMV0sIG5zKTtcbiAgICB9XG4gICAgc3RyICs9ICcpIHsgcmV0dXJuICc7XG4gICAgaWYobm9kZS5jaGlsZHJlblsyXSkge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzJdLCBucyk7XG4gICAgfVxuICAgIG5hbWVzcGFjZXMucG9wKCk7XG4gICAgcmV0dXJuIHN0ciArIFwiOyB9XCI7XG4gIH0sXG4gICdBU1NJR04nOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHByZWZpeCA9IFwiXCI7XG4gICAgdmFyIG9wID0gbm9kZS5jaGlsZHJlbi5vcC52YWx1ZTtcbiAgICB2YXIgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBpZihub2RlLmNoaWxkcmVuLmxlZnQuY2hpbGRyZW5bMF0udHlwZSA9PT0gJ25hbWUnKSB7XG4gICAgICB2YXIgY2ggPSBub2RlLmNoaWxkcmVuLmxlZnQuY2hpbGRyZW5bMF07XG4gICAgICBpZihuc1tjaC52YWx1ZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZihvcCA9PSAnOj0nKSB7XG4gICAgICAgICAgb3AgPSAnPSc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcHJlZml4ID0gJ3ZhciAnO1xuICAgICAgICB9XG4gICAgICAgIG5zW2NoLnZhbHVlXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBwcmVmaXgrZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ubGVmdCkgKyAnICcgKyBvcCArICcgJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnJpZ2h0KTtcbiAgfSxcbiAgJ1NUQVRFTUVOVCc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICByZXR1cm4gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bMF0pICsgJzsnO1xuICB9LFxuICAnSUYnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHN0ciA9ICcnO1xuICAgIHN0ciA9ICdpZignK2dlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzBdKSArICcpeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblsxXSkgKyAnXFxuJytzcCgpKyd9JztcbiAgICBpZihub2RlLmNoaWxkcmVuWzJdKSB7XG4gICAgICBpZihBcnJheS5pc0FycmF5KG5vZGUuY2hpbGRyZW5bMl0pKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbm9kZS5jaGlsZHJlblsyXS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblsyXVtpXSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblsyXSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKG5vZGUuY2hpbGRyZW5bM10pIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblszXSk7XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG4gIH0sXG4gICdGT1InOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIGtleUluZGV4TmFtZSA9IFwiX2luZGV4XCIrZm9yTG9vcENvdW50O1xuICAgIHZhciBrZXlBcnJheU5hbWUgPSBcIl9rZXlzXCIrZm9yTG9vcENvdW50O1xuICAgIGZvckxvb3BDb3VudCsrO1xuICAgIHZhciBpbmRleE5hbWUgPSBmYWxzZTtcbiAgICBpZihub2RlLmNoaWxkcmVuWzBdKSB7XG4gICAgICBpbmRleE5hbWUgPSBub2RlLmNoaWxkcmVuWzBdLnZhbHVlO1xuICAgIH1cbiAgICB2YXIgc3RyID0gJ3ZhciAnK2tleUFycmF5TmFtZSsnID0gT2JqZWN0LmtleXMoJytub2RlLmNoaWxkcmVuWzJdLnZhbHVlKycpO1xcbic7XG4gICAgc3RyICs9IHNwKCkgKyAnZm9yKHZhciAnK2tleUluZGV4TmFtZSsnID0gMDsgJytrZXlJbmRleE5hbWUrJyA8ICcra2V5QXJyYXlOYW1lKycubGVuZ3RoOyAnK2tleUluZGV4TmFtZSsnKysgKSB7XFxuJztcbiAgICBpZihpbmRleE5hbWUpIHtcbiAgICAgIHN0ciArPSBzcCgxKSArICd2YXIgJyArIGluZGV4TmFtZSArICcgPSAnICsga2V5QXJyYXlOYW1lICsnWycgKyBrZXlJbmRleE5hbWUgKyAnXTtcXG4nO1xuICAgIH1cbiAgICBzdHIgKz0gc3AoMSkgKyAndmFyICcgKyBub2RlLmNoaWxkcmVuWzFdLnZhbHVlICsgJyA9ICcgKyBub2RlLmNoaWxkcmVuWzJdLnZhbHVlICsgJ1snICsga2V5QXJyYXlOYW1lICsnWycgKyBrZXlJbmRleE5hbWUgKyAnXV07JztcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bM10pICsnXFxuJytzcCgpKyd9JztcbiAgICByZXR1cm4gc3RyO1xuICB9LFxuICAnRUxTRV9JRic6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICByZXR1cm4gJyBlbHNlIGlmKCcrZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bMF0pKycpIHsnK2dlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzFdKSsgJ1xcbicrc3AoKSsnfSc7XG4gIH0sXG4gICdFTFNFJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHJldHVybiAnIGVsc2UgeycrZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bMF0pKyAnXFxuJytzcCgpKyd9JztcbiAgfSxcbiAgJ1RSWV9DQVRDSCc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgc3RyID0gXCJ0cnkge1wiO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iMSk7XG4gICAgc3RyICs9ICdcXG4nK3NwKCkrXCJ9IGNhdGNoKFwiK2dlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmVycikrXCIpIHtcIjtcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYjIpO1xuICAgIHJldHVybiBzdHIrJ1xcbicrc3AoKStcIn1cIjtcbiAgfSxcbiAgJ3N0cmluZyc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgdiA9IG5vZGUudmFsdWU7XG4gICAgdiA9IHYucmVwbGFjZSgvXFxuL2csIFwiXFxcXG5cIik7XG4gICAgdmFyIGFzdCA9IHN0ckdyYW0ucGFyc2Uodik7XG4gICAgaWYoIWFzdC5jb21wbGV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGFzdC5oaW50KTtcbiAgICB9XG4gICAgcmV0dXJuIGdlbmVyYXRlU3RyaW5nQ29kZShhc3QpO1xuICB9LFxuICAnY29tbWVudCc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZS5yZXBsYWNlKC9eIy9nLCBcIi8vXCIpO1xuICB9LFxuICAnY29tcGFyaXNvbic6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBpZihub2RlLnZhbHVlID09ICc9PScpIHtcbiAgICAgIHJldHVybiAnPT09JztcbiAgICB9XG4gICAgaWYobm9kZS52YWx1ZSA9PSAnIT0nKSB7XG4gICAgICByZXR1cm4gJyE9PSc7XG4gICAgfVxuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9XG59O1xuXG5mdW5jdGlvbiBnZW5lcmF0ZUNvZGUobm9kZSwgbnMpIHtcbiAgaWYoIW5vZGUpIHtcbiAgICAvL2RlYnVnZ2VyXG4gIH1cbiAgaWYoYmFja2VuZFtub2RlLnR5cGVdKSB7XG4gICAgcmV0dXJuIGJhY2tlbmRbbm9kZS50eXBlXShub2RlKTtcbiAgfVxuICBpZihub2RlLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgfVxuICB2YXIgc3RyID0gXCJcIiwgaTtcbiAgaWYoIW5vZGUuY2hpbGRyZW4pIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgZm9yKGk9MDtpPG5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5baV0sIG5zKTtcbiAgfVxuICByZXR1cm4gc3RyO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZUV4cG9ydHMoa2V5cykge1xuICB2YXIgc3RyID0gJ1xcbm1vZHVsZS5leHBvcnRzID0geyc7XG4gIGtleXMgPSBrZXlzIHx8IE9iamVjdC5rZXlzKGN1cnJlbnROcygpKTtcbiAgZm9yKHZhciBpPTA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgc3RyICs9ICdcXG4gICcgKyBrZXlzW2ldICsgJzogJyArIGtleXNbaV0gKyAnLCc7XG4gIH1cbiAgcmV0dXJuIHN0ciArICdcXG59Jztcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVNb2R1bGUoaW5wdXQsIG9wdHMpIHtcbiAgcmVzZXRHbG9iYWwoKTtcbiAgdmFyIGFzdCA9IGdyYW0ucGFyc2UoaW5wdXQgKyBcIlxcblwiKTtcbiAgaWYoIWFzdC5jb21wbGV0ZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihhc3QuaGludCk7XG4gIH1cbiAgdmFyIG9iaiA9IHthc3Q6YXN0LCBjb2RlOmdlbmVyYXRlQ29kZShhc3QpLCBuczpjdXJyZW50TnMoKX07XG4gIHJldHVybiBvYmo7XG59XG5cbnZhciBncmFtID0gZXBlZ2pzLmNvbXBpbGVHcmFtbWFyKGdyYW1tYXJEZWYsIHRva2VuRGVmKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGdyYW1tYXI6IGdyYW0sXG4gIHN0ckdyYW1tYXI6IHN0ckdyYW0sXG4gIGdyYW1tYXJEZWY6IGdyYW1tYXJEZWYsXG4gIGVwZWdqczplcGVnanMsXG4gIHRva2VuRGVmOiB0b2tlbkRlZixcbiAgZ2VuZXJhdGVNb2R1bGU6IGdlbmVyYXRlTW9kdWxlLFxuICBnZW5lcmF0ZUNvZGU6IGdlbmVyYXRlQ29kZSxcbiAgZ2VuZXJhdGVFeHBvcnRzOiBnZW5lcmF0ZUV4cG9ydHNcbn07XG5cbiJdfQ==
