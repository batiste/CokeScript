!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.cokescript=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
  CokeScript language by Batiste Bieler 2015
  Implemented using EPEG.JS
*/
"use strict";

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
  {key:"comment", func:commentDef},
  {key:"function_def", func: defDef, verbose:"function definition"},
  {key:"class", reg:/^class /},
  {key:"ret", reg:/^return/, verbose:"return"},
  {key:"if", reg:/^if /},
  {key:"tag", reg:/^<[a-zA-Z_$][0-9a-zA-Z_]{0,29}/},
  {key:"dom", reg:/^DOM:/},
  {key:"elseif", reg:/^elseif /},
  {key:"else", reg:/^else/},
  {key:"for_loop", reg:/^for /, verbose:"for loop"},
  {key:"in", reg:/^in /},
  {key:"name", reg:/^[a-zA-Z_$][0-9a-zA-Z_]{0,29}/}, // 30 chars max
  {key:"math_operators", reg:/^(\+\+|\-\-)/, verbose:"math operator"},
  {key:"binary_operators", reg:/^(\&\&|\|\||\&|\||<<|\>\>)/, verbose:"binary operator"},
  {key:"comparison", reg:/^(<=|>=|<|>|===|!=|==)/},
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
  {key:"string", func:stringDef}
];

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

    //var blank_line = input.match(/^\n[ ]*\n/);
    //if(blank_line && dentType === "samedent") {
    //  return input.match(/^\n[ ]*/)[0];
    //}

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

function defDef(input) {
  if(input.indexOf("def(") === 0) {
    return "def";
  }
  if(input.indexOf("def ") === 0) {
    return "def";
  }
  //if(input.indexOf("dom(") === 0) {
  //  return "dom";
  //}
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
  "STATEMENT": {rules:["ASSIGN", "IF", "FOR", "EXPR", "RETURN", "CLASS", "TAG", "DOM_ASSIGN"]},
  "BLOCK": {rules: ["indent LINE+ dedent"]},
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
  "FUNC_CALL_PARAMS": {rules:["FUNC_CALL_PARAMS comma W EXPR", "EXPR"]},
  "FUNC_CALL": {rules:["name open_par FUNC_CALL_PARAMS? close_par"]},

  "FOR": {rules:[
    "for_loop k:name comma W v:name W in a:name b:BLOCK",
    "for_loop v:name W in a:name b:BLOCK"],
    hooks: [forLoop, forLoop]
  },

  "COMMA_SEPARATED_EXPR": {rules:[
    "EXPR comma SPACE* COMMA_SEPARATED_EXPR",
    "EXPR"
  ]},

  "ARRAY": {rules:[
    "open_bra SPACE* c:COMMA_SEPARATED_EXPR? SPACE* close_bra",
  ]},

  "MEMBERS": {rules:[
    "name colon SPACE* EXPR comma SPACE* MEMBERS",
    "name colon SPACE* EXPR"
  ]},

  "OBJECT": {rules:[
    "open_curly SPACE* MEMBERS? SPACE* close_curly",
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
    "tag:tag W? tp:TAG_PARAMS? b:BLOCK?",
  ],
  hooks:[
    function(p){
      return {tag:p.tag, params:p.tp, block:p.b};
    }]
  },

  "DOM_ASSIGN": {rules:[
    "assign EXPR",
  ]},

  "SPACE": {rules:["W", "indent", "dedent", "samedent"]},

  "RETURN": {rules:["ret W EXPR", "ret"]},
  "RIGHT_EXPR": {rules: [
    "math_operators",
    "W binary_operators W EXPR",
    "W comparison W EXPR",
    "dot EXPR",
    "open_bra EXPR close_bra",
    ],
    verbose:"expression"
  },
  "EXPR": {rules: [
    "MATH",
    "EXPR RIGHT_EXPR",
    "FUNC_CALL",
    "FUNC_DEF",
    "LAMBDA",
    "number",
    "open_par EXPR close_par",
    "string",
    "name",
    "PATH",
    "ARRAY",
    "OBJECT"],
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

function generateParams(ps, ns) {
  var str = '';
  if(ps){
    var params = ps.children;
    if(params) {
      params.map(function(p) {
        if(p.type == 'name') {
          ns[p.value] = true;
        }
        if(p.children) {
          str += generateParams(p, ns);
        } else {
          str += p.value;
        }
      });
    }
  }
  return str;
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
  'DOM': function(node) {
    var name = CN(), params = "", func_name = "";
    if(node.children[2].children[0]) {
      func_name = " " + node.children[2].children[0].value;
    }
    if(node.children[2].children[1]) {
      params = generateCode(node.children[2].children[1]);
      // TODO default params
    }
    var str = 'function'+func_name+'('+params+'){';
    str += '\n' + sp(1) + 'var ' + name + ' = [];';
    str += generateCode(node.children[2].children[2]);
    str += '\n' + sp(1) + 'return '+name+';\n' + sp() + '}';
    return str;
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
    var str = '', i, params = "";
    var name = node.children.tag.value.substring(1);
    if(node.children.params) {
      var params = '{' + generateCode(node.children.params) + '}';
    }
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
  'string': function(node) {
    var v = node.value;
    v = v.replace(/\n/g, "\\\n");
    // hacky string escaping with {}...
    if(v.indexOf('{') > -1 && v.indexOf('}') > -1) {
      v = v.split(/{/).map(function(i) {
        var s = i.split(/}/);
        if(s.length>1) {
          return '" + ' + s[0] + ' + "' + s[1];
        } else { return i; }
      }).join("");
    }
    return v;
  },
  'comment': function(node) {
    return node.value.replace(/^#/g, "//");
  },
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
    throw ast.hint;
  }
  var obj = {ast:ast, code:generateCode(ast), ns:currentNs()};
  return obj;
}

var epegjs = require("epegjs");
var gram = epegjs.compileGrammar(grammarDef, tokenDef);

module.exports = {
  grammar: gram,
  grammarDef: grammarDef,
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
        throw "Invalid token " + key + " without a reg or fund property";
      }
    }
    if(candidate !== null) {
      lastToken = {type:key, value:candidate, pointer:pointer};
      stream.push(lastToken);
      pointer += candidate.length;
      input = input.substr(candidate.length);
    } else {
      if(lastToken)
        lastToken.pointer += lastToken.value.length;
      var msg = errorMsg(copy, stream, stream.length - 1, "Tokenizer error", "No matching token found");
      if(lastToken)
        msg += "\n" + "Before token of type " + lastToken.type + ": " + lastToken.value;
      throw msg;
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
    throw "Impossible to have non capturing token that repeats";
  }
  if(nonCapturing) {
    t.nonCapturing = nonCapturing;
  }
  return t;
}

function compileGrammar(grammar, tokenDef) {
  var keys = Object.keys(grammar), i, j;
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
      tokens = tokens.map(function(t) {
        var token = grammarToken(t);
        if(allValidKeys.indexOf(token.type) === -1 && token.type !== 'EOF') {
          throw "Invalid token type used in the grammar: " + token.type;
        }
        if(token.repeat === '*') {
          optional += 1;
        }
        if(token.nonCapturing) {
          if(tokens[tokens.length - 1] != t) {
            throw "Non capturing token has to be the last one in the rule: " + token.type;
          }
        }
        return token;
      });
      if(optional === tokens.length) {
        throw "Rule " + rules[j] + " only has * tokens.";
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

function errorMsg(input, stream, sp, errorType, m) {

  var token = stream[sp];
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

  var msg = errorMsg(input, stream, best_parse.sp, "Parser error", "Rule " + verboseName(grammar, rule.key));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb2tlc2NyaXB0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FEL29CQTtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKlxuICBDb2tlU2NyaXB0IGxhbmd1YWdlIGJ5IEJhdGlzdGUgQmllbGVyIDIwMTVcbiAgSW1wbGVtZW50ZWQgdXNpbmcgRVBFRy5KU1xuKi9cblwidXNlIHN0cmljdFwiO1xuXG52YXIgZGVwdGggPSAwO1xudmFyIGZvckxvb3BDb3VudCA9IDE7XG52YXIgbmFtZXNwYWNlcyA9IFt7fV07XG52YXIgbGV2ZWxTdGFjayA9IFswXTtcblxuZnVuY3Rpb24gY3VycmVudE5zKCkge1xuICByZXR1cm4gbmFtZXNwYWNlc1tuYW1lc3BhY2VzLmxlbmd0aCAtMV07XG59XG5cbmZ1bmN0aW9uIG5ld05zKCkge1xuICBuYW1lc3BhY2VzLnB1c2goe30pO1xuICByZXR1cm4gbmFtZXNwYWNlc1tuYW1lc3BhY2VzLmxlbmd0aCAtMV07XG59XG5cbmZ1bmN0aW9uIHJlc2V0R2xvYmFsKCkge1xuICBuYW1lc3BhY2VzID0gW3t9XTtcbiAgZm9yTG9vcENvdW50ID0gMTtcbiAgbGV2ZWxTdGFjayA9IFswXTtcbiAgZGVwdGggPSAwO1xufVxuXG4vLyB0b2tlbiBhcmUgbWF0Y2hlZCBpbiBvcmRlciBvZiBkZWNsYXJhdGlvblxuLy8gVE9ETzogYWRkIGZ1bmN0aW9uc1xudmFyIHRva2VuRGVmID0gW1xuICB7a2V5OlwiY29tbWVudFwiLCBmdW5jOmNvbW1lbnREZWZ9LFxuICB7a2V5OlwiZnVuY3Rpb25fZGVmXCIsIGZ1bmM6IGRlZkRlZiwgdmVyYm9zZTpcImZ1bmN0aW9uIGRlZmluaXRpb25cIn0sXG4gIHtrZXk6XCJjbGFzc1wiLCByZWc6L15jbGFzcyAvfSxcbiAge2tleTpcInJldFwiLCByZWc6L15yZXR1cm4vLCB2ZXJib3NlOlwicmV0dXJuXCJ9LFxuICB7a2V5OlwiaWZcIiwgcmVnOi9eaWYgL30sXG4gIHtrZXk6XCJ0YWdcIiwgcmVnOi9ePFthLXpBLVpfJF1bMC05YS16QS1aX117MCwyOX0vfSxcbiAge2tleTpcImRvbVwiLCByZWc6L15ET006L30sXG4gIHtrZXk6XCJlbHNlaWZcIiwgcmVnOi9eZWxzZWlmIC99LFxuICB7a2V5OlwiZWxzZVwiLCByZWc6L15lbHNlL30sXG4gIHtrZXk6XCJmb3JfbG9vcFwiLCByZWc6L15mb3IgLywgdmVyYm9zZTpcImZvciBsb29wXCJ9LFxuICB7a2V5OlwiaW5cIiwgcmVnOi9eaW4gL30sXG4gIHtrZXk6XCJuYW1lXCIsIHJlZzovXlthLXpBLVpfJF1bMC05YS16QS1aX117MCwyOX0vfSwgLy8gMzAgY2hhcnMgbWF4XG4gIHtrZXk6XCJtYXRoX29wZXJhdG9yc1wiLCByZWc6L14oXFwrXFwrfFxcLVxcLSkvLCB2ZXJib3NlOlwibWF0aCBvcGVyYXRvclwifSxcbiAge2tleTpcImJpbmFyeV9vcGVyYXRvcnNcIiwgcmVnOi9eKFxcJlxcJnxcXHxcXHx8XFwmfFxcfHw8PHxcXD5cXD4pLywgdmVyYm9zZTpcImJpbmFyeSBvcGVyYXRvclwifSxcbiAge2tleTpcImNvbXBhcmlzb25cIiwgcmVnOi9eKDw9fD49fDx8Pnw9PT18IT18PT0pL30sXG4gIHtrZXk6XCJhc3NpZ25cIiwgcmVnOi9eKFxcKz18LT18PXw6PSkvfSxcbiAge2tleTpcIm51bWJlclwiLCByZWc6L15bMC05XStcXC4/WzAtOV0qL30sIC8vIG9ubHkgcG9zaXRpdmUgZm9yIG5vd1xuICB7a2V5OlwiY29tbWFcIiwgcmVnOi9eXFwsL30sXG4gIHtrZXk6XCJkb3RcIiwgcmVnOi9eXFwuL30sXG4gIHtrZXk6XCJjb2xvblwiLCByZWc6L15cXDovLCB2ZXJib3NlOlwiOlwifSxcbiAge2tleTpcIm9wZW5fcGFyXCIsIHJlZzovXlxcKC8sIHZlcmJvc2U6XCIoXCJ9LFxuICB7a2V5OlwiY2xvc2VfcGFyXCIsIHJlZzovXlxcKS8sIHZlcmJvc2U6XCIpXCJ9LFxuICB7a2V5Olwib3Blbl9icmFcIiwgcmVnOi9eXFxbLywgdmVyYm9zZTpcIltcIn0sXG4gIHtrZXk6XCJjbG9zZV9icmFcIiwgcmVnOi9eXFxdLywgdmVyYm9zZTpcIl1cIn0sXG4gIHtrZXk6XCJvcGVuX2N1cmx5XCIsIHJlZzovXlxcey8sIHZlcmJvc2U6XCJ7XCJ9LFxuICB7a2V5OlwiY2xvc2VfY3VybHlcIiwgcmVnOi9eXFx9LywgdmVyYm9zZTpcIn1cIn0sXG4gIHtrZXk6XCJtYXRoXCIsIHJlZzovXlstfFxcK3xcXCp8L3wlXS99LFxuICB7a2V5Olwic2FtZWRlbnRcIiwgZnVuYzpkZW50KCdzYW1lZGVudCcpLCB2ZXJib3NlOlwic2FtZSBpbmRlbnRhdGlvblwifSxcbiAge2tleTpcImRlZGVudFwiLCBmdW5jOmRlbnQoJ2RlZGVudCcpfSxcbiAge2tleTpcImluZGVudFwiLCBmdW5jOmRlbnQoJ2luZGVudCcpfSxcbiAgLy9uZXdsaW5lOiAvXihcXHI/XFxufCQpLyxcbiAge2tleTpcIldcIiwgcmVnOi9eWyBdLywgdmVyYm9zZTpcInNpbmdsZSB3aGl0ZXNwYWNlXCJ9LFxuICB7a2V5Olwic3RyaW5nXCIsIGZ1bmM6c3RyaW5nRGVmfVxuXTtcblxuZnVuY3Rpb24gY3VycmVudExldmVsKCkge1xuICByZXR1cm4gbGV2ZWxTdGFja1tsZXZlbFN0YWNrLmxlbmd0aCAtIDFdO1xufVxuXG5mdW5jdGlvbiBpbmRlbnRUeXBlKGwpIHtcbiAgaWYobCA+IGN1cnJlbnRMZXZlbCgpKSB7XG4gICAgcmV0dXJuICdpbmRlbnQnO1xuICB9XG4gIGlmKGwgPCBjdXJyZW50TGV2ZWwoKSkge1xuICAgIHJldHVybiAnZGVkZW50JztcbiAgfVxuICBpZihsID09PSBjdXJyZW50TGV2ZWwoKSkge1xuICAgIHJldHVybiAnc2FtZWRlbnQnO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRlbnQoZGVudFR5cGUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIF9kZW50KGlucHV0KSB7XG5cbiAgICAvL3ZhciBibGFua19saW5lID0gaW5wdXQubWF0Y2goL15cXG5bIF0qXFxuLyk7XG4gICAgLy9pZihibGFua19saW5lICYmIGRlbnRUeXBlID09PSBcInNhbWVkZW50XCIpIHtcbiAgICAvLyAgcmV0dXJuIGlucHV0Lm1hdGNoKC9eXFxuWyBdKi8pWzBdO1xuICAgIC8vfVxuXG4gICAgdmFyIG0gPSBpbnB1dC5tYXRjaCgvXlxcblsgXSovKTtcbiAgICBpZihtKSB7XG4gICAgICB2YXIgaW5kZW50ID0gbVswXS5sZW5ndGggLSAxO1xuICAgICAgaWYoaW5kZW50VHlwZShpbmRlbnQpID09PSBkZW50VHlwZSkge1xuICAgICAgICBpZihkZW50VHlwZSA9PSAnZGVkZW50Jykge1xuICAgICAgICAgIGxldmVsU3RhY2sucG9wKCk7XG4gICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICB9XG4gICAgICAgIGlmKGRlbnRUeXBlID09ICdpbmRlbnQnKSB7XG4gICAgICAgICAgbGV2ZWxTdGFjay5wdXNoKGluZGVudCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1bMF07XG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuXG5mdW5jdGlvbiBzdHJpbmdEZWYoaW5wdXQpIHtcbiAgaWYoaW5wdXQuY2hhckF0KDApID09PSAnXCInKSB7XG4gICAgdmFyIGkgPSAxO1xuICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSkge1xuICAgICAgdmFyIGNoID0gaW5wdXQuY2hhckF0KGkpO1xuICAgICAgaWYoY2ggPT09ICdcXFxcJykge1xuICAgICAgICBpKys7XG4gICAgICB9IGVsc2UgaWYoY2ggPT09ICdcIicpIHtcbiAgICAgICAgcmV0dXJuIGlucHV0LnNsaWNlKDAsIGkrMSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGRlZkRlZihpbnB1dCkge1xuICBpZihpbnB1dC5pbmRleE9mKFwiZGVmKFwiKSA9PT0gMCkge1xuICAgIHJldHVybiBcImRlZlwiO1xuICB9XG4gIGlmKGlucHV0LmluZGV4T2YoXCJkZWYgXCIpID09PSAwKSB7XG4gICAgcmV0dXJuIFwiZGVmXCI7XG4gIH1cbiAgLy9pZihpbnB1dC5pbmRleE9mKFwiZG9tKFwiKSA9PT0gMCkge1xuICAvLyAgcmV0dXJuIFwiZG9tXCI7XG4gIC8vfVxuICBpZihpbnB1dC5pbmRleE9mKFwiZG9tIFwiKSA9PT0gMCkge1xuICAgIHJldHVybiBcImRvbVwiO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbW1lbnREZWYoaW5wdXQpIHtcbiAgdmFyIG0gPSBpbnB1dC5tYXRjaCgvXlxcL1xcLy8pIHx8IGlucHV0Lm1hdGNoKC9eIy8pO1xuICBpZihtKSB7XG4gICAgdmFyIGkgPSBtWzBdLmxlbmd0aDtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpIHtcbiAgICAgIHZhciBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxuJykge1xuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGZfZGVmKHBhcmFtcykge1xuICByZXR1cm4ge2RlZjpwYXJhbXMuZmQsIGZuOnBhcmFtcy5mbiwgcGFyYW1zOnBhcmFtcy5wLCBibG9jazpwYXJhbXMuYn07XG59XG5cbmZ1bmN0aW9uIGxhbWJkYV9kZWYocGFyYW1zKSB7XG4gIHJldHVybiBbcGFyYW1zLmZuLCBwYXJhbXMucCwgcGFyYW1zLmJdO1xufVxuXG5mdW5jdGlvbiBlbHNlX2RlZihwYXJhbXMpIHtcbiAgcmV0dXJuIFtwYXJhbXMuYl07XG59XG5cbmZ1bmN0aW9uIGVsc2VfaWZfZGVmKHBhcmFtcykge1xuICByZXR1cm4gW3BhcmFtcy5lLCBwYXJhbXMuYl07XG59XG5cbmZ1bmN0aW9uIGlmX2RlZihwYXJhbXMpIHtcbiAgcmV0dXJuIFtwYXJhbXMuZSwgcGFyYW1zLmIsIHBhcmFtcy5lbGlmLCBwYXJhbXMuZWxdO1xufVxuXG5mdW5jdGlvbiBmb3JMb29wKHBhcmFtcykge1xuICByZXR1cm4gW3BhcmFtcy5rLCBwYXJhbXMudiwgcGFyYW1zLmEsIHBhcmFtcy5iXTtcbn1cblxudmFyIGdyYW1tYXJEZWYgPSB7XG4gIFwiU1RBUlRcIjoge3J1bGVzOltcIkxJTkUqIEVPRlwiXX0sXG4gIFwiTElORVwiOiB7cnVsZXM6W1wiU1RBVEVNRU5UIHNhbWVkZW50K1wiLCBcIlNUQVRFTUVOVCAhZGVkZW50XCIsIFwiY29tbWVudD8gc2FtZWRlbnRcIl0sIHZlcmJvc2U6XCJuZXcgbGluZVwifSxcbiAgXCJTVEFURU1FTlRcIjoge3J1bGVzOltcIkFTU0lHTlwiLCBcIklGXCIsIFwiRk9SXCIsIFwiRVhQUlwiLCBcIlJFVFVSTlwiLCBcIkNMQVNTXCIsIFwiVEFHXCIsIFwiRE9NX0FTU0lHTlwiXX0sXG4gIFwiQkxPQ0tcIjoge3J1bGVzOiBbXCJpbmRlbnQgTElORSsgZGVkZW50XCJdfSxcbiAgXCJDTEFTU19NRVRIT0RTXCI6IHtcbiAgICAgIHJ1bGVzOiBbXCJzYW1lZGVudCogZjpGVU5DX0RFRiBzYW1lZGVudCpcIl0sXG4gICAgICBob29rczogWyBmdW5jdGlvbihwKXsgcmV0dXJuIHAuZjsgfV1cbiAgfSxcbiAgXCJDTEFTU1wiOiB7XG4gICAgcnVsZXM6IFtcbiAgICAgIFwiY2xhc3MgbjpuYW1lIG9wZW5fcGFyIHA6bmFtZSBjbG9zZV9wYXIgaW5kZW50IG06Q0xBU1NfTUVUSE9EUysgZGVkZW50XCIsXG4gICAgICBcImNsYXNzIG46bmFtZSBpbmRlbnQgbTpDTEFTU19NRVRIT0RTKyBkZWRlbnRcIlxuICAgIF0sXG4gICAgaG9va3M6IFtcbiAgICAgIGZ1bmN0aW9uKHApeyByZXR1cm4ge25hbWU6cC5uLCBtZXRob2RzOnAubSwgcGFyZW50OnAucH07IH0sXG4gICAgICBmdW5jdGlvbihwKXsgcmV0dXJuIHtuYW1lOnAubiwgbWV0aG9kczpwLm19OyB9XG4gICAgXVxuICB9LFxuICBcIkZVTkNfREVGX1BBUkFNU1wiOiB7cnVsZXM6W1xuICAgICAgXCJwMTpGVU5DX0RFRl9QQVJBTVMgY29tbWEgVyBwMjpGVU5DX0RFRl9QQVJBTVNcIixcbiAgICAgIFwicDE6bmFtZSBhc3NpZ24gZTpFWFBSXCIsXG4gICAgICBcInAxOm5hbWVcIixcbiAgICBdLFxuICAgIHZlcmJvc2U6XCJmdW5jdGlvbiBwYXJhbWV0ZXJzXCJcbiAgfSxcbiAgXCJMQU1CREFcIjoge3J1bGVzOltcbiAgICAgIFwiZnVuY3Rpb25fZGVmIG9wZW5fcGFyIHA6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgVyBiOkVYUFJcIixcbiAgICAgIFwiZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBvcGVuX3BhciBwOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIFcgYjpFWFBSXCIsXG4gICAgXSxcbiAgICBob29rczogW2xhbWJkYV9kZWYsIGxhbWJkYV9kZWZdXG4gIH0sXG4gIFwiRlVOQ19ERUZcIjoge3J1bGVzOltcbiAgICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIG9wZW5fcGFyIHA6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgYjpCTE9DS1wiLFxuICAgICAgXCJmZDpmdW5jdGlvbl9kZWYgVyBmbjpuYW1lIG9wZW5fcGFyIHA6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgYjpCTE9DS1wiLFxuICAgIF0sXG4gICAgaG9va3M6IFtmX2RlZiwgZl9kZWZdLFxuICAgIHZlcmJvc2U6XCJmdW5jdGlvbiBkZWZpbml0aW9uXCJcbiAgfSxcbiAgXCJFTFNFX0lGXCI6IHtydWxlczpbXCJzYW1lZGVudCBlbHNlaWYgZTpFWFBSIGI6QkxPQ0tcIl0sIGhvb2tzOltlbHNlX2lmX2RlZl19LFxuICBcIkVMU0VcIjoge3J1bGVzOltcInNhbWVkZW50IGVsc2UgYjpCTE9DS1wiXSwgaG9va3M6W2Vsc2VfZGVmXX0sXG4gIFwiSUZcIjoge3J1bGVzOltcImlmIGU6RVhQUiBiOkJMT0NLIGVsaWY6RUxTRV9JRiogZWw6RUxTRT9cIl0sIGhvb2tzOltpZl9kZWZdfSxcbiAgXCJNQVRIXCI6IHtydWxlczpbXCJlMTpFWFBSIFcgb3A6bWF0aCBXIGUyOkVYUFJcIl19LFxuICBcIlBBVEhcIjoge3J1bGVzOltcIlBBVEggZG90IG5hbWVcIiwgXCJQQVRIIG9wZW5fYnJhIG51bWJlciBjbG9zZV9icmFcIiwgXCJuYW1lXCJdfSxcbiAgXCJBU1NJR05cIjoge3J1bGVzOltcImxlZnQ6RVhQUiBXIG9wOmFzc2lnbiBXIHJpZ2h0OkVYUFJcIl0sIGhvb2tzOltcbiAgICBmdW5jdGlvbihwKXtcbiAgICAgIHJldHVybiB7bGVmdDpwLmxlZnQsIG9wOnAub3AsIHJpZ2h0OnAucmlnaHR9O1xuICAgIH1dXG4gIH0sXG4gIFwiRlVOQ19DQUxMX1BBUkFNU1wiOiB7cnVsZXM6W1wiRlVOQ19DQUxMX1BBUkFNUyBjb21tYSBXIEVYUFJcIiwgXCJFWFBSXCJdfSxcbiAgXCJGVU5DX0NBTExcIjoge3J1bGVzOltcIm5hbWUgb3Blbl9wYXIgRlVOQ19DQUxMX1BBUkFNUz8gY2xvc2VfcGFyXCJdfSxcblxuICBcIkZPUlwiOiB7cnVsZXM6W1xuICAgIFwiZm9yX2xvb3AgazpuYW1lIGNvbW1hIFcgdjpuYW1lIFcgaW4gYTpuYW1lIGI6QkxPQ0tcIixcbiAgICBcImZvcl9sb29wIHY6bmFtZSBXIGluIGE6bmFtZSBiOkJMT0NLXCJdLFxuICAgIGhvb2tzOiBbZm9yTG9vcCwgZm9yTG9vcF1cbiAgfSxcblxuICBcIkNPTU1BX1NFUEFSQVRFRF9FWFBSXCI6IHtydWxlczpbXG4gICAgXCJFWFBSIGNvbW1hIFNQQUNFKiBDT01NQV9TRVBBUkFURURfRVhQUlwiLFxuICAgIFwiRVhQUlwiXG4gIF19LFxuXG4gIFwiQVJSQVlcIjoge3J1bGVzOltcbiAgICBcIm9wZW5fYnJhIFNQQUNFKiBjOkNPTU1BX1NFUEFSQVRFRF9FWFBSPyBTUEFDRSogY2xvc2VfYnJhXCIsXG4gIF19LFxuXG4gIFwiTUVNQkVSU1wiOiB7cnVsZXM6W1xuICAgIFwibmFtZSBjb2xvbiBTUEFDRSogRVhQUiBjb21tYSBTUEFDRSogTUVNQkVSU1wiLFxuICAgIFwibmFtZSBjb2xvbiBTUEFDRSogRVhQUlwiXG4gIF19LFxuXG4gIFwiT0JKRUNUXCI6IHtydWxlczpbXG4gICAgXCJvcGVuX2N1cmx5IFNQQUNFKiBNRU1CRVJTPyBTUEFDRSogY2xvc2VfY3VybHlcIixcbiAgXX0sXG5cbiAgXCJUQUdfUEFSQU1TXCI6IHtydWxlczpbXG4gICAgICBcImxlZnQ6VEFHX1BBUkFNUyBXIHJpZ2h0OlRBR19QQVJBTVNcIixcbiAgICAgIFwibjpuYW1lIGFzc2lnbiBlOkVYUFJcIixcbiAgICAgIFwibjpuYW1lXCIsXG4gICAgXSxcbiAgICBob29rczpbXG4gICAgICBmdW5jdGlvbihwKXsgcmV0dXJuIHtsZWZ0OnAubGVmdCwgcmlnaHQ6cC5yaWdodH07fSxcbiAgICAgIGZ1bmN0aW9uKHApeyByZXR1cm4ge246cC5uLCBlOnAuZX07fSxcbiAgICAgIGZ1bmN0aW9uKHApeyByZXR1cm4ge246cC5ufTt9LFxuICAgIF0sXG4gICAgdmVyYm9zZTpcInRhZyBwYXJhbWV0ZXJzXCJcbiAgfSxcblxuICBcIlRBR1wiOiB7cnVsZXM6W1xuICAgIFwidGFnOnRhZyBXPyB0cDpUQUdfUEFSQU1TPyBiOkJMT0NLP1wiLFxuICBdLFxuICBob29rczpbXG4gICAgZnVuY3Rpb24ocCl7XG4gICAgICByZXR1cm4ge3RhZzpwLnRhZywgcGFyYW1zOnAudHAsIGJsb2NrOnAuYn07XG4gICAgfV1cbiAgfSxcblxuICBcIkRPTV9BU1NJR05cIjoge3J1bGVzOltcbiAgICBcImFzc2lnbiBFWFBSXCIsXG4gIF19LFxuXG4gIFwiU1BBQ0VcIjoge3J1bGVzOltcIldcIiwgXCJpbmRlbnRcIiwgXCJkZWRlbnRcIiwgXCJzYW1lZGVudFwiXX0sXG5cbiAgXCJSRVRVUk5cIjoge3J1bGVzOltcInJldCBXIEVYUFJcIiwgXCJyZXRcIl19LFxuICBcIlJJR0hUX0VYUFJcIjoge3J1bGVzOiBbXG4gICAgXCJtYXRoX29wZXJhdG9yc1wiLFxuICAgIFwiVyBiaW5hcnlfb3BlcmF0b3JzIFcgRVhQUlwiLFxuICAgIFwiVyBjb21wYXJpc29uIFcgRVhQUlwiLFxuICAgIFwiZG90IEVYUFJcIixcbiAgICBcIm9wZW5fYnJhIEVYUFIgY2xvc2VfYnJhXCIsXG4gICAgXSxcbiAgICB2ZXJib3NlOlwiZXhwcmVzc2lvblwiXG4gIH0sXG4gIFwiRVhQUlwiOiB7cnVsZXM6IFtcbiAgICBcIk1BVEhcIixcbiAgICBcIkVYUFIgUklHSFRfRVhQUlwiLFxuICAgIFwiRlVOQ19DQUxMXCIsXG4gICAgXCJGVU5DX0RFRlwiLFxuICAgIFwiTEFNQkRBXCIsXG4gICAgXCJudW1iZXJcIixcbiAgICBcIm9wZW5fcGFyIEVYUFIgY2xvc2VfcGFyXCIsXG4gICAgXCJzdHJpbmdcIixcbiAgICBcIm5hbWVcIixcbiAgICBcIlBBVEhcIixcbiAgICBcIkFSUkFZXCIsXG4gICAgXCJPQkpFQ1RcIl0sXG4gICAgdmVyYm9zZTpcImV4cHJlc3Npb25cIlxuICB9LFxufTtcblxuZnVuY3Rpb24gc3BhY2VyKG4pIHtcbiAgdmFyIG91dCA9IFwiXCI7XG4gIGZvcih2YXIgaT0wOyBpPG47IGkrKykge1xuICAgIG91dCArPSBcIiBcIjtcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZVBhcmFtcyhwcywgbnMpIHtcbiAgdmFyIHN0ciA9ICcnO1xuICBpZihwcyl7XG4gICAgdmFyIHBhcmFtcyA9IHBzLmNoaWxkcmVuO1xuICAgIGlmKHBhcmFtcykge1xuICAgICAgcGFyYW1zLm1hcChmdW5jdGlvbihwKSB7XG4gICAgICAgIGlmKHAudHlwZSA9PSAnbmFtZScpIHtcbiAgICAgICAgICBuc1twLnZhbHVlXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYocC5jaGlsZHJlbikge1xuICAgICAgICAgIHN0ciArPSBnZW5lcmF0ZVBhcmFtcyhwLCBucyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RyICs9IHAudmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gc3RyO1xufVxuXG5mdW5jdGlvbiBzcChtb2QpIHtcbiAgaWYobW9kKSB7XG4gICAgcmV0dXJuIHNwYWNlcigyICogKGRlcHRoK21vZCkpO1xuICB9XG4gIHJldHVybiBzcGFjZXIoMiAqIGRlcHRoKTtcbn1cblxudmFyIG5jID0gMTtcbi8vIGNoaWxkcmVuIG5hbWVcbmZ1bmN0aW9uIENOKCkge1xuICByZXR1cm4gJ19fYycgKyBuYztcbn1cbmZ1bmN0aW9uIHB1c2hDTigpIHtcbiAgbmMrKztcbiAgcmV0dXJuICdfX2MnICsgbmM7XG59XG5mdW5jdGlvbiBwb3BDTigpIHtcbiAgbmMtLTtcbiAgcmV0dXJuICdfX2MnICsgbmM7XG59XG5cbnZhciBiYWNrZW5kID0ge1xuXG4gICdkZWRlbnQnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgZGVwdGggPSBNYXRoLm1heCgwLCBkZXB0aCAtIDEpO1xuICAgIHJldHVybiAnJztcbiAgfSxcbiAgJ2luZGVudCc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBkZXB0aCA9IGRlcHRoICsgMTtcbiAgICByZXR1cm4gJ1xcbicrc3AoKTtcbiAgfSxcbiAgJ3NhbWVkZW50JzogZnVuY3Rpb24obm9kZSkge1xuICAgIHJldHVybiAnXFxuJytzcCgpO1xuICB9LFxuICAnRE9NJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBuYW1lID0gQ04oKSwgcGFyYW1zID0gXCJcIiwgZnVuY19uYW1lID0gXCJcIjtcbiAgICBpZihub2RlLmNoaWxkcmVuWzJdLmNoaWxkcmVuWzBdKSB7XG4gICAgICBmdW5jX25hbWUgPSBcIiBcIiArIG5vZGUuY2hpbGRyZW5bMl0uY2hpbGRyZW5bMF0udmFsdWU7XG4gICAgfVxuICAgIGlmKG5vZGUuY2hpbGRyZW5bMl0uY2hpbGRyZW5bMV0pIHtcbiAgICAgIHBhcmFtcyA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzJdLmNoaWxkcmVuWzFdKTtcbiAgICAgIC8vIFRPRE8gZGVmYXVsdCBwYXJhbXNcbiAgICB9XG4gICAgdmFyIHN0ciA9ICdmdW5jdGlvbicrZnVuY19uYW1lKycoJytwYXJhbXMrJyl7JztcbiAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArICd2YXIgJyArIG5hbWUgKyAnID0gW107JztcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bMl0uY2hpbGRyZW5bMl0pO1xuICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgJ3JldHVybiAnK25hbWUrJztcXG4nICsgc3AoKSArICd9JztcbiAgICByZXR1cm4gc3RyO1xuICB9LFxuICAnRE9NX0FTU0lHTic6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgbmFtZSA9IENOKCk7XG4gICAgcmV0dXJuIG5hbWUrJy5wdXNoKFN0cmluZygnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bMV0pICsgJykpJztcbiAgfSxcbiAgJ1RBR19QQVJBTVMnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5sZWZ0KSB7XG4gICAgICByZXR1cm4gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ubGVmdCkgKyAnLCAnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucmlnaHQpO1xuICAgIH1cbiAgICBpZihub2RlLmNoaWxkcmVuLmUpIHtcbiAgICAgIHJldHVybiBub2RlLmNoaWxkcmVuLm4udmFsdWUgKyAnOicgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG5vZGUuY2hpbGRyZW4ubi52YWx1ZSArICc6IHRydWUnO1xuICAgIH1cbiAgfSxcbiAgJ1RBRyc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgc3RyID0gJycsIGksIHBhcmFtcyA9IFwiXCI7XG4gICAgdmFyIG5hbWUgPSBub2RlLmNoaWxkcmVuLnRhZy52YWx1ZS5zdWJzdHJpbmcoMSk7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5wYXJhbXMpIHtcbiAgICAgIHZhciBwYXJhbXMgPSAneycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMpICsgJ30nO1xuICAgIH1cbiAgICB2YXIgc3ViID0gJ1tdJztcbiAgICBpZihub2RlLmNoaWxkcmVuLmJsb2NrKSB7XG4gICAgICBzdWIgPSBwdXNoQ04oKTtcbiAgICAgIHN0ciArPSAndmFyICcgKyBDTigpICsgJyA9IFtdOyc7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYmxvY2spO1xuICAgICAgcG9wQ04oKTtcbiAgICB9XG4gICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyBDTigpICsgJy5wdXNoKGgoXCInK25hbWUrJ1wiLCAnK3BhcmFtcysnLCAnK3N1YisnKSknO1xuICAgIHJldHVybiBzdHI7XG4gIH0sXG4gICdDTEFTUyc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgbmFtZSA9IG5vZGUuY2hpbGRyZW4ubmFtZS52YWx1ZSwgaTtcbiAgICB2YXIgZnVuY3MgPSBub2RlLmNoaWxkcmVuLm1ldGhvZHM7XG4gICAgdmFyIHBhcmVudCA9IG5vZGUuY2hpbGRyZW4ucGFyZW50O1xuICAgIHZhciBzdHIgPSAnJztcbiAgICB2YXIgY29uc3RydWN0b3IgPSBudWxsO1xuICAgIGZvcihpPTA7aTxmdW5jcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGZ1bmNfZGVmID0gZnVuY3NbaV0uY2hpbGRyZW47XG4gICAgICB2YXIgZnVuY19uYW1lID0gZnVuY19kZWYuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICBpZihmdW5jX25hbWUgPT09ICdjb25zdHJ1Y3RvcicpIHtcbiAgICAgICAgY29uc3RydWN0b3IgPSBmdW5jX2RlZjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSAnXFxuJyArIHNwKCkgKyBuYW1lICsgJy5wcm90b3R5cGUuJyArIGZ1bmNfbmFtZSArICcgPSAnICsgZ2VuZXJhdGVDb2RlKGZ1bmNfZGVmKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIG5zID0gY3VycmVudE5zKCk7XG4gICAgbnNbbmFtZV0gPSB0cnVlO1xuICAgIG5zID0gbmV3TnMoKTtcblxuICAgIHZhciBwYXJhbXMgPSBjb25zdHJ1Y3RvciAmJiBjb25zdHJ1Y3Rvci5jaGlsZHJlbi5wYXJhbXM7XG4gICAgaWYocGFyYW1zKSB7XG4gICAgICBwYXJhbXMgPSBnZW5lcmF0ZUNvZGUocGFyYW1zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGFyYW1zID0gJyc7XG4gICAgfVxuICAgIHZhciBib2R5ID0gY29uc3RydWN0b3IgJiYgY29uc3RydWN0b3IuY2hpbGRyZW4uYmxvY2s7XG4gICAgdmFyIGNvbnNfc3RyID0gJ3ZhciAnICsgbmFtZSArICcgPSBmdW5jdGlvbiAnICsgbmFtZSArICcoJysgcGFyYW1zICsgJykgeyc7XG4gICAgY29uc19zdHIgKz0gJ1xcbicrc3AoMSkrJ2lmKCEodGhpcyBpbnN0YW5jZW9mICcrbmFtZSsnKSl7IHJldHVybiBuZXcgJytuYW1lKycoJytPYmplY3Qua2V5cyhucykuam9pbignLCcpKycpO30nO1xuICAgIGZvcih2YXIga2V5IGluIG5zKSB7XG4gICAgICBpZihuc1trZXldICE9PSB0cnVlICYmIG5zW2tleV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zX3N0ciArPSAnXFxuJytzcCgxKSsnaWYoJytrZXkrJyA9PT0gdW5kZWZpbmVkKSB7JytrZXkrJyA9ICcrZ2VuZXJhdGVDb2RlKG5zW2tleV0pKyd9Oyc7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGJvZHkpIHtcbiAgICAgIGNvbnNfc3RyICs9IGdlbmVyYXRlQ29kZShib2R5KTtcbiAgICB9XG4gICAgY29uc19zdHIgKz0gc3AoKSArICdcXG59JztcblxuICAgIGlmKHBhcmVudCkge1xuICAgICAgY29uc19zdHIgKz0gJ1xcbicrc3AoKSArIG5hbWUgKyAnLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoJyArIHBhcmVudC52YWx1ZSArICcucHJvdG90eXBlKTsnO1xuICAgICAgY29uc19zdHIgKz0gJ1xcbicrc3AoKSArIG5hbWUgKyAnLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9ICcrbmFtZSsnJztcbiAgICAgIC8vY29uc19zdHIgKz0gJ1xcbicrc3AoKSArIG5hbWUgKyAnLnByb3RvdHlwZS5zdXBlciA9IGZ1bmN0aW9uKCl7JyArIHBhcmVudC52YWx1ZSArICcuYXBwbHkodGhpcywgYXJndW1lbnRzKTt9JztcbiAgICB9XG5cbiAgICBuYW1lc3BhY2VzLnBvcCgpO1xuICAgIHJldHVybiBjb25zX3N0ciArIHN0cjtcbiAgfSxcbiAgJ0ZVTkNfREVGJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBuYW1lID0gXCJcIjtcbiAgICB2YXIgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBpZihub2RlLmNoaWxkcmVuLmZuKSB7XG4gICAgICBuYW1lID0gbm9kZS5jaGlsZHJlbi5mbi52YWx1ZTtcbiAgICAgIG5zW25hbWVdID0gdHJ1ZTtcbiAgICB9XG4gICAgbnMgPSBuZXdOcygpO1xuICAgIHZhciBzdHIgPSBcImZ1bmN0aW9uIFwiICsgbmFtZSArIFwiKFwiO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ucGFyYW1zKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucGFyYW1zKTtcbiAgICB9XG4gICAgc3RyICs9ICcpIHsnO1xuICAgIGZvcih2YXIga2V5IGluIG5zKSB7XG4gICAgICBpZihuc1trZXldICE9PSB0cnVlICYmIG5zW2tleV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzdHIgKz0gJ1xcbicrc3AoMSkrJ2lmKCcra2V5KycgPT09IHVuZGVmaW5lZCkgeycra2V5KycgPSAnK2dlbmVyYXRlQ29kZShuc1trZXldKSsnfTsnO1xuICAgICAgfVxuICAgIH1cbiAgICBpZihub2RlLmNoaWxkcmVuLmRlZi52YWx1ZSA9PT0gJ2RvbScpIHtcbiAgICAgIHN0ciArPSAnXFxuJytzcCgxKSArICd2YXIgJyArIENOKCkgKyAnID0gW107JztcbiAgICB9XG5cbiAgICBpZihub2RlLmNoaWxkcmVuLmJsb2NrKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYmxvY2spO1xuICAgIH1cbiAgICBuYW1lc3BhY2VzLnBvcCgpO1xuXG4gICAgaWYobm9kZS5jaGlsZHJlbi5kZWYudmFsdWUgPT09ICdkb20nKSB7XG4gICAgICBzdHIgKz0gJ1xcbicrc3AoMSkgKyAncmV0dXJuICcgKyBDTigpICsgJzsnO1xuICAgIH1cbiAgICByZXR1cm4gc3RyICsgJ1xcbicrc3AoKSsnfSc7XG4gIH0sXG4gICdGVU5DX0RFRl9QQVJBTVMnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHN0ciA9IFwiXCIsIGk7XG4gICAgdmFyIG5zID0gY3VycmVudE5zKCk7XG4gICAgaWYobm9kZS5jaGlsZHJlblswXS50eXBlID09PSAnbmFtZScpIHtcbiAgICAgIG5zW25vZGUuY2hpbGRyZW5bMF0udmFsdWVdID0gdHJ1ZTtcbiAgICAgIGlmKG5vZGUuY2hpbGRyZW5bMV0gJiYgbm9kZS5jaGlsZHJlblsxXS50eXBlID09PSAnYXNzaWduJykge1xuICAgICAgICBuc1tub2RlLmNoaWxkcmVuWzBdLnZhbHVlXSA9IG5vZGUuY2hpbGRyZW5bMl07XG4gICAgICB9XG4gICAgfVxuICAgIGZvcihpPTA7aTxub2RlLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgbiA9IG5vZGUuY2hpbGRyZW5baV07XG4gICAgICBpZihuLnR5cGUgPT09ICduYW1lJyB8fCBuLnR5cGUgPT09ICdGVU5DX0RFRl9QQVJBTVMnIHx8IG4udHlwZSA9PT0gJ2NvbW1hJyB8fCBuLnR5cGUgPT09ICd3aW5kb3cnKSB7XG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbltpXSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG4gIH0sXG4gICdMQU1CREEnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG5hbWUgPSBcIlwiO1xuICAgIHZhciBucyA9IG5ld05zKCk7XG4gICAgaWYobm9kZS5jaGlsZHJlblswXSkge1xuICAgICAgbmFtZSA9IG5vZGUuY2hpbGRyZW5bMF0udmFsdWU7XG4gICAgfVxuICAgIHZhciBzdHIgPSBcImZ1bmN0aW9uIFwiICsgbmFtZSArIFwiKFwiO1xuICAgIGlmKG5vZGUuY2hpbGRyZW5bMV0pIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblsxXSwgbnMpO1xuICAgIH1cbiAgICBzdHIgKz0gJykgeyByZXR1cm4gJztcbiAgICBpZihub2RlLmNoaWxkcmVuWzJdKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bMl0sIG5zKTtcbiAgICB9XG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICByZXR1cm4gc3RyICsgXCI7IH1cIjtcbiAgfSxcbiAgJ0FTU0lHTic6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgcHJlZml4ID0gXCJcIjtcbiAgICB2YXIgb3AgPSBub2RlLmNoaWxkcmVuLm9wLnZhbHVlO1xuICAgIHZhciBucyA9IGN1cnJlbnROcygpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ubGVmdC5jaGlsZHJlblswXS50eXBlID09PSAnbmFtZScpIHtcbiAgICAgIHZhciBjaCA9IG5vZGUuY2hpbGRyZW4ubGVmdC5jaGlsZHJlblswXTtcbiAgICAgIGlmKG5zW2NoLnZhbHVlXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmKG9wID09ICc6PScpIHtcbiAgICAgICAgICBvcCA9ICc9JztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwcmVmaXggPSAndmFyICc7XG4gICAgICAgIH1cbiAgICAgICAgbnNbY2gudmFsdWVdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHByZWZpeCtnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5sZWZ0KSArICcgJyArIG9wICsgJyAnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucmlnaHQpO1xuICB9LFxuICAnU1RBVEVNRU5UJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblswXSkgKyAnOyc7XG4gIH0sXG4gICdJRic6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgc3RyID0gJyc7XG4gICAgc3RyID0gJ2lmKCcrZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bMF0pICsgJyl7JyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzFdKSArICdcXG4nK3NwKCkrJ30nO1xuICAgIGlmKG5vZGUuY2hpbGRyZW5bMl0pIHtcbiAgICAgIGlmKEFycmF5LmlzQXJyYXkobm9kZS5jaGlsZHJlblsyXSkpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBub2RlLmNoaWxkcmVuWzJdLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzJdW2ldKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzJdKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYobm9kZS5jaGlsZHJlblszXSkge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzNdKTtcbiAgICB9XG4gICAgcmV0dXJuIHN0cjtcbiAgfSxcbiAgJ0ZPUic6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIga2V5SW5kZXhOYW1lID0gXCJfaW5kZXhcIitmb3JMb29wQ291bnQ7XG4gICAgdmFyIGtleUFycmF5TmFtZSA9IFwiX2tleXNcIitmb3JMb29wQ291bnQ7XG4gICAgZm9yTG9vcENvdW50Kys7XG4gICAgdmFyIGluZGV4TmFtZSA9IGZhbHNlO1xuICAgIGlmKG5vZGUuY2hpbGRyZW5bMF0pIHtcbiAgICAgIGluZGV4TmFtZSA9IG5vZGUuY2hpbGRyZW5bMF0udmFsdWU7XG4gICAgfVxuICAgIHZhciBzdHIgPSAndmFyICcra2V5QXJyYXlOYW1lKycgPSBPYmplY3Qua2V5cygnK25vZGUuY2hpbGRyZW5bMl0udmFsdWUrJyk7XFxuJztcbiAgICBzdHIgKz0gc3AoKSArICdmb3IodmFyICcra2V5SW5kZXhOYW1lKycgPSAwOyAnK2tleUluZGV4TmFtZSsnIDwgJytrZXlBcnJheU5hbWUrJy5sZW5ndGg7ICcra2V5SW5kZXhOYW1lKycrKyApIHtcXG4nO1xuICAgIGlmKGluZGV4TmFtZSkge1xuICAgICAgc3RyICs9IHNwKDEpICsgJ3ZhciAnICsgaW5kZXhOYW1lICsgJyA9ICcgKyBrZXlBcnJheU5hbWUgKydbJyArIGtleUluZGV4TmFtZSArICddO1xcbic7XG4gICAgfVxuICAgIHN0ciArPSBzcCgxKSArICd2YXIgJyArIG5vZGUuY2hpbGRyZW5bMV0udmFsdWUgKyAnID0gJyArIG5vZGUuY2hpbGRyZW5bMl0udmFsdWUgKyAnWycgKyBrZXlBcnJheU5hbWUgKydbJyArIGtleUluZGV4TmFtZSArICddXTsnO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblszXSkgKydcXG4nK3NwKCkrJ30nO1xuICAgIHJldHVybiBzdHI7XG4gIH0sXG4gICdFTFNFX0lGJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHJldHVybiAnIGVsc2UgaWYoJytnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblswXSkrJykgeycrZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bMV0pKyAnXFxuJytzcCgpKyd9JztcbiAgfSxcbiAgJ0VMU0UnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgcmV0dXJuICcgZWxzZSB7JytnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblswXSkrICdcXG4nK3NwKCkrJ30nO1xuICB9LFxuICAnc3RyaW5nJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciB2ID0gbm9kZS52YWx1ZTtcbiAgICB2ID0gdi5yZXBsYWNlKC9cXG4vZywgXCJcXFxcXFxuXCIpO1xuICAgIC8vIGhhY2t5IHN0cmluZyBlc2NhcGluZyB3aXRoIHt9Li4uXG4gICAgaWYodi5pbmRleE9mKCd7JykgPiAtMSAmJiB2LmluZGV4T2YoJ30nKSA+IC0xKSB7XG4gICAgICB2ID0gdi5zcGxpdCgvey8pLm1hcChmdW5jdGlvbihpKSB7XG4gICAgICAgIHZhciBzID0gaS5zcGxpdCgvfS8pO1xuICAgICAgICBpZihzLmxlbmd0aD4xKSB7XG4gICAgICAgICAgcmV0dXJuICdcIiArICcgKyBzWzBdICsgJyArIFwiJyArIHNbMV07XG4gICAgICAgIH0gZWxzZSB7IHJldHVybiBpOyB9XG4gICAgICB9KS5qb2luKFwiXCIpO1xuICAgIH1cbiAgICByZXR1cm4gdjtcbiAgfSxcbiAgJ2NvbW1lbnQnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgcmV0dXJuIG5vZGUudmFsdWUucmVwbGFjZSgvXiMvZywgXCIvL1wiKTtcbiAgfSxcbn07XG5cbmZ1bmN0aW9uIGdlbmVyYXRlQ29kZShub2RlLCBucykge1xuICBpZighbm9kZSkge1xuICAgIC8vZGVidWdnZXJcbiAgfVxuICBpZihiYWNrZW5kW25vZGUudHlwZV0pIHtcbiAgICByZXR1cm4gYmFja2VuZFtub2RlLnR5cGVdKG5vZGUpO1xuICB9XG4gIGlmKG5vZGUudmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9XG4gIHZhciBzdHIgPSBcIlwiLCBpO1xuICBpZighbm9kZS5jaGlsZHJlbikge1xuICAgIHJldHVybiAnJztcbiAgfVxuICBmb3IoaT0wO2k8bm9kZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbltpXSwgbnMpO1xuICB9XG4gIHJldHVybiBzdHI7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlRXhwb3J0cyhrZXlzKSB7XG4gIHZhciBzdHIgPSAnXFxubW9kdWxlLmV4cG9ydHMgPSB7JztcbiAga2V5cyA9IGtleXMgfHwgT2JqZWN0LmtleXMoY3VycmVudE5zKCkpO1xuICBmb3IodmFyIGk9MDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcbiAgICBzdHIgKz0gJ1xcbiAgJyArIGtleXNbaV0gKyAnOiAnICsga2V5c1tpXSArICcsJztcbiAgfVxuICByZXR1cm4gc3RyICsgJ1xcbn0nO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZU1vZHVsZShpbnB1dCwgb3B0cykge1xuICByZXNldEdsb2JhbCgpO1xuICB2YXIgYXN0ID0gZ3JhbS5wYXJzZShpbnB1dCArIFwiXFxuXCIpO1xuICBpZighYXN0LmNvbXBsZXRlKSB7XG4gICAgdGhyb3cgYXN0LmhpbnQ7XG4gIH1cbiAgdmFyIG9iaiA9IHthc3Q6YXN0LCBjb2RlOmdlbmVyYXRlQ29kZShhc3QpLCBuczpjdXJyZW50TnMoKX07XG4gIHJldHVybiBvYmo7XG59XG5cbnZhciBlcGVnanMgPSByZXF1aXJlKFwiZXBlZ2pzXCIpO1xudmFyIGdyYW0gPSBlcGVnanMuY29tcGlsZUdyYW1tYXIoZ3JhbW1hckRlZiwgdG9rZW5EZWYpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZ3JhbW1hcjogZ3JhbSxcbiAgZ3JhbW1hckRlZjogZ3JhbW1hckRlZixcbiAgdG9rZW5EZWY6IHRva2VuRGVmLFxuICBnZW5lcmF0ZU1vZHVsZTogZ2VuZXJhdGVNb2R1bGUsXG4gIGdlbmVyYXRlQ29kZTogZ2VuZXJhdGVDb2RlLFxuICBnZW5lcmF0ZUV4cG9ydHM6IGdlbmVyYXRlRXhwb3J0c1xufTtcblxuIl19
