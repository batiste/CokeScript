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
  {key:">", reg:/^>/},
  {key:"dom", reg:/^DOM:/},
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
  {key:"string", func:stringDef},
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
  ]},

  "MEMBERS": {rules:[
    "name colon W EXPR comma W_OR_SAMEDENT? MEMBERS",
    "name colon W EXPR"
  ]},

  "OBJECT": {rules:[
    "open_curly MEMBERS? close_curly",
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
  'string': function(node) {
    var v = node.value;
    v = v.replace(/\n/g, "\\n");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb2tlc2NyaXB0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBRHhvQkE7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qXG4gIENva2VTY3JpcHQgbGFuZ3VhZ2UgYnkgQmF0aXN0ZSBCaWVsZXIgMjAxNVxuICBJbXBsZW1lbnRlZCB1c2luZyBFUEVHLkpTXG4qL1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBkZXB0aCA9IDA7XG52YXIgZm9yTG9vcENvdW50ID0gMTtcbnZhciBuYW1lc3BhY2VzID0gW3t9XTtcbnZhciBsZXZlbFN0YWNrID0gWzBdO1xuXG5mdW5jdGlvbiBjdXJyZW50TnMoKSB7XG4gIHJldHVybiBuYW1lc3BhY2VzW25hbWVzcGFjZXMubGVuZ3RoIC0xXTtcbn1cblxuZnVuY3Rpb24gbmV3TnMoKSB7XG4gIG5hbWVzcGFjZXMucHVzaCh7fSk7XG4gIHJldHVybiBuYW1lc3BhY2VzW25hbWVzcGFjZXMubGVuZ3RoIC0xXTtcbn1cblxuZnVuY3Rpb24gcmVzZXRHbG9iYWwoKSB7XG4gIG5hbWVzcGFjZXMgPSBbe31dO1xuICBmb3JMb29wQ291bnQgPSAxO1xuICBsZXZlbFN0YWNrID0gWzBdO1xuICBkZXB0aCA9IDA7XG59XG5cbi8vIHRva2VuIGFyZSBtYXRjaGVkIGluIG9yZGVyIG9mIGRlY2xhcmF0aW9uXG4vLyBUT0RPOiBhZGQgZnVuY3Rpb25zXG52YXIgdG9rZW5EZWYgPSBbXG4gIHtrZXk6XCJjb21tZW50XCIsIGZ1bmM6Y29tbWVudERlZn0sXG4gIHtrZXk6XCJmdW5jdGlvbl9kZWZcIiwgZnVuYzogZGVmRGVmLCB2ZXJib3NlOlwiZnVuY3Rpb24gZGVmaW5pdGlvblwifSxcbiAge2tleTpcImNsYXNzXCIsIHJlZzovXmNsYXNzIC99LFxuICB7a2V5OlwicmV0XCIsIHJlZzovXnJldHVybi8sIHZlcmJvc2U6XCJyZXR1cm5cIn0sXG4gIHtrZXk6XCJpZlwiLCByZWc6L15pZiAvfSxcbiAge2tleTpcInRhZ1wiLCByZWc6L148W2EtekEtWl8kXVswLTlhLXpBLVpfXXswLDI5fS99LFxuICB7a2V5OlwiPlwiLCByZWc6L14+L30sXG4gIHtrZXk6XCJkb21cIiwgcmVnOi9eRE9NOi99LFxuICB7a2V5OlwiZWxzZWlmXCIsIHJlZzovXmVsc2VpZiAvfSxcbiAge2tleTpcImVsc2VcIiwgcmVnOi9eZWxzZS99LFxuICB7a2V5OlwiZm9yX2xvb3BcIiwgcmVnOi9eZm9yIC8sIHZlcmJvc2U6XCJmb3IgbG9vcFwifSxcbiAge2tleTpcImluXCIsIHJlZzovXmluIC99LFxuICB7a2V5OlwibmFtZVwiLCByZWc6L15bYS16QS1aXyRdWzAtOWEtekEtWl9dezAsMjl9L30sIC8vIDMwIGNoYXJzIG1heFxuICB7a2V5OlwicmVnZXhwXCIsIGZ1bmM6cmVnRXhwRGVmLCB2ZXJib3NlOlwicmVndWxhciBlcHJlc3Npb25cIn0sXG4gIHtrZXk6XCJtYXRoX29wZXJhdG9yc1wiLCByZWc6L14oXFwrXFwrfFxcLVxcLSkvLCB2ZXJib3NlOlwibWF0aCBvcGVyYXRvclwifSxcbiAge2tleTpcImJpbmFyeV9vcGVyYXRvcnNcIiwgcmVnOi9eKFxcJlxcJnxcXHxcXHx8XFwmfFxcfHw8PHxcXD5cXD4pLywgdmVyYm9zZTpcImJpbmFyeSBvcGVyYXRvclwifSxcbiAge2tleTpcImNvbXBhcmlzb25cIiwgcmVnOi9eKDw9fD49fDx8PnwhPXw9PSkvfSxcbiAge2tleTpcImFzc2lnblwiLCByZWc6L14oXFwrPXwtPXw9fDo9KS99LFxuICB7a2V5OlwibnVtYmVyXCIsIHJlZzovXlswLTldK1xcLj9bMC05XSovfSwgLy8gb25seSBwb3NpdGl2ZSBmb3Igbm93XG4gIHtrZXk6XCJjb21tYVwiLCByZWc6L15cXCwvfSxcbiAge2tleTpcImRvdFwiLCByZWc6L15cXC4vfSxcbiAge2tleTpcImNvbG9uXCIsIHJlZzovXlxcOi8sIHZlcmJvc2U6XCI6XCJ9LFxuICB7a2V5Olwib3Blbl9wYXJcIiwgcmVnOi9eXFwoLywgdmVyYm9zZTpcIihcIn0sXG4gIHtrZXk6XCJjbG9zZV9wYXJcIiwgcmVnOi9eXFwpLywgdmVyYm9zZTpcIilcIn0sXG4gIHtrZXk6XCJvcGVuX2JyYVwiLCByZWc6L15cXFsvLCB2ZXJib3NlOlwiW1wifSxcbiAge2tleTpcImNsb3NlX2JyYVwiLCByZWc6L15cXF0vLCB2ZXJib3NlOlwiXVwifSxcbiAge2tleTpcIm9wZW5fY3VybHlcIiwgcmVnOi9eXFx7LywgdmVyYm9zZTpcIntcIn0sXG4gIHtrZXk6XCJjbG9zZV9jdXJseVwiLCByZWc6L15cXH0vLCB2ZXJib3NlOlwifVwifSxcbiAge2tleTpcIm1hdGhcIiwgcmVnOi9eWy18XFwrfFxcKnwvfCVdL30sXG4gIHtrZXk6XCJzYW1lZGVudFwiLCBmdW5jOmRlbnQoJ3NhbWVkZW50JyksIHZlcmJvc2U6XCJzYW1lIGluZGVudGF0aW9uXCJ9LFxuICB7a2V5OlwiZGVkZW50XCIsIGZ1bmM6ZGVudCgnZGVkZW50Jyl9LFxuICB7a2V5OlwiaW5kZW50XCIsIGZ1bmM6ZGVudCgnaW5kZW50Jyl9LFxuICAvL25ld2xpbmU6IC9eKFxccj9cXG58JCkvLFxuICB7a2V5OlwiV1wiLCByZWc6L15bIF0vLCB2ZXJib3NlOlwic2luZ2xlIHdoaXRlc3BhY2VcIn0sXG4gIHtrZXk6XCJzdHJpbmdcIiwgZnVuYzpzdHJpbmdEZWZ9LFxuXTtcblxuZnVuY3Rpb24gY3VycmVudExldmVsKCkge1xuICByZXR1cm4gbGV2ZWxTdGFja1tsZXZlbFN0YWNrLmxlbmd0aCAtIDFdO1xufVxuXG5mdW5jdGlvbiBpbmRlbnRUeXBlKGwpIHtcbiAgaWYobCA+IGN1cnJlbnRMZXZlbCgpKSB7XG4gICAgcmV0dXJuICdpbmRlbnQnO1xuICB9XG4gIGlmKGwgPCBjdXJyZW50TGV2ZWwoKSkge1xuICAgIHJldHVybiAnZGVkZW50JztcbiAgfVxuICBpZihsID09PSBjdXJyZW50TGV2ZWwoKSkge1xuICAgIHJldHVybiAnc2FtZWRlbnQnO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRlbnQoZGVudFR5cGUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIF9kZW50KGlucHV0KSB7XG5cbiAgICAvL3ZhciBibGFua19saW5lID0gaW5wdXQubWF0Y2goL15cXG5bIF0qXFxuLyk7XG4gICAgLy9pZihibGFua19saW5lICYmIGRlbnRUeXBlID09PSBcInNhbWVkZW50XCIpIHtcbiAgICAvLyAgcmV0dXJuIGlucHV0Lm1hdGNoKC9eXFxuWyBdKi8pWzBdO1xuICAgIC8vfVxuXG4gICAgdmFyIG0gPSBpbnB1dC5tYXRjaCgvXlxcblsgXSovKTtcbiAgICBpZihtKSB7XG4gICAgICB2YXIgaW5kZW50ID0gbVswXS5sZW5ndGggLSAxO1xuICAgICAgaWYoaW5kZW50VHlwZShpbmRlbnQpID09PSBkZW50VHlwZSkge1xuICAgICAgICBpZihkZW50VHlwZSA9PSAnZGVkZW50Jykge1xuICAgICAgICAgIGxldmVsU3RhY2sucG9wKCk7XG4gICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICB9XG4gICAgICAgIGlmKGRlbnRUeXBlID09ICdpbmRlbnQnKSB7XG4gICAgICAgICAgbGV2ZWxTdGFjay5wdXNoKGluZGVudCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1bMF07XG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuXG5mdW5jdGlvbiBzdHJpbmdEZWYoaW5wdXQpIHtcbiAgaWYoaW5wdXQuY2hhckF0KDApID09PSAnXCInKSB7XG4gICAgdmFyIGkgPSAxO1xuICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSkge1xuICAgICAgdmFyIGNoID0gaW5wdXQuY2hhckF0KGkpO1xuICAgICAgaWYoY2ggPT09ICdcXFxcJykge1xuICAgICAgICBpKys7XG4gICAgICB9IGVsc2UgaWYoY2ggPT09ICdcIicpIHtcbiAgICAgICAgcmV0dXJuIGlucHV0LnNsaWNlKDAsIGkrMSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHJlZ0V4cERlZihpbnB1dCkge1xuICBpZihpbnB1dC5jaGFyQXQoMCkgPT09ICcvJykge1xuICAgIHZhciBpID0gMTtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpIHtcbiAgICAgIHZhciBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxcXCcpIHtcbiAgICAgICAgaSsrO1xuICAgICAgfSBlbHNlIGlmKGNoID09PSAnLycpIHtcbiAgICAgICAgcmV0dXJuIGlucHV0LnNsaWNlKDAsIGkrMSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGRlZkRlZihpbnB1dCkge1xuICBpZihpbnB1dC5pbmRleE9mKFwiZGVmKFwiKSA9PT0gMCkge1xuICAgIHJldHVybiBcImRlZlwiO1xuICB9XG4gIGlmKGlucHV0LmluZGV4T2YoXCJkZWYgXCIpID09PSAwKSB7XG4gICAgcmV0dXJuIFwiZGVmXCI7XG4gIH1cbiAgLy9pZihpbnB1dC5pbmRleE9mKFwiZG9tKFwiKSA9PT0gMCkge1xuICAvLyAgcmV0dXJuIFwiZG9tXCI7XG4gIC8vfVxuICBpZihpbnB1dC5pbmRleE9mKFwiZG9tIFwiKSA9PT0gMCkge1xuICAgIHJldHVybiBcImRvbVwiO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbW1lbnREZWYoaW5wdXQpIHtcbiAgdmFyIG0gPSBpbnB1dC5tYXRjaCgvXlxcL1xcLy8pIHx8IGlucHV0Lm1hdGNoKC9eIy8pO1xuICBpZihtKSB7XG4gICAgdmFyIGkgPSBtWzBdLmxlbmd0aDtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpIHtcbiAgICAgIHZhciBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxuJykge1xuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGZfZGVmKHBhcmFtcykge1xuICByZXR1cm4ge2RlZjpwYXJhbXMuZmQsIGZuOnBhcmFtcy5mbiwgcGFyYW1zOnBhcmFtcy5wLCBibG9jazpwYXJhbXMuYn07XG59XG5cbmZ1bmN0aW9uIGxhbWJkYV9kZWYocGFyYW1zKSB7XG4gIHJldHVybiBbcGFyYW1zLmZuLCBwYXJhbXMucCwgcGFyYW1zLmJdO1xufVxuXG5mdW5jdGlvbiBlbHNlX2RlZihwYXJhbXMpIHtcbiAgcmV0dXJuIFtwYXJhbXMuYl07XG59XG5cbmZ1bmN0aW9uIGVsc2VfaWZfZGVmKHBhcmFtcykge1xuICByZXR1cm4gW3BhcmFtcy5lLCBwYXJhbXMuYl07XG59XG5cbmZ1bmN0aW9uIGlmX2RlZihwYXJhbXMpIHtcbiAgcmV0dXJuIFtwYXJhbXMuZSwgcGFyYW1zLmIsIHBhcmFtcy5lbGlmLCBwYXJhbXMuZWxdO1xufVxuXG5mdW5jdGlvbiBmb3JMb29wKHBhcmFtcykge1xuICByZXR1cm4gW3BhcmFtcy5rLCBwYXJhbXMudiwgcGFyYW1zLmEsIHBhcmFtcy5iXTtcbn1cblxudmFyIGdyYW1tYXJEZWYgPSB7XG4gIFwiU1RBUlRcIjoge3J1bGVzOltcIkxJTkUqIEVPRlwiXX0sXG4gIFwiTElORVwiOiB7cnVsZXM6W1wiU1RBVEVNRU5UIHNhbWVkZW50K1wiLCBcIlNUQVRFTUVOVCAhZGVkZW50XCIsIFwiY29tbWVudD8gc2FtZWRlbnRcIl0sIHZlcmJvc2U6XCJuZXcgbGluZVwifSxcbiAgXCJTVEFURU1FTlRcIjoge3J1bGVzOltcIkFTU0lHTlwiLCBcIklGXCIsIFwiRk9SXCIsIFwiRVhQUlwiLCBcIlJFVFVSTlwiLCBcIkNMQVNTXCIsIFwiVEFHXCIsIFwiRE9NX0FTU0lHTlwiXX0sXG4gIFwiQkxPQ0tcIjoge3J1bGVzOiBbXCJpbmRlbnQgTElORSsgZGVkZW50XCJdfSxcbiAgXCJDTEFTU19NRVRIT0RTXCI6IHtcbiAgICAgIHJ1bGVzOiBbXCJzYW1lZGVudCogZjpGVU5DX0RFRiBzYW1lZGVudCpcIl0sXG4gICAgICBob29rczogWyBmdW5jdGlvbihwKXsgcmV0dXJuIHAuZjsgfV1cbiAgfSxcbiAgXCJDTEFTU1wiOiB7XG4gICAgcnVsZXM6IFtcbiAgICAgIFwiY2xhc3MgbjpuYW1lIG9wZW5fcGFyIHA6bmFtZSBjbG9zZV9wYXIgaW5kZW50IG06Q0xBU1NfTUVUSE9EUysgZGVkZW50XCIsXG4gICAgICBcImNsYXNzIG46bmFtZSBpbmRlbnQgbTpDTEFTU19NRVRIT0RTKyBkZWRlbnRcIlxuICAgIF0sXG4gICAgaG9va3M6IFtcbiAgICAgIGZ1bmN0aW9uKHApeyByZXR1cm4ge25hbWU6cC5uLCBtZXRob2RzOnAubSwgcGFyZW50OnAucH07IH0sXG4gICAgICBmdW5jdGlvbihwKXsgcmV0dXJuIHtuYW1lOnAubiwgbWV0aG9kczpwLm19OyB9XG4gICAgXVxuICB9LFxuICBcIkZVTkNfREVGX1BBUkFNU1wiOiB7cnVsZXM6W1xuICAgICAgXCJwMTpGVU5DX0RFRl9QQVJBTVMgY29tbWEgVyBwMjpGVU5DX0RFRl9QQVJBTVNcIixcbiAgICAgIFwicDE6bmFtZSBhc3NpZ24gZTpFWFBSXCIsXG4gICAgICBcInAxOm5hbWVcIixcbiAgICBdLFxuICAgIHZlcmJvc2U6XCJmdW5jdGlvbiBwYXJhbWV0ZXJzXCJcbiAgfSxcbiAgXCJMQU1CREFcIjoge3J1bGVzOltcbiAgICAgIFwiZnVuY3Rpb25fZGVmIG9wZW5fcGFyIHA6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgVyBiOkVYUFJcIixcbiAgICAgIFwiZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBvcGVuX3BhciBwOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIFcgYjpFWFBSXCIsXG4gICAgXSxcbiAgICBob29rczogW2xhbWJkYV9kZWYsIGxhbWJkYV9kZWZdXG4gIH0sXG4gIFwiRlVOQ19ERUZcIjoge3J1bGVzOltcbiAgICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIG9wZW5fcGFyIHA6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgYjpCTE9DS1wiLFxuICAgICAgXCJmZDpmdW5jdGlvbl9kZWYgVyBmbjpuYW1lIG9wZW5fcGFyIHA6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgYjpCTE9DS1wiLFxuICAgIF0sXG4gICAgaG9va3M6IFtmX2RlZiwgZl9kZWZdLFxuICAgIHZlcmJvc2U6XCJmdW5jdGlvbiBkZWZpbml0aW9uXCJcbiAgfSxcbiAgXCJFTFNFX0lGXCI6IHtydWxlczpbXCJzYW1lZGVudCBlbHNlaWYgZTpFWFBSIGI6QkxPQ0tcIl0sIGhvb2tzOltlbHNlX2lmX2RlZl19LFxuICBcIkVMU0VcIjoge3J1bGVzOltcInNhbWVkZW50IGVsc2UgYjpCTE9DS1wiXSwgaG9va3M6W2Vsc2VfZGVmXX0sXG4gIFwiSUZcIjoge3J1bGVzOltcImlmIGU6RVhQUiBiOkJMT0NLIGVsaWY6RUxTRV9JRiogZWw6RUxTRT9cIl0sIGhvb2tzOltpZl9kZWZdfSxcbiAgXCJNQVRIXCI6IHtydWxlczpbXCJlMTpFWFBSIFcgb3A6bWF0aCBXIGUyOkVYUFJcIl19LFxuICBcIlBBVEhcIjoge3J1bGVzOltcIlBBVEggZG90IG5hbWVcIiwgXCJQQVRIIG9wZW5fYnJhIG51bWJlciBjbG9zZV9icmFcIiwgXCJuYW1lXCJdfSxcbiAgXCJBU1NJR05cIjoge3J1bGVzOltcImxlZnQ6RVhQUiBXIG9wOmFzc2lnbiBXIHJpZ2h0OkVYUFJcIl0sIGhvb2tzOltcbiAgICBmdW5jdGlvbihwKXtcbiAgICAgIHJldHVybiB7bGVmdDpwLmxlZnQsIG9wOnAub3AsIHJpZ2h0OnAucmlnaHR9O1xuICAgIH1dXG4gIH0sXG4gIFwiV19PUl9TQU1FREVOVFwiOiB7cnVsZXM6W1wiV1wiLCBcInNhbWVkZW50XCJdLCB2ZXJib3NlOiBcInNhbWVkZW50IG9yIHdoaXRlc3BhY2VcIn0sXG4gIFwiRlVOQ19DQUxMX1BBUkFNU1wiOiB7cnVsZXM6W1wiRlVOQ19DQUxMX1BBUkFNUyBjb21tYSBXX09SX1NBTUVERU5UIEVYUFIgc2FtZWRlbnQ/XCIsIFwiRVhQUiBzYW1lZGVudD9cIl19LFxuICBcIkZVTkNfQ0FMTFwiOiB7cnVsZXM6W1wibmFtZSBvcGVuX3BhciBGVU5DX0NBTExfUEFSQU1TPyBjbG9zZV9wYXJcIl19LFxuXG4gIFwiRk9SXCI6IHtydWxlczpbXG4gICAgXCJmb3JfbG9vcCBrOm5hbWUgY29tbWEgVyB2Om5hbWUgVyBpbiBhOm5hbWUgYjpCTE9DS1wiLFxuICAgIFwiZm9yX2xvb3AgdjpuYW1lIFcgaW4gYTpuYW1lIGI6QkxPQ0tcIl0sXG4gICAgaG9va3M6IFtmb3JMb29wLCBmb3JMb29wXVxuICB9LFxuXG4gIFwiQ09NTUFfU0VQQVJBVEVEX0VYUFJcIjoge3J1bGVzOltcbiAgICBcIkVYUFIgY29tbWEgV19PUl9TQU1FREVOVCBDT01NQV9TRVBBUkFURURfRVhQUlwiLFxuICAgIFwiRVhQUlwiXG4gIF19LFxuXG4gIFwiQVJSQVlcIjoge3J1bGVzOltcbiAgICBcIm9wZW5fYnJhIGM6Q09NTUFfU0VQQVJBVEVEX0VYUFI/IGNsb3NlX2JyYVwiLFxuICBdfSxcblxuICBcIk1FTUJFUlNcIjoge3J1bGVzOltcbiAgICBcIm5hbWUgY29sb24gVyBFWFBSIGNvbW1hIFdfT1JfU0FNRURFTlQ/IE1FTUJFUlNcIixcbiAgICBcIm5hbWUgY29sb24gVyBFWFBSXCJcbiAgXX0sXG5cbiAgXCJPQkpFQ1RcIjoge3J1bGVzOltcbiAgICBcIm9wZW5fY3VybHkgTUVNQkVSUz8gY2xvc2VfY3VybHlcIixcbiAgXX0sXG5cbiAgXCJUQUdfUEFSQU1TXCI6IHtydWxlczpbXG4gICAgICBcImxlZnQ6VEFHX1BBUkFNUyBXIHJpZ2h0OlRBR19QQVJBTVNcIixcbiAgICAgIFwibjpuYW1lIGFzc2lnbiBlOkVYUFJcIixcbiAgICAgIFwibjpuYW1lXCIsXG4gICAgXSxcbiAgICBob29rczpbXG4gICAgICBmdW5jdGlvbihwKXsgcmV0dXJuIHtsZWZ0OnAubGVmdCwgcmlnaHQ6cC5yaWdodH07fSxcbiAgICAgIGZ1bmN0aW9uKHApeyByZXR1cm4ge246cC5uLCBlOnAuZX07fSxcbiAgICAgIGZ1bmN0aW9uKHApeyByZXR1cm4ge246cC5ufTt9LFxuICAgIF0sXG4gICAgdmVyYm9zZTpcInRhZyBwYXJhbWV0ZXJzXCJcbiAgfSxcblxuICBcIlRBR1wiOiB7cnVsZXM6W1xuICAgIFwidGFnOnRhZyBXPyB0cDpUQUdfUEFSQU1TPyBlbmQ6Pj8gYjpCTE9DSz9cIixcbiAgXSxcbiAgaG9va3M6W1xuICAgIGZ1bmN0aW9uKHApe1xuICAgICAgcmV0dXJuIHt0YWc6cC50YWcsIHBhcmFtczpwLnRwLCBibG9jazpwLmJ9O1xuICAgIH1dXG4gIH0sXG5cbiAgXCJET01fQVNTSUdOXCI6IHtydWxlczpbXG4gICAgXCJhc3NpZ24gRVhQUlwiLFxuICBdfSxcblxuICBcIlJFVFVSTlwiOiB7cnVsZXM6W1wicmV0IFcgRVhQUlwiLCBcInJldFwiXX0sXG4gIFwiUklHSFRfRVhQUlwiOiB7cnVsZXM6IFtcbiAgICBcIm1hdGhfb3BlcmF0b3JzXCIsXG4gICAgXCJXIGJpbmFyeV9vcGVyYXRvcnMgVyBFWFBSXCIsXG4gICAgXCJXIGNvbXBhcmlzb24gVyBFWFBSXCIsXG4gICAgXCJXID4gVyBFWFBSXCIsXG4gICAgXCJkb3QgRVhQUlwiLFxuICAgIFwib3Blbl9icmEgRVhQUiBjbG9zZV9icmFcIixcbiAgICBdLFxuICAgIHZlcmJvc2U6XCJleHByZXNzaW9uXCJcbiAgfSxcbiAgXCJFWFBSXCI6IHtydWxlczogW1xuICAgIFwiTUFUSFwiLFxuICAgIFwiRVhQUiBSSUdIVF9FWFBSXCIsXG4gICAgXCJGVU5DX0NBTExcIixcbiAgICBcIkZVTkNfREVGXCIsXG4gICAgXCJMQU1CREFcIixcbiAgICBcIm51bWJlclwiLFxuICAgIFwicmVnZXhwXCIsXG4gICAgXCJvcGVuX3BhciBFWFBSIGNsb3NlX3BhclwiLFxuICAgIFwic3RyaW5nXCIsXG4gICAgXCJuYW1lXCIsXG4gICAgXCJQQVRIXCIsXG4gICAgXCJBUlJBWVwiLFxuICAgIFwiT0JKRUNUXCJdLFxuICAgIHZlcmJvc2U6XCJleHByZXNzaW9uXCJcbiAgfSxcbn07XG5cbmZ1bmN0aW9uIHNwYWNlcihuKSB7XG4gIHZhciBvdXQgPSBcIlwiO1xuICBmb3IodmFyIGk9MDsgaTxuOyBpKyspIHtcbiAgICBvdXQgKz0gXCIgXCI7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cblxuZnVuY3Rpb24gc3AobW9kKSB7XG4gIGlmKG1vZCkge1xuICAgIHJldHVybiBzcGFjZXIoMiAqIChkZXB0aCttb2QpKTtcbiAgfVxuICByZXR1cm4gc3BhY2VyKDIgKiBkZXB0aCk7XG59XG5cbnZhciBuYyA9IDE7XG4vLyBjaGlsZHJlbiBuYW1lXG5mdW5jdGlvbiBDTigpIHtcbiAgcmV0dXJuICdfX2MnICsgbmM7XG59XG5mdW5jdGlvbiBwdXNoQ04oKSB7XG4gIG5jKys7XG4gIHJldHVybiAnX19jJyArIG5jO1xufVxuZnVuY3Rpb24gcG9wQ04oKSB7XG4gIG5jLS07XG4gIHJldHVybiAnX19jJyArIG5jO1xufVxuXG52YXIgYmFja2VuZCA9IHtcblxuICAnZGVkZW50JzogZnVuY3Rpb24obm9kZSkge1xuICAgIGRlcHRoID0gTWF0aC5tYXgoMCwgZGVwdGggLSAxKTtcbiAgICByZXR1cm4gJyc7XG4gIH0sXG4gICdpbmRlbnQnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgZGVwdGggPSBkZXB0aCArIDE7XG4gICAgcmV0dXJuICdcXG4nK3NwKCk7XG4gIH0sXG4gICdzYW1lZGVudCc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICByZXR1cm4gJ1xcbicrc3AoKTtcbiAgfSxcbiAgJ0RPTV9BU1NJR04nOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG5hbWUgPSBDTigpO1xuICAgIHJldHVybiBuYW1lKycucHVzaChTdHJpbmcoJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzFdKSArICcpKSc7XG4gIH0sXG4gICdUQUdfUEFSQU1TJzogZnVuY3Rpb24obm9kZSkge1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ubGVmdCkge1xuICAgICAgcmV0dXJuIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmxlZnQpICsgJywgJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnJpZ2h0KTtcbiAgICB9XG4gICAgaWYobm9kZS5jaGlsZHJlbi5lKSB7XG4gICAgICByZXR1cm4gbm9kZS5jaGlsZHJlbi5uLnZhbHVlICsgJzonICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBub2RlLmNoaWxkcmVuLm4udmFsdWUgKyAnOiB0cnVlJztcbiAgICB9XG4gIH0sXG4gICdUQUcnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHN0ciA9ICcnLCBpLCBwYXJhbXMgPSBcIntcIjtcbiAgICB2YXIgbmFtZSA9IG5vZGUuY2hpbGRyZW4udGFnLnZhbHVlLnN1YnN0cmluZygxKTtcbiAgICBpZihub2RlLmNoaWxkcmVuLnBhcmFtcykge1xuICAgICAgcGFyYW1zICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnBhcmFtcyk7XG4gICAgfVxuICAgIHBhcmFtcyArPSAnfSc7XG4gICAgdmFyIHN1YiA9ICdbXSc7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgc3ViID0gcHVzaENOKCk7XG4gICAgICBzdHIgKz0gJ3ZhciAnICsgQ04oKSArICcgPSBbXTsnO1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrKTtcbiAgICAgIHBvcENOKCk7XG4gICAgfVxuICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgQ04oKSArICcucHVzaChoKFwiJytuYW1lKydcIiwgJytwYXJhbXMrJywgJytzdWIrJykpJztcbiAgICByZXR1cm4gc3RyO1xuICB9LFxuICAnQ0xBU1MnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG5hbWUgPSBub2RlLmNoaWxkcmVuLm5hbWUudmFsdWUsIGk7XG4gICAgdmFyIGZ1bmNzID0gbm9kZS5jaGlsZHJlbi5tZXRob2RzO1xuICAgIHZhciBwYXJlbnQgPSBub2RlLmNoaWxkcmVuLnBhcmVudDtcbiAgICB2YXIgc3RyID0gJyc7XG4gICAgdmFyIGNvbnN0cnVjdG9yID0gbnVsbDtcbiAgICBmb3IoaT0wO2k8ZnVuY3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBmdW5jX2RlZiA9IGZ1bmNzW2ldLmNoaWxkcmVuO1xuICAgICAgdmFyIGZ1bmNfbmFtZSA9IGZ1bmNfZGVmLmNoaWxkcmVuLmZuLnZhbHVlO1xuICAgICAgaWYoZnVuY19uYW1lID09PSAnY29uc3RydWN0b3InKSB7XG4gICAgICAgIGNvbnN0cnVjdG9yID0gZnVuY19kZWY7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgKz0gJ1xcbicgKyBzcCgpICsgbmFtZSArICcucHJvdG90eXBlLicgKyBmdW5jX25hbWUgKyAnID0gJyArIGdlbmVyYXRlQ29kZShmdW5jX2RlZik7XG4gICAgICB9XG4gICAgfVxuICAgIHZhciBucyA9IGN1cnJlbnROcygpO1xuICAgIG5zW25hbWVdID0gdHJ1ZTtcbiAgICBucyA9IG5ld05zKCk7XG5cbiAgICB2YXIgcGFyYW1zID0gY29uc3RydWN0b3IgJiYgY29uc3RydWN0b3IuY2hpbGRyZW4ucGFyYW1zO1xuICAgIGlmKHBhcmFtcykge1xuICAgICAgcGFyYW1zID0gZ2VuZXJhdGVDb2RlKHBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcmFtcyA9ICcnO1xuICAgIH1cbiAgICB2YXIgYm9keSA9IGNvbnN0cnVjdG9yICYmIGNvbnN0cnVjdG9yLmNoaWxkcmVuLmJsb2NrO1xuICAgIHZhciBjb25zX3N0ciA9ICd2YXIgJyArIG5hbWUgKyAnID0gZnVuY3Rpb24gJyArIG5hbWUgKyAnKCcrIHBhcmFtcyArICcpIHsnO1xuICAgIGNvbnNfc3RyICs9ICdcXG4nK3NwKDEpKydpZighKHRoaXMgaW5zdGFuY2VvZiAnK25hbWUrJykpeyByZXR1cm4gbmV3ICcrbmFtZSsnKCcrT2JqZWN0LmtleXMobnMpLmpvaW4oJywnKSsnKTt9JztcbiAgICBmb3IodmFyIGtleSBpbiBucykge1xuICAgICAgaWYobnNba2V5XSAhPT0gdHJ1ZSAmJiBuc1trZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc19zdHIgKz0gJ1xcbicrc3AoMSkrJ2lmKCcra2V5KycgPT09IHVuZGVmaW5lZCkgeycra2V5KycgPSAnK2dlbmVyYXRlQ29kZShuc1trZXldKSsnfTsnO1xuICAgICAgfVxuICAgIH1cbiAgICBpZihib2R5KSB7XG4gICAgICBjb25zX3N0ciArPSBnZW5lcmF0ZUNvZGUoYm9keSk7XG4gICAgfVxuICAgIGNvbnNfc3RyICs9IHNwKCkgKyAnXFxufSc7XG5cbiAgICBpZihwYXJlbnQpIHtcbiAgICAgIGNvbnNfc3RyICs9ICdcXG4nK3NwKCkgKyBuYW1lICsgJy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCcgKyBwYXJlbnQudmFsdWUgKyAnLnByb3RvdHlwZSk7JztcbiAgICAgIGNvbnNfc3RyICs9ICdcXG4nK3NwKCkgKyBuYW1lICsgJy5wcm90b3R5cGUuY29uc3RydWN0b3IgPSAnK25hbWUrJyc7XG4gICAgICAvL2NvbnNfc3RyICs9ICdcXG4nK3NwKCkgKyBuYW1lICsgJy5wcm90b3R5cGUuc3VwZXIgPSBmdW5jdGlvbigpeycgKyBwYXJlbnQudmFsdWUgKyAnLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7fSc7XG4gICAgfVxuXG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICByZXR1cm4gY29uc19zdHIgKyBzdHI7XG4gIH0sXG4gICdGVU5DX0RFRic6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgbmFtZSA9IFwiXCI7XG4gICAgdmFyIG5zID0gY3VycmVudE5zKCk7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5mbikge1xuICAgICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICBuc1tuYW1lXSA9IHRydWU7XG4gICAgfVxuICAgIG5zID0gbmV3TnMoKTtcbiAgICB2YXIgc3RyID0gXCJmdW5jdGlvbiBcIiArIG5hbWUgKyBcIihcIjtcbiAgICBpZihub2RlLmNoaWxkcmVuLnBhcmFtcykge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnBhcmFtcyk7XG4gICAgfVxuICAgIHN0ciArPSAnKSB7JztcbiAgICBmb3IodmFyIGtleSBpbiBucykge1xuICAgICAgaWYobnNba2V5XSAhPT0gdHJ1ZSAmJiBuc1trZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc3RyICs9ICdcXG4nK3NwKDEpKydpZignK2tleSsnID09PSB1bmRlZmluZWQpIHsnK2tleSsnID0gJytnZW5lcmF0ZUNvZGUobnNba2V5XSkrJ307JztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYobm9kZS5jaGlsZHJlbi5kZWYudmFsdWUgPT09ICdkb20nKSB7XG4gICAgICBzdHIgKz0gJ1xcbicrc3AoMSkgKyAndmFyICcgKyBDTigpICsgJyA9IFtdOyc7XG4gICAgfVxuXG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrKTtcbiAgICB9XG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcblxuICAgIGlmKG5vZGUuY2hpbGRyZW4uZGVmLnZhbHVlID09PSAnZG9tJykge1xuICAgICAgc3RyICs9ICdcXG4nK3NwKDEpICsgJ3JldHVybiAnICsgQ04oKSArICc7JztcbiAgICB9XG4gICAgcmV0dXJuIHN0ciArICdcXG4nK3NwKCkrJ30nO1xuICB9LFxuICAnRlVOQ19ERUZfUEFSQU1TJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBzdHIgPSBcIlwiLCBpO1xuICAgIHZhciBucyA9IGN1cnJlbnROcygpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW5bMF0udHlwZSA9PT0gJ25hbWUnKSB7XG4gICAgICBuc1tub2RlLmNoaWxkcmVuWzBdLnZhbHVlXSA9IHRydWU7XG4gICAgICBpZihub2RlLmNoaWxkcmVuWzFdICYmIG5vZGUuY2hpbGRyZW5bMV0udHlwZSA9PT0gJ2Fzc2lnbicpIHtcbiAgICAgICAgbnNbbm9kZS5jaGlsZHJlblswXS52YWx1ZV0gPSBub2RlLmNoaWxkcmVuWzJdO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IoaT0wO2k8bm9kZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIG4gPSBub2RlLmNoaWxkcmVuW2ldO1xuICAgICAgaWYobi50eXBlID09PSAnbmFtZScgfHwgbi50eXBlID09PSAnRlVOQ19ERUZfUEFSQU1TJyB8fCBuLnR5cGUgPT09ICdjb21tYScgfHwgbi50eXBlID09PSAnd2luZG93Jykge1xuICAgICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5baV0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc3RyO1xuICB9LFxuICAnTEFNQkRBJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBuYW1lID0gXCJcIjtcbiAgICB2YXIgbnMgPSBuZXdOcygpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW5bMF0pIHtcbiAgICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuWzBdLnZhbHVlO1xuICAgIH1cbiAgICB2YXIgc3RyID0gXCJmdW5jdGlvbiBcIiArIG5hbWUgKyBcIihcIjtcbiAgICBpZihub2RlLmNoaWxkcmVuWzFdKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bMV0sIG5zKTtcbiAgICB9XG4gICAgc3RyICs9ICcpIHsgcmV0dXJuICc7XG4gICAgaWYobm9kZS5jaGlsZHJlblsyXSkge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzJdLCBucyk7XG4gICAgfVxuICAgIG5hbWVzcGFjZXMucG9wKCk7XG4gICAgcmV0dXJuIHN0ciArIFwiOyB9XCI7XG4gIH0sXG4gICdBU1NJR04nOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHByZWZpeCA9IFwiXCI7XG4gICAgdmFyIG9wID0gbm9kZS5jaGlsZHJlbi5vcC52YWx1ZTtcbiAgICB2YXIgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBpZihub2RlLmNoaWxkcmVuLmxlZnQuY2hpbGRyZW5bMF0udHlwZSA9PT0gJ25hbWUnKSB7XG4gICAgICB2YXIgY2ggPSBub2RlLmNoaWxkcmVuLmxlZnQuY2hpbGRyZW5bMF07XG4gICAgICBpZihuc1tjaC52YWx1ZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZihvcCA9PSAnOj0nKSB7XG4gICAgICAgICAgb3AgPSAnPSc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcHJlZml4ID0gJ3ZhciAnO1xuICAgICAgICB9XG4gICAgICAgIG5zW2NoLnZhbHVlXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBwcmVmaXgrZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ubGVmdCkgKyAnICcgKyBvcCArICcgJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnJpZ2h0KTtcbiAgfSxcbiAgJ1NUQVRFTUVOVCc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICByZXR1cm4gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bMF0pICsgJzsnO1xuICB9LFxuICAnSUYnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHN0ciA9ICcnO1xuICAgIHN0ciA9ICdpZignK2dlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzBdKSArICcpeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblsxXSkgKyAnXFxuJytzcCgpKyd9JztcbiAgICBpZihub2RlLmNoaWxkcmVuWzJdKSB7XG4gICAgICBpZihBcnJheS5pc0FycmF5KG5vZGUuY2hpbGRyZW5bMl0pKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbm9kZS5jaGlsZHJlblsyXS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblsyXVtpXSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblsyXSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKG5vZGUuY2hpbGRyZW5bM10pIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblszXSk7XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG4gIH0sXG4gICdGT1InOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIGtleUluZGV4TmFtZSA9IFwiX2luZGV4XCIrZm9yTG9vcENvdW50O1xuICAgIHZhciBrZXlBcnJheU5hbWUgPSBcIl9rZXlzXCIrZm9yTG9vcENvdW50O1xuICAgIGZvckxvb3BDb3VudCsrO1xuICAgIHZhciBpbmRleE5hbWUgPSBmYWxzZTtcbiAgICBpZihub2RlLmNoaWxkcmVuWzBdKSB7XG4gICAgICBpbmRleE5hbWUgPSBub2RlLmNoaWxkcmVuWzBdLnZhbHVlO1xuICAgIH1cbiAgICB2YXIgc3RyID0gJ3ZhciAnK2tleUFycmF5TmFtZSsnID0gT2JqZWN0LmtleXMoJytub2RlLmNoaWxkcmVuWzJdLnZhbHVlKycpO1xcbic7XG4gICAgc3RyICs9IHNwKCkgKyAnZm9yKHZhciAnK2tleUluZGV4TmFtZSsnID0gMDsgJytrZXlJbmRleE5hbWUrJyA8ICcra2V5QXJyYXlOYW1lKycubGVuZ3RoOyAnK2tleUluZGV4TmFtZSsnKysgKSB7XFxuJztcbiAgICBpZihpbmRleE5hbWUpIHtcbiAgICAgIHN0ciArPSBzcCgxKSArICd2YXIgJyArIGluZGV4TmFtZSArICcgPSAnICsga2V5QXJyYXlOYW1lICsnWycgKyBrZXlJbmRleE5hbWUgKyAnXTtcXG4nO1xuICAgIH1cbiAgICBzdHIgKz0gc3AoMSkgKyAndmFyICcgKyBub2RlLmNoaWxkcmVuWzFdLnZhbHVlICsgJyA9ICcgKyBub2RlLmNoaWxkcmVuWzJdLnZhbHVlICsgJ1snICsga2V5QXJyYXlOYW1lICsnWycgKyBrZXlJbmRleE5hbWUgKyAnXV07JztcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bM10pICsnXFxuJytzcCgpKyd9JztcbiAgICByZXR1cm4gc3RyO1xuICB9LFxuICAnRUxTRV9JRic6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICByZXR1cm4gJyBlbHNlIGlmKCcrZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bMF0pKycpIHsnK2dlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzFdKSsgJ1xcbicrc3AoKSsnfSc7XG4gIH0sXG4gICdFTFNFJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHJldHVybiAnIGVsc2UgeycrZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bMF0pKyAnXFxuJytzcCgpKyd9JztcbiAgfSxcbiAgJ3N0cmluZyc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgdiA9IG5vZGUudmFsdWU7XG4gICAgdiA9IHYucmVwbGFjZSgvXFxuL2csIFwiXFxcXG5cIik7XG4gICAgLy8gaGFja3kgc3RyaW5nIGVzY2FwaW5nIHdpdGgge30uLi5cbiAgICBpZih2LmluZGV4T2YoJ3snKSA+IC0xICYmIHYuaW5kZXhPZignfScpID4gLTEpIHtcbiAgICAgIHYgPSB2LnNwbGl0KC97LykubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICAgICAgdmFyIHMgPSBpLnNwbGl0KC99Lyk7XG4gICAgICAgIGlmKHMubGVuZ3RoPjEpIHtcbiAgICAgICAgICByZXR1cm4gJ1wiICsgJyArIHNbMF0gKyAnICsgXCInICsgc1sxXTtcbiAgICAgICAgfSBlbHNlIHsgcmV0dXJuIGk7IH1cbiAgICAgIH0pLmpvaW4oXCJcIik7XG4gICAgfVxuICAgIHJldHVybiB2O1xuICB9LFxuICAnY29tbWVudCc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZS5yZXBsYWNlKC9eIy9nLCBcIi8vXCIpO1xuICB9LFxuICAnY29tcGFyaXNvbic6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBpZihub2RlLnZhbHVlID09ICc9PScpIHtcbiAgICAgIHJldHVybiAnPT09JztcbiAgICB9XG4gICAgaWYobm9kZS52YWx1ZSA9PSAnIT0nKSB7XG4gICAgICByZXR1cm4gJyE9PSc7XG4gICAgfVxuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9XG59O1xuXG5mdW5jdGlvbiBnZW5lcmF0ZUNvZGUobm9kZSwgbnMpIHtcbiAgaWYoIW5vZGUpIHtcbiAgICAvL2RlYnVnZ2VyXG4gIH1cbiAgaWYoYmFja2VuZFtub2RlLnR5cGVdKSB7XG4gICAgcmV0dXJuIGJhY2tlbmRbbm9kZS50eXBlXShub2RlKTtcbiAgfVxuICBpZihub2RlLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgfVxuICB2YXIgc3RyID0gXCJcIiwgaTtcbiAgaWYoIW5vZGUuY2hpbGRyZW4pIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgZm9yKGk9MDtpPG5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5baV0sIG5zKTtcbiAgfVxuICByZXR1cm4gc3RyO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZUV4cG9ydHMoa2V5cykge1xuICB2YXIgc3RyID0gJ1xcbm1vZHVsZS5leHBvcnRzID0geyc7XG4gIGtleXMgPSBrZXlzIHx8IE9iamVjdC5rZXlzKGN1cnJlbnROcygpKTtcbiAgZm9yKHZhciBpPTA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgc3RyICs9ICdcXG4gICcgKyBrZXlzW2ldICsgJzogJyArIGtleXNbaV0gKyAnLCc7XG4gIH1cbiAgcmV0dXJuIHN0ciArICdcXG59Jztcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVNb2R1bGUoaW5wdXQsIG9wdHMpIHtcbiAgcmVzZXRHbG9iYWwoKTtcbiAgdmFyIGFzdCA9IGdyYW0ucGFyc2UoaW5wdXQgKyBcIlxcblwiKTtcbiAgaWYoIWFzdC5jb21wbGV0ZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihhc3QuaGludCk7XG4gIH1cbiAgdmFyIG9iaiA9IHthc3Q6YXN0LCBjb2RlOmdlbmVyYXRlQ29kZShhc3QpLCBuczpjdXJyZW50TnMoKX07XG4gIHJldHVybiBvYmo7XG59XG5cbnZhciBlcGVnanMgPSByZXF1aXJlKFwiZXBlZ2pzXCIpO1xudmFyIGdyYW0gPSBlcGVnanMuY29tcGlsZUdyYW1tYXIoZ3JhbW1hckRlZiwgdG9rZW5EZWYpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZ3JhbW1hcjogZ3JhbSxcbiAgZ3JhbW1hckRlZjogZ3JhbW1hckRlZixcbiAgdG9rZW5EZWY6IHRva2VuRGVmLFxuICBnZW5lcmF0ZU1vZHVsZTogZ2VuZXJhdGVNb2R1bGUsXG4gIGdlbmVyYXRlQ29kZTogZ2VuZXJhdGVDb2RlLFxuICBnZW5lcmF0ZUV4cG9ydHM6IGdlbmVyYXRlRXhwb3J0c1xufTtcblxuIl19
