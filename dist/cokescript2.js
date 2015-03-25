!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.cokescript=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

// CokeScript language by Batiste Bieler 2015
// Implemented using EPEG.JS
var epegjs = require("epegjs");
var depth = 0;
var forLoopCount = 1;
var unpacking = 0;
var namespaces = [{}];
var levelStack = [0];
function currentNs() {
  return namespaces[namespaces.length - 1];
}
function newNs() {
  namespaces.push({});
  return namespaces[namespaces.length - 1];
}
function resetGlobal() {
  var namespaces = [{}];
  var forLoopCount = 1;
  var levelStack = [0];
  var depth = 0;
  var unpacking = 0;
};;// TODO: add functions
var tokenDef = [
  {key: "string", func: stringDef},
  {key: "comment", func: commentDef},
  {key: "function_def", func: defDef, verbose: "def definition"},
  {key: "class", reg: /^class /},
  {key: "ret", reg: /^return/, verbose: "return"},
  {key: "if", reg: /^if /},
  {key: "while", reg: /^while /},
  {key: "try", reg: /^try/},
  {key: "catch", reg: /^catch/},
  {key: "throw", reg: /^throw /},
  {key: "new", reg: /^new /},
  {key: "tag", reg: /^<[a-zA-Z][0-9a-zA-Z]{0,29}/},
  {key: ">", reg: /^>/},
  {key: "elseif", reg: /^elseif /},
  {key: "else", reg: /^else/},
  {key: "for_loop", reg: /^for /, verbose: "for loop"},
  {key: "in", reg: /^in /},
  {key: "not", reg: /^not /, verbose: "not"},
  {key: "name", reg: /^[a-zA-Z_$][0-9a-zA-Z_$]{0,29}/},
  {key: "regexp", func: regExpDef, verbose: "regular epression"},
  {key: "math_operators", reg: /^(\+\+|\-\-)/, verbose: "math operator"},
  {key: "binary_operators", reg: /^(\&\&|\|\||\&|\||<<|\>\>)/, verbose: "binary operator"},
  {key: "comparison", reg: /^(<=|>=|<|>|!=|==)/},
  {key: "assign", reg: /^(\+=|-=|=|:=)/},
  {key: "number", reg: /^[0-9]+\.?[0-9]*/},
  {key: "comma", reg: /^\,/},
  {key: "dot", reg: /^\./},
  {key: "colon", reg: /^\:/, verbose: ":"},
  {key: "open_par", reg: /^\(/, verbose: "("},
  {key: "close_par", reg: /^\)/, verbose: ")"},
  {key: "open_bra", reg: /^\[/, verbose: "["},
  {key: "close_bra", reg: /^\]/, verbose: "]"},
  {key: "open_curly", reg: /^\{/, verbose: "{"},
  {key: "close_curly", reg: /^\}/, verbose: "}"},
  {key: "math", reg: /^[-|\+|\*|\/|%]/},
  {key: "samedent", func: dent("samedent"), verbose: "same indentation"},
  {key: "dedent", func: dent("dedent")},
  {key: "indent", func: dent("indent")},
  {key: "W", reg: /^[ ]/, verbose: "single whitespace"}
];
function startStr(input,stream) {
  var last = stream[stream.length - 1];
  if(last && last.value === "\\"){
    return;
  };
  if(input.match(/^#{/)){
    return "#{";
  };
}
var strInterpolationTokenDef = [
  {key: "start", func: startStr},
  {key: "end", reg: /^}/},
  {key: "name", reg: /^[a-zA-Z_$][0-9a-zA-Z_]{0,29}/},
  {key: "dot", reg: /^\./},
  {key: "char", reg: /^./}
];
var strInterpolationGrammarDef = {
  START: {rules: ["EL* EOF"]},
  EL: {rules: ["VAR", "char", "name", "start", "end", "dot"]},
  VAR: {rules: ["start NAME end"]},
  NAME: {rules: ["name dot NAME", "name"]}
};
var strGram = epegjs.compileGrammar(strInterpolationGrammarDef, strInterpolationTokenDef);
function generateStringCode(node,c) {
  if(node.type === 'VAR'){
    return c + ' + ' + generateStringCode(node.children[1], c) + ' + ' + c;
  };
  if(node.value !== undefined){
    return node.value;
  };
  var str = "";
  if(!node.children){
    return '';
  };
  var children = node.children;
  var _keys1 = Object.keys(children);
  for(var _index1 = 0; _index1 < _keys1.length; _index1++ ) {
    var child = children[_keys1[_index1]];
    str += generateStringCode(child, c);
  }
  return str;
}
function currentLevel() {
  return levelStack[levelStack.length - 1];
}
function indentType(l) {
  if(l > currentLevel()){
    return 'indent';
  };
  if(l < currentLevel()){
    return 'dedent';
  };
  if(l === currentLevel()){
    return 'samedent';
  };
}
function dent(dentType) {
  return function _dent(input) {
    // empty line is a samedent
    var m = input.match(/^\n[\s]*/);
    if(m){
      var lines = m[0].split("\n");
      var indent = lines[lines.length - 1].length;
      if(indentType(indent) === dentType){
        if(dentType === 'dedent'){
          levelStack.pop();
          return '';
        };
        if(dentType === 'indent'){
          levelStack.push(indent);
        };
        return m[0];
      };
    };
  };
}
function stringDef(input) {
  var first = input.charAt(0);
  if(first === '"' || first === "'"){
    var i = 1;
    while(input.charAt(i)){
      var ch = input.charAt(i);
      if(ch === '\\'){
        i++;
      } else if(ch === first) {
        return input.slice(0, i + 1);
      };
      i++;
    }
  };
}
function regExpDef(input) {
  if(input.charAt(0) === '/'){
    var i = 1;
    while(input.charAt(i)){
      var ch = input.charAt(i);
      if(ch === '\\'){
        i++;
      } else if(ch === '/') {
        i++;;// modifiers
        while(input.charAt(i) && "igm".indexOf(input.charAt(i)) !== -1){
          i++;
        }
        return input.slice(0, i);
      };
      i++;
    }
  };
}
function defDef(input) {
  if(input.match(/^def[\(| |\n]/)){
    return "def";
  };
  if(input.indexOf("dom ") === 0){
    return "dom";
  };
}
function commentDef(input) {
  var m = input.match(/^#/);
  if(m){
    var i = m[0].length;
    while(input.charAt(i)){
      var ch = input.charAt(i);
      if(ch === '\n'){
        return input.slice(0, i);
      };
      i++;
    }
  };
}
function reflect(params) { return params; }
var grammarDef = {
  START: {rules: ["LINE* EOF"]},
  ELC: {rules: ["W* comment"], verbose: "comment"},
  LINE: {rules: ["STATEMENT ELC? samedent+", "STATEMENT ELC? !dedent", 
    "ELC? samedent", "ELC !dedent"], verbose: "new line"},
  BLOCK: {rules: ["indent LINE+ dedent"]},
  STATEMENT: {rules: ["ASSIGN", "EXPR", "IF", "WHILE", "FOR", "RETURN", 
    "CLASS", "TAG", "DOM_ASSIGN", "TRY_CATCH", "THROW"]},
  CLASS_METHODS: {
    rules: ["samedent* f:FUNC_DEF samedent*"],
    hooks: [function (p) { return p.f; }]
  },
  CLASS: {
    rules: [
      "class n:name open_par p:name close_par indent m:CLASS_METHODS+ dedent",
      "class n:name indent m:CLASS_METHODS+ dedent"
    ],
    hooks: [
      function (p) { return {name: p.n, methods: p.m, parent: p.p}; },
      function (p) { return {name: p.n, methods: p.m}; }
    ]
  },
  FUNC_DEF_PARAMS: {rules: [
    "p1:FUNC_DEF_PARAMS comma W p2:FUNC_DEF_PARAMS",
    "p1:name assign e:EXPR",
    "p1:name"
    ],
    verbose: "def parameters"
  },
  LAMBDA: {rules: [
    "fd:function_def open_par params:FUNC_DEF_PARAMS? close_par W block:EXPR",
    "fd:function_def W fn:name open_par params:FUNC_DEF_PARAMS? close_par W block:EXPR",
    "fd:function_def W block:EXPR"
    ],
    hooks: [reflect, reflect, reflect]
  },
  FUNC_DEF: {rules: [
    "fd:function_def open_par params:FUNC_DEF_PARAMS? close_par block:BLOCK",
    "fd:function_def W fn:name open_par params:FUNC_DEF_PARAMS? close_par block:BLOCK",
    "fd:function_def W fn:name block:BLOCK",
    "fd:function_def block:BLOCK"
    ],
    hooks: [reflect, reflect, reflect, reflect],
    verbose: "def definition"
  },
  ELSE_IF: {rules: ["samedent elseif e:EXPR b:BLOCK"], hooks: [reflect]},
  ELSE: {rules: ["samedent else b:BLOCK"], hooks: [reflect]},
  IF: {rules: ["if e:EXPR b:BLOCK elif:ELSE_IF* el:ELSE?"], hooks: [reflect]},
  ELSE_EXPR: {rules: ["W else W b:EXPR"], hooks: [reflect]},
  IF_EXPR: {rules: ["e:EXPR W if test:EXPR el:ELSE_EXPR?"], hooks: [reflect]},
  WHILE: {rules: ["while e:EXPR b:BLOCK"], hooks: [reflect]},
  MATH: {rules: ["e1:EXPR W op:math W e2:EXPR"]},
  PATH: {rules: ["PATH dot name", "PATH open_bra number close_bra", "name"]},
  ASSIGN: {rules: [
    "left:EXPR W op:assign W right:EXPR",
    "left:STRICT_COMMA_SEPARATED_EXPR W op:assign W right:STRICT_COMMA_SEPARATED_EXPR",
    "left:STRICT_COMMA_SEPARATED_EXPR W op:assign W right:EXPR"
  ], hooks: [reflect, reflect, reflect]},
  W_OR_SAMEDENT: {rules: ["W", "samedent"], verbose: "samedent or whitespace"},
  W_SAMEDENT_INDENT: {rules: ["W", "samedent", "indent"], verbose: "indent or samedent or whitespace"},
  ANY_SPACE: {rules: ["W", "samedent", "indent", "dedent"], verbose: "any space"},
  FUNC_CALL_PARAMS: {rules: ["EXPR comma ANY_SPACE+ FUNC_CALL_PARAMS ANY_SPACE*", "EXPR ANY_SPACE*"]},
  FUNC_CALL: {rules: [
    "open_par FUNC_CALL_PARAMS? close_par"
  ]},
  TYPE: {rules: ["name colon"]},
  FOR: {rules: [
    "for_loop k:name comma W v:name W in t:TYPE? a:name b:BLOCK",
    "for_loop v:name W in t:TYPE? a:name b:BLOCK"],
    hooks: [reflect, reflect]
  },
  STRICT_COMMA_SEPARATED_EXPR: {rules: [
    "e1:EXPR comma W e2:STRICT_COMMA_SEPARATED_EXPR",
    "e1:EXPR comma W e2:EXPR"
  ],
  hooks: [
    function (p) { return [p.e1].concat(p.e2.children); }, function (p) { return [p.e1, p.e2]; }
  ] 
  },
  COMMA_SEPARATED_EXPR: {rules: [
    "EXPR comma ANY_SPACE+ COMMA_SEPARATED_EXPR ANY_SPACE*",
    "EXPR ANY_SPACE*"
  ]},
  ARRAY: {rules: [
    "open_bra ANY_SPACE* c:COMMA_SEPARATED_EXPR? ANY_SPACE* close_bra"
  ]},
  MEMBERS: {rules: [
    "name colon W EXPR samedent? comma ANY_SPACE+ MEMBERS ANY_SPACE*",
    "name colon W EXPR ANY_SPACE*"
  ]},
  OBJECT: {rules: [
    "open_curly indent? MEMBERS? close_curly"
  ]},
  TAG_PARAMS: {rules: [
    "left:TAG_PARAMS W right:TAG_PARAMS",
    "n:name assign e:EXPR",
    "n:name"
    ],
    hooks: [reflect, reflect, reflect],
    verbose: "tag parameters"
  },
  TAG: {rules: [
    "tag:tag W? params:TAG_PARAMS? end:>? block:BLOCK?"
  ],
  hooks: [reflect]
  },
  DOM_ASSIGN: {rules: [
    "assign EXPR"
  ]},
  TRY_CATCH: {rules: [
    "try b1:BLOCK samedent? catch open_par err:name? close_par b2:BLOCK"
    ],
    hooks: [reflect]
  },
  THROW: {rules: [
    "throw EXPR"
  ]},
  RETURN: {rules: ["ret W STRICT_COMMA_SEPARATED_EXPR", "ret W EXPR", "ret"]},
  RIGHT_EXPR: {rules: [
    "math_operators",
    "W binary_operators W EXPR",
    "W comparison W EXPR",
    "W > W EXPR",
    "dot EXPR",
    "open_bra EXPR close_bra",
    "FUNC_CALL"
    ],
    verbose: "expression"
  },
  EXPR: {rules: [
    "IF_EXPR",
    "MATH",
    "OBJECT",
    "FUNC_DEF",
    "EXPR RIGHT_EXPR",
    "name",
    "number",
    "LAMBDA",
    "string",
    "regexp",
    "open_par EXPR close_par",
    "new EXPR",
    "not EXPR",
    "ARRAY"
    ],
    verbose: "expression"
  }
};
function spacer(n) {
  var out = "";
  var i = 0;
  while(i < n){
    out += " ";
    i++;
  }
  return out;
}
function sp(mod) {
  if(mod){
    return spacer(2 * (depth + mod));
  };
  return spacer(2 * depth);
}
var nc = 1;;// children name
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
  dedent: function (node) {
    var depth = Math.max(0, depth - 1);
    return '';
  }
  ,
  indent: function (node) {
    var depth = depth + 1;
    return '\n' + sp();
  }
  ,
  samedent: function (node) {
    return '\n' + sp();
  }
  ,
  DOM_ASSIGN: function (node) {
    var name = CN();
    return name + '.push(String(' + generateCode(node.children[1]) + '))';
  }
  ,
  TAG_PARAMS: function (node) {
    if(node.children.left){
      return generateCode(node.children.left) + ', ' + generateCode(node.children.right);
    };
    if(node.children.e){
      return node.children.n.value + ': ' + generateCode(node.children.e);
    } else {
      return node.children.n.value + ': true';
    };
  }
  ,
  TAG: function (node) {
    var str = '';
    var params = "{";
    var name = node.children.tag.value.substring(1);
    if(node.children.params){
      params += generateCode(node.children.params);
    };
    params += '}';
    var sub = '[]';
    if(node.children.block){
      sub = pushCN();
      str += '' + CN() + ' = []';
      str += generateCode(node.children.block);
      popCN();
    };
    str += '\n' + sp(1) + CN() + '.push(h("" + name + "", " + params + ", " + sub + "))';
    return str;
  }
  ,
  CLASS: function (node) {
    var name = node.children.name.value;
    var funcs = node.children.methods;
    var parent = node.children.parent;
    var str = '';
    constructor = null;
    var _keys2 = Object.keys(funcs);
    for(var _index2 = 0; _index2 < _keys2.length; _index2++ ) {
      var func = funcs[_keys2[_index2]];
      var func_def = func.children;
      var func_name = func_def.children.fn.value;
      if(func_name === 'constructor'){
        constructor = func_def;
      } else {
        str += '\n' + sp() + name + '.prototype.' + func_name + ' = ' + generateCode(func_def);
      };
    }
    var ns = currentNs();
    ns[name] = true;
    ns = newNs();
    var params = constructor && constructor.children.params;
    if(params){
      params = generateCode(params);
    } else {
      params = '';
    };
    var body = constructor && constructor.children.block;
    var cons_str = '' + name + ' = function ' + name + '(' + params + ') {';
    cons_str += '\n' + sp(1) + 'if(!(this instanceof " + name + ")){ return new " + name + "(' + Object.keys(ns).join(',') + ')}';
    var _keys3 = Object.keys(ns);
    for(var _index3 = 0; _index3 < _keys3.length; _index3++ ) {
      var key = _keys3[_index3];
      var value = ns[_keys3[_index3]];
      if(value !== true && value !== undefined){
        cons_str += '\n' + sp(1) + 'if(" + key + " === undefined) {" + key + " = ' + generateCode(value) + '}';
      };
    }
    if(body){
      cons_str += generateCode(body);
    };
    cons_str += sp() + '\n}';
    if(parent){
      cons_str += '\n' + sp() + '" + name + ".prototype = Object.create(' + parent.value + '.prototype)';
      cons_str += '\n' + sp() + '" + name + ".prototype.constructor = " + name + "';
    };
    namespaces.pop();
    return cons_str + str;
  }
  ,
  LAMBDA: function (node) {
    var name = "";
    var ns = newNs();
    if(node.children.fn){
      name = node.children.fn.value;
      ns[name] = true;
    };
    var str = "function " + name + "(";
    if(node.children.params){
      str += generateCode(node.children.params, ns);
    };
    str += ') {';
    var _keys4 = Object.keys(ns);
    for(var _index4 = 0; _index4 < _keys4.length; _index4++ ) {
      var key = _keys4[_index4];
      var value = ns[_keys4[_index4]];
      if(value !== true && value !== undefined){
        var code = generateCode(value);
        str += '\n' + sp(1) + 'if(" + key + " === undefined) {" + key + " = " + code + "}';
      };
    }
    if(node.children.block){
      str += ' return ' + generateCode(node.children.block, ns);
    };
    namespaces.pop();
    return str + "; }";
  }
  ,
  FUNC_DEF: function (node) {
    var name = "";
    var ns = currentNs();
    var is_dom = node.children.fd.value === 'dom';
    if(node.children.fn){
      name = node.children.fn.value;
      ns[name] = true;
    };
    ns = newNs();
    var str = "function " + name + "(";
    if(node.children.params){
      str += generateCode(node.children.params);
    };
    str += ') {';
    var _keys5 = Object.keys(ns);
    for(var _index5 = 0; _index5 < _keys5.length; _index5++ ) {
      var key = _keys5[_index5];
      var value = ns[_keys5[_index5]];
      if(value !== true && value !== undefined){
        var code = generateCode(value);
        str += '\n' + sp(1) + 'if(" + key + " === undefined) {" + key + " = " + code + ";}';
      };
    }
    if(is_dom){
      str += '\n' + sp(1) + '' + CN() + ' = [];';
    };
    if(node.children.block){
      str += generateCode(node.children.block);
    };
    namespaces.pop();
    if(is_dom){
      str += '\n' + sp(1) + 'return ' + CN() + ';';
    };
    return str + '\n' + sp() + '}';
  }
  ,
  FUNC_DEF_PARAMS: function (node) {
    var str = "";
    var ns = currentNs();
    if(node.children[0].type === 'name'){
      ns[node.children[0].value] = true;
      if(node.children[1] && node.children[1].type === 'assign'){
        ns[node.children[0].value] = node.children[2];
      };
    };;// TODO: fix this
    var children = node.children;
    var _keys6 = Object.keys(children);
    for(var _index6 = 0; _index6 < _keys6.length; _index6++ ) {
      var n = children[_keys6[_index6]];
      if(n.type === 'name' || n.type === 'FUNC_DEF_PARAMS' || n.type === 'comma' || n.type === 'window'){
        str += generateCode(n);
      };
    }
    return str;
  }
  ,
  ASSIGN: function (node) {
    var prefix = "";
    var str = "";
    var op = node.children.op.value;
    var explicit_global = op === ': =';
    if(op === ': ='){
      op = '=';
    };
    var ns = currentNs();
    var left = node.children.left;
    var right_code = generateCode(node.children.right);
    if(left.type === 'STRICT_COMMA_SEPARATED_EXPR'){
      unpacking++;
      var unpack_name = '__unpack' + unpacking;
      str += unpack_name + " = " + right_code + "\n" + sp();
      var children = left.children;
      var i = 0;
      var _keys7 = Object.keys(children);
      for(var _index7 = 0; _index7 < _keys7.length; _index7++ ) {
        var child = children[_keys7[_index7]];
        var n = child.children[0];
        prefix = "";
        if(n.type === 'name'){
          if(ns[n.value] === undefined){
            ns[n.value] = true;
            if(!explicit_global){
              prefix = '';
            };
          };
        };
        str += prefix + generateCode(n) + ' ' + op + ' ' + unpack_name + '[' + i + '];\n' + sp();
        i++;
      }
      return str;
    };
    if(left.children[0].type === 'name'){
      var ch = left.children[0];
      if(ns[ch.value] === undefined){
        if(!explicit_global){
          prefix = '';
        };
        ns[ch.value] = true;
      };
    };
    return prefix + generateCode(node.children.left) + ' ' + op + ' ' + right_code;
  }
  ,
  STATEMENT: function (node) {
    var e = node.children[0].children[0];;// TODO: this should be possible
    if(node.children[0].type === 'FOR' || node.children[0].type === 'TRY_CATCH' || node.children[0].type === 'WHILE' || e && (e.type === 'FUNC_DEF' || e.type === 'LAMBDA')){
      return generateCode(node.children[0]);
    };
    return generateCode(node.children[0]) + '';
  }
  ,
  IF: function (node) {
    var str = '';
    str = 'if(' + generateCode(node.children.e) + '){' + generateCode(node.children.b) + '\n' + sp() + '}';
    var elif = node.children.elif;
    if(elif){
      if(Array.isArray(elif)){
        var _keys8 = Object.keys(elif);
        for(var _index8 = 0; _index8 < _keys8.length; _index8++ ) {
          var value = elif[_keys8[_index8]];
          str += generateCode(value);
        }
      } else {
        str += generateCode(elif);
      };
    };
    if(node.children.el){
      str += generateCode(node.children.el);
    };
    return str;
  }
  ,
  IF_EXPR: function (node) {
    var str = '';
    str = generateCode(node.children.test) + ' ? ' + generateCode(node.children.e) + ' : ';
    if(node.children.el){
      str += generateCode(node.children.el);
    } else {
      str += 'undefined';
    };
    return str;
  }
  ,
  ELSE_EXPR: function (node) {
    return generateCode(node.children.b);
  }
  ,
  WHILE: function (node) {
    return 'while(' + generateCode(node.children.e) + '){' + generateCode(node.children.b) + '\n' + sp() + '}';
  }
  ,
  FOR: function (node) {
    var keyIndexName = "_index" + forLoopCount;
    var keyArrayName = "_keys" + forLoopCount;
    forLoopCount++;
    var indexName = false;
    if(node.children.k){
      indexName = node.children.k.value;
    };
    var str = '" + keyArrayName + " = Object.keys(' + node.children.a.value + ')\n';
    str += sp() + 'for(' + keyIndexName + '; ' + keyIndexName + ' = 0; ' + keyIndexName + ' < ' + keyArrayName + '.length; ' + keyIndexName + '++) {\n';
    if(indexName){
      str += sp(1) + '' + indexName + ' = ' + keyArrayName + '[' + keyIndexName + ']\n';
    };
    str += sp(1) + '' + node.children.v.value + ' = ' + node.children.a.value + '[' + keyArrayName + '[' + keyIndexName + ']]';
    str += generateCode(node.children.b) + '\n' + sp() + '}';
    return str;
  }
  ,
  ELSE_IF: function (node) {
    return ' else if(' + generateCode(node.children.e) + ') {' + generateCode(node.children.b) + '\n' + sp() + '}';
  }
  ,
  ELSE: function (node) {
    return ' else {' + generateCode(node.children.b) + '\n' + sp() + '}';
  }
  ,
  TRY_CATCH: function (node) {
    var str = "try {";
    str += generateCode(node.children.b1);
    str += '\n' + sp() + "} catch(" + generateCode(node.children.err) + ") {";
    str += generateCode(node.children.b2);
    return str + '\n' + sp() + "}";
  }
  ,
  STRICT_COMMA_SEPARATED_EXPR: function (node) {
    var elements = [];
    var children = node.children;
    var _keys9 = Object.keys(children);
    for(var _index9 = 0; _index9 < _keys9.length; _index9++ ) {
      var child = children[_keys9[_index9]];
      elements.push(generateCode(child));
    }
    return '[' + elements.join(", ") + ']';
  }
  ,
  string: function (node) {
    var v = node.value;
    v = v.replace(/\n/g, "\\n");
    var ast = strGram.parse(v);
    if(!ast.complete){
      throw new Error(ast.hint);
    };
    return generateStringCode(ast, v.charAt(0));
  }
  ,
  comment: function (node) {
    return node.value.replace(/^#/g, "//");
  }
  ,
  not: function (node) {
    return '!';
  }
  ,
  comparison: function (node) {
    if(node.value === '=='){
      return '===';
    };
    if(node.value === '!='){
      return '!==';
    };
    return node.value;
  }
};
function generateCode(node) {
  if(!node){
    // debugger
  };
  if(backend[node.type]){
    return backend[node.type](node);
  };
  if(node.value !== undefined){
    return node.value;
  };
  var str = "";
  if(!node.children){
    return '';
  };
  var children = node.children;
  var _keys10 = Object.keys(children);
  for(var _index10 = 0; _index10 < _keys10.length; _index10++ ) {
    var child = children[_keys10[_index10]];
    str += generateCode(child);
  }
  return str;
}
function generateExports(keys) {
  var str = '\nmodule.exports = {';
  keys = keys || Object.keys(currentNs());
  var _keys11 = Object.keys(keys);
  for(var _index11 = 0; _index11 < _keys11.length; _index11++ ) {
    var key = keys[_keys11[_index11]];
    str += '\n  ' + key + ': ' + key + ',';
  }
  return str + '\n}';
}
function generateModule(input,opts) {
  resetGlobal();
  var ast = gram.parse(input + "\n");
  if(!ast.complete){
    throw new Error(ast.hint);
  };
  var obj = {ast: ast, code: generateCode(ast), ns: currentNs()};
  return obj;
}
var gram = epegjs.compileGrammar(grammarDef, tokenDef);
module.exports = {
  grammar: gram,
  strGrammar: strGram,
  grammarDef: grammarDef,
  epegjs: epegjs,
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

    result.hook = hook;

    // it's very important to update the memoized value
    // this is actually growing the seed in the memoization
    memo.children = result.children;
    memo.sp = result.sp;
    memo.start = result.start;
    memo.hooked = result.hooked;
    memo.hook = result.hook;
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
          var r = expand_rules[j], hook = hooks[j];

          result = memoEval(grammar, r, stream, sp);

          if(result) {

            result.hook = hook;

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
            children: result.children,
            sp:result.sp,
            hook: result.hook,
            name: rtoken.name,
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
    var hooks = [];

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
      if(typeof line.hooks === "function") {
        hooks.push(line.hooks);
      } else if(line.hooks) {
        if(line.hooks[j] === undefined) {
          throw new Error("Incorrect number of hooks ar rule " + keys[i]); 
        }
        hooks.push(line.hooks[j]);
      }
    }
    gram[key] = {rules: splitted_rules, hooks: hooks || [], verbose:line.verbose};
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

function hookTree(node) {
  if(!node.children) {
    return;
  }
  for(var i=0; i<node.children.length; i++) {
    hookTree(node.children[i]);
  }
  if(node.hook) {
    node.children = node.hook(createParams(node.children));
  }
}

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
  hookTree(bestResult);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb2tlc2NyaXB0Mi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUR0d0JBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG4vLyBDb2tlU2NyaXB0IGxhbmd1YWdlIGJ5IEJhdGlzdGUgQmllbGVyIDIwMTVcbi8vIEltcGxlbWVudGVkIHVzaW5nIEVQRUcuSlNcbnZhciBlcGVnanMgPSByZXF1aXJlKFwiZXBlZ2pzXCIpO1xudmFyIGRlcHRoID0gMDtcbnZhciBmb3JMb29wQ291bnQgPSAxO1xudmFyIHVucGFja2luZyA9IDA7XG52YXIgbmFtZXNwYWNlcyA9IFt7fV07XG52YXIgbGV2ZWxTdGFjayA9IFswXTtcbmZ1bmN0aW9uIGN1cnJlbnROcygpIHtcbiAgcmV0dXJuIG5hbWVzcGFjZXNbbmFtZXNwYWNlcy5sZW5ndGggLSAxXTtcbn1cbmZ1bmN0aW9uIG5ld05zKCkge1xuICBuYW1lc3BhY2VzLnB1c2goe30pO1xuICByZXR1cm4gbmFtZXNwYWNlc1tuYW1lc3BhY2VzLmxlbmd0aCAtIDFdO1xufVxuZnVuY3Rpb24gcmVzZXRHbG9iYWwoKSB7XG4gIHZhciBuYW1lc3BhY2VzID0gW3t9XTtcbiAgdmFyIGZvckxvb3BDb3VudCA9IDE7XG4gIHZhciBsZXZlbFN0YWNrID0gWzBdO1xuICB2YXIgZGVwdGggPSAwO1xuICB2YXIgdW5wYWNraW5nID0gMDtcbn07Oy8vIFRPRE86IGFkZCBmdW5jdGlvbnNcbnZhciB0b2tlbkRlZiA9IFtcbiAge2tleTogXCJzdHJpbmdcIiwgZnVuYzogc3RyaW5nRGVmfSxcbiAge2tleTogXCJjb21tZW50XCIsIGZ1bmM6IGNvbW1lbnREZWZ9LFxuICB7a2V5OiBcImZ1bmN0aW9uX2RlZlwiLCBmdW5jOiBkZWZEZWYsIHZlcmJvc2U6IFwiZGVmIGRlZmluaXRpb25cIn0sXG4gIHtrZXk6IFwiY2xhc3NcIiwgcmVnOiAvXmNsYXNzIC99LFxuICB7a2V5OiBcInJldFwiLCByZWc6IC9ecmV0dXJuLywgdmVyYm9zZTogXCJyZXR1cm5cIn0sXG4gIHtrZXk6IFwiaWZcIiwgcmVnOiAvXmlmIC99LFxuICB7a2V5OiBcIndoaWxlXCIsIHJlZzogL153aGlsZSAvfSxcbiAge2tleTogXCJ0cnlcIiwgcmVnOiAvXnRyeS99LFxuICB7a2V5OiBcImNhdGNoXCIsIHJlZzogL15jYXRjaC99LFxuICB7a2V5OiBcInRocm93XCIsIHJlZzogL150aHJvdyAvfSxcbiAge2tleTogXCJuZXdcIiwgcmVnOiAvXm5ldyAvfSxcbiAge2tleTogXCJ0YWdcIiwgcmVnOiAvXjxbYS16QS1aXVswLTlhLXpBLVpdezAsMjl9L30sXG4gIHtrZXk6IFwiPlwiLCByZWc6IC9ePi99LFxuICB7a2V5OiBcImVsc2VpZlwiLCByZWc6IC9eZWxzZWlmIC99LFxuICB7a2V5OiBcImVsc2VcIiwgcmVnOiAvXmVsc2UvfSxcbiAge2tleTogXCJmb3JfbG9vcFwiLCByZWc6IC9eZm9yIC8sIHZlcmJvc2U6IFwiZm9yIGxvb3BcIn0sXG4gIHtrZXk6IFwiaW5cIiwgcmVnOiAvXmluIC99LFxuICB7a2V5OiBcIm5vdFwiLCByZWc6IC9ebm90IC8sIHZlcmJvc2U6IFwibm90XCJ9LFxuICB7a2V5OiBcIm5hbWVcIiwgcmVnOiAvXlthLXpBLVpfJF1bMC05YS16QS1aXyRdezAsMjl9L30sXG4gIHtrZXk6IFwicmVnZXhwXCIsIGZ1bmM6IHJlZ0V4cERlZiwgdmVyYm9zZTogXCJyZWd1bGFyIGVwcmVzc2lvblwifSxcbiAge2tleTogXCJtYXRoX29wZXJhdG9yc1wiLCByZWc6IC9eKFxcK1xcK3xcXC1cXC0pLywgdmVyYm9zZTogXCJtYXRoIG9wZXJhdG9yXCJ9LFxuICB7a2V5OiBcImJpbmFyeV9vcGVyYXRvcnNcIiwgcmVnOiAvXihcXCZcXCZ8XFx8XFx8fFxcJnxcXHx8PDx8XFw+XFw+KS8sIHZlcmJvc2U6IFwiYmluYXJ5IG9wZXJhdG9yXCJ9LFxuICB7a2V5OiBcImNvbXBhcmlzb25cIiwgcmVnOiAvXig8PXw+PXw8fD58IT18PT0pL30sXG4gIHtrZXk6IFwiYXNzaWduXCIsIHJlZzogL14oXFwrPXwtPXw9fDo9KS99LFxuICB7a2V5OiBcIm51bWJlclwiLCByZWc6IC9eWzAtOV0rXFwuP1swLTldKi99LFxuICB7a2V5OiBcImNvbW1hXCIsIHJlZzogL15cXCwvfSxcbiAge2tleTogXCJkb3RcIiwgcmVnOiAvXlxcLi99LFxuICB7a2V5OiBcImNvbG9uXCIsIHJlZzogL15cXDovLCB2ZXJib3NlOiBcIjpcIn0sXG4gIHtrZXk6IFwib3Blbl9wYXJcIiwgcmVnOiAvXlxcKC8sIHZlcmJvc2U6IFwiKFwifSxcbiAge2tleTogXCJjbG9zZV9wYXJcIiwgcmVnOiAvXlxcKS8sIHZlcmJvc2U6IFwiKVwifSxcbiAge2tleTogXCJvcGVuX2JyYVwiLCByZWc6IC9eXFxbLywgdmVyYm9zZTogXCJbXCJ9LFxuICB7a2V5OiBcImNsb3NlX2JyYVwiLCByZWc6IC9eXFxdLywgdmVyYm9zZTogXCJdXCJ9LFxuICB7a2V5OiBcIm9wZW5fY3VybHlcIiwgcmVnOiAvXlxcey8sIHZlcmJvc2U6IFwie1wifSxcbiAge2tleTogXCJjbG9zZV9jdXJseVwiLCByZWc6IC9eXFx9LywgdmVyYm9zZTogXCJ9XCJ9LFxuICB7a2V5OiBcIm1hdGhcIiwgcmVnOiAvXlstfFxcK3xcXCp8XFwvfCVdL30sXG4gIHtrZXk6IFwic2FtZWRlbnRcIiwgZnVuYzogZGVudChcInNhbWVkZW50XCIpLCB2ZXJib3NlOiBcInNhbWUgaW5kZW50YXRpb25cIn0sXG4gIHtrZXk6IFwiZGVkZW50XCIsIGZ1bmM6IGRlbnQoXCJkZWRlbnRcIil9LFxuICB7a2V5OiBcImluZGVudFwiLCBmdW5jOiBkZW50KFwiaW5kZW50XCIpfSxcbiAge2tleTogXCJXXCIsIHJlZzogL15bIF0vLCB2ZXJib3NlOiBcInNpbmdsZSB3aGl0ZXNwYWNlXCJ9XG5dO1xuZnVuY3Rpb24gc3RhcnRTdHIoaW5wdXQsc3RyZWFtKSB7XG4gIHZhciBsYXN0ID0gc3RyZWFtW3N0cmVhbS5sZW5ndGggLSAxXTtcbiAgaWYobGFzdCAmJiBsYXN0LnZhbHVlID09PSBcIlxcXFxcIil7XG4gICAgcmV0dXJuO1xuICB9O1xuICBpZihpbnB1dC5tYXRjaCgvXiN7Lykpe1xuICAgIHJldHVybiBcIiN7XCI7XG4gIH07XG59XG52YXIgc3RySW50ZXJwb2xhdGlvblRva2VuRGVmID0gW1xuICB7a2V5OiBcInN0YXJ0XCIsIGZ1bmM6IHN0YXJ0U3RyfSxcbiAge2tleTogXCJlbmRcIiwgcmVnOiAvXn0vfSxcbiAge2tleTogXCJuYW1lXCIsIHJlZzogL15bYS16QS1aXyRdWzAtOWEtekEtWl9dezAsMjl9L30sXG4gIHtrZXk6IFwiZG90XCIsIHJlZzogL15cXC4vfSxcbiAge2tleTogXCJjaGFyXCIsIHJlZzogL14uL31cbl07XG52YXIgc3RySW50ZXJwb2xhdGlvbkdyYW1tYXJEZWYgPSB7XG4gIFNUQVJUOiB7cnVsZXM6IFtcIkVMKiBFT0ZcIl19LFxuICBFTDoge3J1bGVzOiBbXCJWQVJcIiwgXCJjaGFyXCIsIFwibmFtZVwiLCBcInN0YXJ0XCIsIFwiZW5kXCIsIFwiZG90XCJdfSxcbiAgVkFSOiB7cnVsZXM6IFtcInN0YXJ0IE5BTUUgZW5kXCJdfSxcbiAgTkFNRToge3J1bGVzOiBbXCJuYW1lIGRvdCBOQU1FXCIsIFwibmFtZVwiXX1cbn07XG52YXIgc3RyR3JhbSA9IGVwZWdqcy5jb21waWxlR3JhbW1hcihzdHJJbnRlcnBvbGF0aW9uR3JhbW1hckRlZiwgc3RySW50ZXJwb2xhdGlvblRva2VuRGVmKTtcbmZ1bmN0aW9uIGdlbmVyYXRlU3RyaW5nQ29kZShub2RlLGMpIHtcbiAgaWYobm9kZS50eXBlID09PSAnVkFSJyl7XG4gICAgcmV0dXJuIGMgKyAnICsgJyArIGdlbmVyYXRlU3RyaW5nQ29kZShub2RlLmNoaWxkcmVuWzFdLCBjKSArICcgKyAnICsgYztcbiAgfTtcbiAgaWYobm9kZS52YWx1ZSAhPT0gdW5kZWZpbmVkKXtcbiAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgfTtcbiAgdmFyIHN0ciA9IFwiXCI7XG4gIGlmKCFub2RlLmNoaWxkcmVuKXtcbiAgICByZXR1cm4gJyc7XG4gIH07XG4gIHZhciBjaGlsZHJlbiA9IG5vZGUuY2hpbGRyZW47XG4gIHZhciBfa2V5czEgPSBPYmplY3Qua2V5cyhjaGlsZHJlbik7XG4gIGZvcih2YXIgX2luZGV4MSA9IDA7IF9pbmRleDEgPCBfa2V5czEubGVuZ3RoOyBfaW5kZXgxKysgKSB7XG4gICAgdmFyIGNoaWxkID0gY2hpbGRyZW5bX2tleXMxW19pbmRleDFdXTtcbiAgICBzdHIgKz0gZ2VuZXJhdGVTdHJpbmdDb2RlKGNoaWxkLCBjKTtcbiAgfVxuICByZXR1cm4gc3RyO1xufVxuZnVuY3Rpb24gY3VycmVudExldmVsKCkge1xuICByZXR1cm4gbGV2ZWxTdGFja1tsZXZlbFN0YWNrLmxlbmd0aCAtIDFdO1xufVxuZnVuY3Rpb24gaW5kZW50VHlwZShsKSB7XG4gIGlmKGwgPiBjdXJyZW50TGV2ZWwoKSl7XG4gICAgcmV0dXJuICdpbmRlbnQnO1xuICB9O1xuICBpZihsIDwgY3VycmVudExldmVsKCkpe1xuICAgIHJldHVybiAnZGVkZW50JztcbiAgfTtcbiAgaWYobCA9PT0gY3VycmVudExldmVsKCkpe1xuICAgIHJldHVybiAnc2FtZWRlbnQnO1xuICB9O1xufVxuZnVuY3Rpb24gZGVudChkZW50VHlwZSkge1xuICByZXR1cm4gZnVuY3Rpb24gX2RlbnQoaW5wdXQpIHtcbiAgICAvLyBlbXB0eSBsaW5lIGlzIGEgc2FtZWRlbnRcbiAgICB2YXIgbSA9IGlucHV0Lm1hdGNoKC9eXFxuW1xcc10qLyk7XG4gICAgaWYobSl7XG4gICAgICB2YXIgbGluZXMgPSBtWzBdLnNwbGl0KFwiXFxuXCIpO1xuICAgICAgdmFyIGluZGVudCA9IGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdLmxlbmd0aDtcbiAgICAgIGlmKGluZGVudFR5cGUoaW5kZW50KSA9PT0gZGVudFR5cGUpe1xuICAgICAgICBpZihkZW50VHlwZSA9PT0gJ2RlZGVudCcpe1xuICAgICAgICAgIGxldmVsU3RhY2sucG9wKCk7XG4gICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICB9O1xuICAgICAgICBpZihkZW50VHlwZSA9PT0gJ2luZGVudCcpe1xuICAgICAgICAgIGxldmVsU3RhY2sucHVzaChpbmRlbnQpO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gbVswXTtcbiAgICAgIH07XG4gICAgfTtcbiAgfTtcbn1cbmZ1bmN0aW9uIHN0cmluZ0RlZihpbnB1dCkge1xuICB2YXIgZmlyc3QgPSBpbnB1dC5jaGFyQXQoMCk7XG4gIGlmKGZpcnN0ID09PSAnXCInIHx8IGZpcnN0ID09PSBcIidcIil7XG4gICAgdmFyIGkgPSAxO1xuICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSl7XG4gICAgICB2YXIgY2ggPSBpbnB1dC5jaGFyQXQoaSk7XG4gICAgICBpZihjaCA9PT0gJ1xcXFwnKXtcbiAgICAgICAgaSsrO1xuICAgICAgfSBlbHNlIGlmKGNoID09PSBmaXJzdCkge1xuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSArIDEpO1xuICAgICAgfTtcbiAgICAgIGkrKztcbiAgICB9XG4gIH07XG59XG5mdW5jdGlvbiByZWdFeHBEZWYoaW5wdXQpIHtcbiAgaWYoaW5wdXQuY2hhckF0KDApID09PSAnLycpe1xuICAgIHZhciBpID0gMTtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpe1xuICAgICAgdmFyIGNoID0gaW5wdXQuY2hhckF0KGkpO1xuICAgICAgaWYoY2ggPT09ICdcXFxcJyl7XG4gICAgICAgIGkrKztcbiAgICAgIH0gZWxzZSBpZihjaCA9PT0gJy8nKSB7XG4gICAgICAgIGkrKzs7Ly8gbW9kaWZpZXJzXG4gICAgICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSAmJiBcImlnbVwiLmluZGV4T2YoaW5wdXQuY2hhckF0KGkpKSAhPT0gLTEpe1xuICAgICAgICAgIGkrKztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSk7XG4gICAgICB9O1xuICAgICAgaSsrO1xuICAgIH1cbiAgfTtcbn1cbmZ1bmN0aW9uIGRlZkRlZihpbnB1dCkge1xuICBpZihpbnB1dC5tYXRjaCgvXmRlZltcXCh8IHxcXG5dLykpe1xuICAgIHJldHVybiBcImRlZlwiO1xuICB9O1xuICBpZihpbnB1dC5pbmRleE9mKFwiZG9tIFwiKSA9PT0gMCl7XG4gICAgcmV0dXJuIFwiZG9tXCI7XG4gIH07XG59XG5mdW5jdGlvbiBjb21tZW50RGVmKGlucHV0KSB7XG4gIHZhciBtID0gaW5wdXQubWF0Y2goL14jLyk7XG4gIGlmKG0pe1xuICAgIHZhciBpID0gbVswXS5sZW5ndGg7XG4gICAgd2hpbGUoaW5wdXQuY2hhckF0KGkpKXtcbiAgICAgIHZhciBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxuJyl7XG4gICAgICAgIHJldHVybiBpbnB1dC5zbGljZSgwLCBpKTtcbiAgICAgIH07XG4gICAgICBpKys7XG4gICAgfVxuICB9O1xufVxuZnVuY3Rpb24gcmVmbGVjdChwYXJhbXMpIHsgcmV0dXJuIHBhcmFtczsgfVxudmFyIGdyYW1tYXJEZWYgPSB7XG4gIFNUQVJUOiB7cnVsZXM6IFtcIkxJTkUqIEVPRlwiXX0sXG4gIEVMQzoge3J1bGVzOiBbXCJXKiBjb21tZW50XCJdLCB2ZXJib3NlOiBcImNvbW1lbnRcIn0sXG4gIExJTkU6IHtydWxlczogW1wiU1RBVEVNRU5UIEVMQz8gc2FtZWRlbnQrXCIsIFwiU1RBVEVNRU5UIEVMQz8gIWRlZGVudFwiLCBcbiAgICBcIkVMQz8gc2FtZWRlbnRcIiwgXCJFTEMgIWRlZGVudFwiXSwgdmVyYm9zZTogXCJuZXcgbGluZVwifSxcbiAgQkxPQ0s6IHtydWxlczogW1wiaW5kZW50IExJTkUrIGRlZGVudFwiXX0sXG4gIFNUQVRFTUVOVDoge3J1bGVzOiBbXCJBU1NJR05cIiwgXCJFWFBSXCIsIFwiSUZcIiwgXCJXSElMRVwiLCBcIkZPUlwiLCBcIlJFVFVSTlwiLCBcbiAgICBcIkNMQVNTXCIsIFwiVEFHXCIsIFwiRE9NX0FTU0lHTlwiLCBcIlRSWV9DQVRDSFwiLCBcIlRIUk9XXCJdfSxcbiAgQ0xBU1NfTUVUSE9EUzoge1xuICAgIHJ1bGVzOiBbXCJzYW1lZGVudCogZjpGVU5DX0RFRiBzYW1lZGVudCpcIl0sXG4gICAgaG9va3M6IFtmdW5jdGlvbiAocCkgeyByZXR1cm4gcC5mOyB9XVxuICB9LFxuICBDTEFTUzoge1xuICAgIHJ1bGVzOiBbXG4gICAgICBcImNsYXNzIG46bmFtZSBvcGVuX3BhciBwOm5hbWUgY2xvc2VfcGFyIGluZGVudCBtOkNMQVNTX01FVEhPRFMrIGRlZGVudFwiLFxuICAgICAgXCJjbGFzcyBuOm5hbWUgaW5kZW50IG06Q0xBU1NfTUVUSE9EUysgZGVkZW50XCJcbiAgICBdLFxuICAgIGhvb2tzOiBbXG4gICAgICBmdW5jdGlvbiAocCkgeyByZXR1cm4ge25hbWU6IHAubiwgbWV0aG9kczogcC5tLCBwYXJlbnQ6IHAucH07IH0sXG4gICAgICBmdW5jdGlvbiAocCkgeyByZXR1cm4ge25hbWU6IHAubiwgbWV0aG9kczogcC5tfTsgfVxuICAgIF1cbiAgfSxcbiAgRlVOQ19ERUZfUEFSQU1TOiB7cnVsZXM6IFtcbiAgICBcInAxOkZVTkNfREVGX1BBUkFNUyBjb21tYSBXIHAyOkZVTkNfREVGX1BBUkFNU1wiLFxuICAgIFwicDE6bmFtZSBhc3NpZ24gZTpFWFBSXCIsXG4gICAgXCJwMTpuYW1lXCJcbiAgICBdLFxuICAgIHZlcmJvc2U6IFwiZGVmIHBhcmFtZXRlcnNcIlxuICB9LFxuICBMQU1CREE6IHtydWxlczogW1xuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIG9wZW5fcGFyIHBhcmFtczpGVU5DX0RFRl9QQVJBTVM/IGNsb3NlX3BhciBXIGJsb2NrOkVYUFJcIixcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGZuOm5hbWUgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIFcgYmxvY2s6RVhQUlwiLFxuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgYmxvY2s6RVhQUlwiXG4gICAgXSxcbiAgICBob29rczogW3JlZmxlY3QsIHJlZmxlY3QsIHJlZmxlY3RdXG4gIH0sXG4gIEZVTkNfREVGOiB7cnVsZXM6IFtcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBvcGVuX3BhciBwYXJhbXM6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgYmxvY2s6QkxPQ0tcIixcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGZuOm5hbWUgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIGJsb2NrOkJMT0NLXCIsXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgVyBmbjpuYW1lIGJsb2NrOkJMT0NLXCIsXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgYmxvY2s6QkxPQ0tcIlxuICAgIF0sXG4gICAgaG9va3M6IFtyZWZsZWN0LCByZWZsZWN0LCByZWZsZWN0LCByZWZsZWN0XSxcbiAgICB2ZXJib3NlOiBcImRlZiBkZWZpbml0aW9uXCJcbiAgfSxcbiAgRUxTRV9JRjoge3J1bGVzOiBbXCJzYW1lZGVudCBlbHNlaWYgZTpFWFBSIGI6QkxPQ0tcIl0sIGhvb2tzOiBbcmVmbGVjdF19LFxuICBFTFNFOiB7cnVsZXM6IFtcInNhbWVkZW50IGVsc2UgYjpCTE9DS1wiXSwgaG9va3M6IFtyZWZsZWN0XX0sXG4gIElGOiB7cnVsZXM6IFtcImlmIGU6RVhQUiBiOkJMT0NLIGVsaWY6RUxTRV9JRiogZWw6RUxTRT9cIl0sIGhvb2tzOiBbcmVmbGVjdF19LFxuICBFTFNFX0VYUFI6IHtydWxlczogW1wiVyBlbHNlIFcgYjpFWFBSXCJdLCBob29rczogW3JlZmxlY3RdfSxcbiAgSUZfRVhQUjoge3J1bGVzOiBbXCJlOkVYUFIgVyBpZiB0ZXN0OkVYUFIgZWw6RUxTRV9FWFBSP1wiXSwgaG9va3M6IFtyZWZsZWN0XX0sXG4gIFdISUxFOiB7cnVsZXM6IFtcIndoaWxlIGU6RVhQUiBiOkJMT0NLXCJdLCBob29rczogW3JlZmxlY3RdfSxcbiAgTUFUSDoge3J1bGVzOiBbXCJlMTpFWFBSIFcgb3A6bWF0aCBXIGUyOkVYUFJcIl19LFxuICBQQVRIOiB7cnVsZXM6IFtcIlBBVEggZG90IG5hbWVcIiwgXCJQQVRIIG9wZW5fYnJhIG51bWJlciBjbG9zZV9icmFcIiwgXCJuYW1lXCJdfSxcbiAgQVNTSUdOOiB7cnVsZXM6IFtcbiAgICBcImxlZnQ6RVhQUiBXIG9wOmFzc2lnbiBXIHJpZ2h0OkVYUFJcIixcbiAgICBcImxlZnQ6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSIFcgb3A6YXNzaWduIFcgcmlnaHQ6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSXCIsXG4gICAgXCJsZWZ0OlNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUiBXIG9wOmFzc2lnbiBXIHJpZ2h0OkVYUFJcIlxuICBdLCBob29rczogW3JlZmxlY3QsIHJlZmxlY3QsIHJlZmxlY3RdfSxcbiAgV19PUl9TQU1FREVOVDoge3J1bGVzOiBbXCJXXCIsIFwic2FtZWRlbnRcIl0sIHZlcmJvc2U6IFwic2FtZWRlbnQgb3Igd2hpdGVzcGFjZVwifSxcbiAgV19TQU1FREVOVF9JTkRFTlQ6IHtydWxlczogW1wiV1wiLCBcInNhbWVkZW50XCIsIFwiaW5kZW50XCJdLCB2ZXJib3NlOiBcImluZGVudCBvciBzYW1lZGVudCBvciB3aGl0ZXNwYWNlXCJ9LFxuICBBTllfU1BBQ0U6IHtydWxlczogW1wiV1wiLCBcInNhbWVkZW50XCIsIFwiaW5kZW50XCIsIFwiZGVkZW50XCJdLCB2ZXJib3NlOiBcImFueSBzcGFjZVwifSxcbiAgRlVOQ19DQUxMX1BBUkFNUzoge3J1bGVzOiBbXCJFWFBSIGNvbW1hIEFOWV9TUEFDRSsgRlVOQ19DQUxMX1BBUkFNUyBBTllfU1BBQ0UqXCIsIFwiRVhQUiBBTllfU1BBQ0UqXCJdfSxcbiAgRlVOQ19DQUxMOiB7cnVsZXM6IFtcbiAgICBcIm9wZW5fcGFyIEZVTkNfQ0FMTF9QQVJBTVM/IGNsb3NlX3BhclwiXG4gIF19LFxuICBUWVBFOiB7cnVsZXM6IFtcIm5hbWUgY29sb25cIl19LFxuICBGT1I6IHtydWxlczogW1xuICAgIFwiZm9yX2xvb3AgazpuYW1lIGNvbW1hIFcgdjpuYW1lIFcgaW4gdDpUWVBFPyBhOm5hbWUgYjpCTE9DS1wiLFxuICAgIFwiZm9yX2xvb3AgdjpuYW1lIFcgaW4gdDpUWVBFPyBhOm5hbWUgYjpCTE9DS1wiXSxcbiAgICBob29rczogW3JlZmxlY3QsIHJlZmxlY3RdXG4gIH0sXG4gIFNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUjoge3J1bGVzOiBbXG4gICAgXCJlMTpFWFBSIGNvbW1hIFcgZTI6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSXCIsXG4gICAgXCJlMTpFWFBSIGNvbW1hIFcgZTI6RVhQUlwiXG4gIF0sXG4gIGhvb2tzOiBbXG4gICAgZnVuY3Rpb24gKHApIHsgcmV0dXJuIFtwLmUxXS5jb25jYXQocC5lMi5jaGlsZHJlbik7IH0sIGZ1bmN0aW9uIChwKSB7IHJldHVybiBbcC5lMSwgcC5lMl07IH1cbiAgXSBcbiAgfSxcbiAgQ09NTUFfU0VQQVJBVEVEX0VYUFI6IHtydWxlczogW1xuICAgIFwiRVhQUiBjb21tYSBBTllfU1BBQ0UrIENPTU1BX1NFUEFSQVRFRF9FWFBSIEFOWV9TUEFDRSpcIixcbiAgICBcIkVYUFIgQU5ZX1NQQUNFKlwiXG4gIF19LFxuICBBUlJBWToge3J1bGVzOiBbXG4gICAgXCJvcGVuX2JyYSBBTllfU1BBQ0UqIGM6Q09NTUFfU0VQQVJBVEVEX0VYUFI/IEFOWV9TUEFDRSogY2xvc2VfYnJhXCJcbiAgXX0sXG4gIE1FTUJFUlM6IHtydWxlczogW1xuICAgIFwibmFtZSBjb2xvbiBXIEVYUFIgc2FtZWRlbnQ/IGNvbW1hIEFOWV9TUEFDRSsgTUVNQkVSUyBBTllfU1BBQ0UqXCIsXG4gICAgXCJuYW1lIGNvbG9uIFcgRVhQUiBBTllfU1BBQ0UqXCJcbiAgXX0sXG4gIE9CSkVDVDoge3J1bGVzOiBbXG4gICAgXCJvcGVuX2N1cmx5IGluZGVudD8gTUVNQkVSUz8gY2xvc2VfY3VybHlcIlxuICBdfSxcbiAgVEFHX1BBUkFNUzoge3J1bGVzOiBbXG4gICAgXCJsZWZ0OlRBR19QQVJBTVMgVyByaWdodDpUQUdfUEFSQU1TXCIsXG4gICAgXCJuOm5hbWUgYXNzaWduIGU6RVhQUlwiLFxuICAgIFwibjpuYW1lXCJcbiAgICBdLFxuICAgIGhvb2tzOiBbcmVmbGVjdCwgcmVmbGVjdCwgcmVmbGVjdF0sXG4gICAgdmVyYm9zZTogXCJ0YWcgcGFyYW1ldGVyc1wiXG4gIH0sXG4gIFRBRzoge3J1bGVzOiBbXG4gICAgXCJ0YWc6dGFnIFc/IHBhcmFtczpUQUdfUEFSQU1TPyBlbmQ6Pj8gYmxvY2s6QkxPQ0s/XCJcbiAgXSxcbiAgaG9va3M6IFtyZWZsZWN0XVxuICB9LFxuICBET01fQVNTSUdOOiB7cnVsZXM6IFtcbiAgICBcImFzc2lnbiBFWFBSXCJcbiAgXX0sXG4gIFRSWV9DQVRDSDoge3J1bGVzOiBbXG4gICAgXCJ0cnkgYjE6QkxPQ0sgc2FtZWRlbnQ/IGNhdGNoIG9wZW5fcGFyIGVycjpuYW1lPyBjbG9zZV9wYXIgYjI6QkxPQ0tcIlxuICAgIF0sXG4gICAgaG9va3M6IFtyZWZsZWN0XVxuICB9LFxuICBUSFJPVzoge3J1bGVzOiBbXG4gICAgXCJ0aHJvdyBFWFBSXCJcbiAgXX0sXG4gIFJFVFVSTjoge3J1bGVzOiBbXCJyZXQgVyBTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFJcIiwgXCJyZXQgVyBFWFBSXCIsIFwicmV0XCJdfSxcbiAgUklHSFRfRVhQUjoge3J1bGVzOiBbXG4gICAgXCJtYXRoX29wZXJhdG9yc1wiLFxuICAgIFwiVyBiaW5hcnlfb3BlcmF0b3JzIFcgRVhQUlwiLFxuICAgIFwiVyBjb21wYXJpc29uIFcgRVhQUlwiLFxuICAgIFwiVyA+IFcgRVhQUlwiLFxuICAgIFwiZG90IEVYUFJcIixcbiAgICBcIm9wZW5fYnJhIEVYUFIgY2xvc2VfYnJhXCIsXG4gICAgXCJGVU5DX0NBTExcIlxuICAgIF0sXG4gICAgdmVyYm9zZTogXCJleHByZXNzaW9uXCJcbiAgfSxcbiAgRVhQUjoge3J1bGVzOiBbXG4gICAgXCJJRl9FWFBSXCIsXG4gICAgXCJNQVRIXCIsXG4gICAgXCJPQkpFQ1RcIixcbiAgICBcIkZVTkNfREVGXCIsXG4gICAgXCJFWFBSIFJJR0hUX0VYUFJcIixcbiAgICBcIm5hbWVcIixcbiAgICBcIm51bWJlclwiLFxuICAgIFwiTEFNQkRBXCIsXG4gICAgXCJzdHJpbmdcIixcbiAgICBcInJlZ2V4cFwiLFxuICAgIFwib3Blbl9wYXIgRVhQUiBjbG9zZV9wYXJcIixcbiAgICBcIm5ldyBFWFBSXCIsXG4gICAgXCJub3QgRVhQUlwiLFxuICAgIFwiQVJSQVlcIlxuICAgIF0sXG4gICAgdmVyYm9zZTogXCJleHByZXNzaW9uXCJcbiAgfVxufTtcbmZ1bmN0aW9uIHNwYWNlcihuKSB7XG4gIHZhciBvdXQgPSBcIlwiO1xuICB2YXIgaSA9IDA7XG4gIHdoaWxlKGkgPCBuKXtcbiAgICBvdXQgKz0gXCIgXCI7XG4gICAgaSsrO1xuICB9XG4gIHJldHVybiBvdXQ7XG59XG5mdW5jdGlvbiBzcChtb2QpIHtcbiAgaWYobW9kKXtcbiAgICByZXR1cm4gc3BhY2VyKDIgKiAoZGVwdGggKyBtb2QpKTtcbiAgfTtcbiAgcmV0dXJuIHNwYWNlcigyICogZGVwdGgpO1xufVxudmFyIG5jID0gMTs7Ly8gY2hpbGRyZW4gbmFtZVxuZnVuY3Rpb24gQ04oKSB7XG4gIHJldHVybiAnX19jJyArIG5jO1xufVxuZnVuY3Rpb24gcHVzaENOKCkge1xuICBuYysrO1xuICByZXR1cm4gJ19fYycgKyBuYztcbn1cbmZ1bmN0aW9uIHBvcENOKCkge1xuICBuYy0tO1xuICByZXR1cm4gJ19fYycgKyBuYztcbn1cbnZhciBiYWNrZW5kID0ge1xuICBkZWRlbnQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIGRlcHRoID0gTWF0aC5tYXgoMCwgZGVwdGggLSAxKTtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgLFxuICBpbmRlbnQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIGRlcHRoID0gZGVwdGggKyAxO1xuICAgIHJldHVybiAnXFxuJyArIHNwKCk7XG4gIH1cbiAgLFxuICBzYW1lZGVudDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJ1xcbicgKyBzcCgpO1xuICB9XG4gICxcbiAgRE9NX0FTU0lHTjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgbmFtZSA9IENOKCk7XG4gICAgcmV0dXJuIG5hbWUgKyAnLnB1c2goU3RyaW5nKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblsxXSkgKyAnKSknO1xuICB9XG4gICxcbiAgVEFHX1BBUkFNUzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICBpZihub2RlLmNoaWxkcmVuLmxlZnQpe1xuICAgICAgcmV0dXJuIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmxlZnQpICsgJywgJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnJpZ2h0KTtcbiAgICB9O1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uZSl7XG4gICAgICByZXR1cm4gbm9kZS5jaGlsZHJlbi5uLnZhbHVlICsgJzogJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbm9kZS5jaGlsZHJlbi5uLnZhbHVlICsgJzogdHJ1ZSc7XG4gICAgfTtcbiAgfVxuICAsXG4gIFRBRzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyID0gJyc7XG4gICAgdmFyIHBhcmFtcyA9IFwie1wiO1xuICAgIHZhciBuYW1lID0gbm9kZS5jaGlsZHJlbi50YWcudmFsdWUuc3Vic3RyaW5nKDEpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ucGFyYW1zKXtcbiAgICAgIHBhcmFtcyArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMpO1xuICAgIH07XG4gICAgcGFyYW1zICs9ICd9JztcbiAgICB2YXIgc3ViID0gJ1tdJztcbiAgICBpZihub2RlLmNoaWxkcmVuLmJsb2NrKXtcbiAgICAgIHN1YiA9IHB1c2hDTigpO1xuICAgICAgc3RyICs9ICcnICsgQ04oKSArICcgPSBbXSc7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYmxvY2spO1xuICAgICAgcG9wQ04oKTtcbiAgICB9O1xuICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgQ04oKSArICcucHVzaChoKFwiXCIgKyBuYW1lICsgXCJcIiwgXCIgKyBwYXJhbXMgKyBcIiwgXCIgKyBzdWIgKyBcIikpJztcbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgQ0xBU1M6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIG5hbWUgPSBub2RlLmNoaWxkcmVuLm5hbWUudmFsdWU7XG4gICAgdmFyIGZ1bmNzID0gbm9kZS5jaGlsZHJlbi5tZXRob2RzO1xuICAgIHZhciBwYXJlbnQgPSBub2RlLmNoaWxkcmVuLnBhcmVudDtcbiAgICB2YXIgc3RyID0gJyc7XG4gICAgY29uc3RydWN0b3IgPSBudWxsO1xuICAgIHZhciBfa2V5czIgPSBPYmplY3Qua2V5cyhmdW5jcyk7XG4gICAgZm9yKHZhciBfaW5kZXgyID0gMDsgX2luZGV4MiA8IF9rZXlzMi5sZW5ndGg7IF9pbmRleDIrKyApIHtcbiAgICAgIHZhciBmdW5jID0gZnVuY3NbX2tleXMyW19pbmRleDJdXTtcbiAgICAgIHZhciBmdW5jX2RlZiA9IGZ1bmMuY2hpbGRyZW47XG4gICAgICB2YXIgZnVuY19uYW1lID0gZnVuY19kZWYuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICBpZihmdW5jX25hbWUgPT09ICdjb25zdHJ1Y3Rvcicpe1xuICAgICAgICBjb25zdHJ1Y3RvciA9IGZ1bmNfZGVmO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyICs9ICdcXG4nICsgc3AoKSArIG5hbWUgKyAnLnByb3RvdHlwZS4nICsgZnVuY19uYW1lICsgJyA9ICcgKyBnZW5lcmF0ZUNvZGUoZnVuY19kZWYpO1xuICAgICAgfTtcbiAgICB9XG4gICAgdmFyIG5zID0gY3VycmVudE5zKCk7XG4gICAgbnNbbmFtZV0gPSB0cnVlO1xuICAgIG5zID0gbmV3TnMoKTtcbiAgICB2YXIgcGFyYW1zID0gY29uc3RydWN0b3IgJiYgY29uc3RydWN0b3IuY2hpbGRyZW4ucGFyYW1zO1xuICAgIGlmKHBhcmFtcyl7XG4gICAgICBwYXJhbXMgPSBnZW5lcmF0ZUNvZGUocGFyYW1zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGFyYW1zID0gJyc7XG4gICAgfTtcbiAgICB2YXIgYm9keSA9IGNvbnN0cnVjdG9yICYmIGNvbnN0cnVjdG9yLmNoaWxkcmVuLmJsb2NrO1xuICAgIHZhciBjb25zX3N0ciA9ICcnICsgbmFtZSArICcgPSBmdW5jdGlvbiAnICsgbmFtZSArICcoJyArIHBhcmFtcyArICcpIHsnO1xuICAgIGNvbnNfc3RyICs9ICdcXG4nICsgc3AoMSkgKyAnaWYoISh0aGlzIGluc3RhbmNlb2YgXCIgKyBuYW1lICsgXCIpKXsgcmV0dXJuIG5ldyBcIiArIG5hbWUgKyBcIignICsgT2JqZWN0LmtleXMobnMpLmpvaW4oJywnKSArICcpfSc7XG4gICAgdmFyIF9rZXlzMyA9IE9iamVjdC5rZXlzKG5zKTtcbiAgICBmb3IodmFyIF9pbmRleDMgPSAwOyBfaW5kZXgzIDwgX2tleXMzLmxlbmd0aDsgX2luZGV4MysrICkge1xuICAgICAgdmFyIGtleSA9IF9rZXlzM1tfaW5kZXgzXTtcbiAgICAgIHZhciB2YWx1ZSA9IG5zW19rZXlzM1tfaW5kZXgzXV07XG4gICAgICBpZih2YWx1ZSAhPT0gdHJ1ZSAmJiB2YWx1ZSAhPT0gdW5kZWZpbmVkKXtcbiAgICAgICAgY29uc19zdHIgKz0gJ1xcbicgKyBzcCgxKSArICdpZihcIiArIGtleSArIFwiID09PSB1bmRlZmluZWQpIHtcIiArIGtleSArIFwiID0gJyArIGdlbmVyYXRlQ29kZSh2YWx1ZSkgKyAnfSc7XG4gICAgICB9O1xuICAgIH1cbiAgICBpZihib2R5KXtcbiAgICAgIGNvbnNfc3RyICs9IGdlbmVyYXRlQ29kZShib2R5KTtcbiAgICB9O1xuICAgIGNvbnNfc3RyICs9IHNwKCkgKyAnXFxufSc7XG4gICAgaWYocGFyZW50KXtcbiAgICAgIGNvbnNfc3RyICs9ICdcXG4nICsgc3AoKSArICdcIiArIG5hbWUgKyBcIi5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCcgKyBwYXJlbnQudmFsdWUgKyAnLnByb3RvdHlwZSknO1xuICAgICAgY29uc19zdHIgKz0gJ1xcbicgKyBzcCgpICsgJ1wiICsgbmFtZSArIFwiLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IFwiICsgbmFtZSArIFwiJztcbiAgICB9O1xuICAgIG5hbWVzcGFjZXMucG9wKCk7XG4gICAgcmV0dXJuIGNvbnNfc3RyICsgc3RyO1xuICB9XG4gICxcbiAgTEFNQkRBOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBuYW1lID0gXCJcIjtcbiAgICB2YXIgbnMgPSBuZXdOcygpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uZm4pe1xuICAgICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICBuc1tuYW1lXSA9IHRydWU7XG4gICAgfTtcbiAgICB2YXIgc3RyID0gXCJmdW5jdGlvbiBcIiArIG5hbWUgKyBcIihcIjtcbiAgICBpZihub2RlLmNoaWxkcmVuLnBhcmFtcyl7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucGFyYW1zLCBucyk7XG4gICAgfTtcbiAgICBzdHIgKz0gJykgeyc7XG4gICAgdmFyIF9rZXlzNCA9IE9iamVjdC5rZXlzKG5zKTtcbiAgICBmb3IodmFyIF9pbmRleDQgPSAwOyBfaW5kZXg0IDwgX2tleXM0Lmxlbmd0aDsgX2luZGV4NCsrICkge1xuICAgICAgdmFyIGtleSA9IF9rZXlzNFtfaW5kZXg0XTtcbiAgICAgIHZhciB2YWx1ZSA9IG5zW19rZXlzNFtfaW5kZXg0XV07XG4gICAgICBpZih2YWx1ZSAhPT0gdHJ1ZSAmJiB2YWx1ZSAhPT0gdW5kZWZpbmVkKXtcbiAgICAgICAgdmFyIGNvZGUgPSBnZW5lcmF0ZUNvZGUodmFsdWUpO1xuICAgICAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArICdpZihcIiArIGtleSArIFwiID09PSB1bmRlZmluZWQpIHtcIiArIGtleSArIFwiID0gXCIgKyBjb2RlICsgXCJ9JztcbiAgICAgIH07XG4gICAgfVxuICAgIGlmKG5vZGUuY2hpbGRyZW4uYmxvY2spe1xuICAgICAgc3RyICs9ICcgcmV0dXJuICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5ibG9jaywgbnMpO1xuICAgIH07XG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICByZXR1cm4gc3RyICsgXCI7IH1cIjtcbiAgfVxuICAsXG4gIEZVTkNfREVGOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBuYW1lID0gXCJcIjtcbiAgICB2YXIgbnMgPSBjdXJyZW50TnMoKTtcbiAgICB2YXIgaXNfZG9tID0gbm9kZS5jaGlsZHJlbi5mZC52YWx1ZSA9PT0gJ2RvbSc7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5mbil7XG4gICAgICBuYW1lID0gbm9kZS5jaGlsZHJlbi5mbi52YWx1ZTtcbiAgICAgIG5zW25hbWVdID0gdHJ1ZTtcbiAgICB9O1xuICAgIG5zID0gbmV3TnMoKTtcbiAgICB2YXIgc3RyID0gXCJmdW5jdGlvbiBcIiArIG5hbWUgKyBcIihcIjtcbiAgICBpZihub2RlLmNoaWxkcmVuLnBhcmFtcyl7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucGFyYW1zKTtcbiAgICB9O1xuICAgIHN0ciArPSAnKSB7JztcbiAgICB2YXIgX2tleXM1ID0gT2JqZWN0LmtleXMobnMpO1xuICAgIGZvcih2YXIgX2luZGV4NSA9IDA7IF9pbmRleDUgPCBfa2V5czUubGVuZ3RoOyBfaW5kZXg1KysgKSB7XG4gICAgICB2YXIga2V5ID0gX2tleXM1W19pbmRleDVdO1xuICAgICAgdmFyIHZhbHVlID0gbnNbX2tleXM1W19pbmRleDVdXTtcbiAgICAgIGlmKHZhbHVlICE9PSB0cnVlICYmIHZhbHVlICE9PSB1bmRlZmluZWQpe1xuICAgICAgICB2YXIgY29kZSA9IGdlbmVyYXRlQ29kZSh2YWx1ZSk7XG4gICAgICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgJ2lmKFwiICsga2V5ICsgXCIgPT09IHVuZGVmaW5lZCkge1wiICsga2V5ICsgXCIgPSBcIiArIGNvZGUgKyBcIjt9JztcbiAgICAgIH07XG4gICAgfVxuICAgIGlmKGlzX2RvbSl7XG4gICAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArICcnICsgQ04oKSArICcgPSBbXTsnO1xuICAgIH07XG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jayl7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYmxvY2spO1xuICAgIH07XG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICBpZihpc19kb20pe1xuICAgICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyAncmV0dXJuICcgKyBDTigpICsgJzsnO1xuICAgIH07XG4gICAgcmV0dXJuIHN0ciArICdcXG4nICsgc3AoKSArICd9JztcbiAgfVxuICAsXG4gIEZVTkNfREVGX1BBUkFNUzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyID0gXCJcIjtcbiAgICB2YXIgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBpZihub2RlLmNoaWxkcmVuWzBdLnR5cGUgPT09ICduYW1lJyl7XG4gICAgICBuc1tub2RlLmNoaWxkcmVuWzBdLnZhbHVlXSA9IHRydWU7XG4gICAgICBpZihub2RlLmNoaWxkcmVuWzFdICYmIG5vZGUuY2hpbGRyZW5bMV0udHlwZSA9PT0gJ2Fzc2lnbicpe1xuICAgICAgICBuc1tub2RlLmNoaWxkcmVuWzBdLnZhbHVlXSA9IG5vZGUuY2hpbGRyZW5bMl07XG4gICAgICB9O1xuICAgIH07Oy8vIFRPRE86IGZpeCB0aGlzXG4gICAgdmFyIGNoaWxkcmVuID0gbm9kZS5jaGlsZHJlbjtcbiAgICB2YXIgX2tleXM2ID0gT2JqZWN0LmtleXMoY2hpbGRyZW4pO1xuICAgIGZvcih2YXIgX2luZGV4NiA9IDA7IF9pbmRleDYgPCBfa2V5czYubGVuZ3RoOyBfaW5kZXg2KysgKSB7XG4gICAgICB2YXIgbiA9IGNoaWxkcmVuW19rZXlzNltfaW5kZXg2XV07XG4gICAgICBpZihuLnR5cGUgPT09ICduYW1lJyB8fCBuLnR5cGUgPT09ICdGVU5DX0RFRl9QQVJBTVMnIHx8IG4udHlwZSA9PT0gJ2NvbW1hJyB8fCBuLnR5cGUgPT09ICd3aW5kb3cnKXtcbiAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShuKTtcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgLFxuICBBU1NJR046IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHByZWZpeCA9IFwiXCI7XG4gICAgdmFyIHN0ciA9IFwiXCI7XG4gICAgdmFyIG9wID0gbm9kZS5jaGlsZHJlbi5vcC52YWx1ZTtcbiAgICB2YXIgZXhwbGljaXRfZ2xvYmFsID0gb3AgPT09ICc6ID0nO1xuICAgIGlmKG9wID09PSAnOiA9Jyl7XG4gICAgICBvcCA9ICc9JztcbiAgICB9O1xuICAgIHZhciBucyA9IGN1cnJlbnROcygpO1xuICAgIHZhciBsZWZ0ID0gbm9kZS5jaGlsZHJlbi5sZWZ0O1xuICAgIHZhciByaWdodF9jb2RlID0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucmlnaHQpO1xuICAgIGlmKGxlZnQudHlwZSA9PT0gJ1NUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUicpe1xuICAgICAgdW5wYWNraW5nKys7XG4gICAgICB2YXIgdW5wYWNrX25hbWUgPSAnX191bnBhY2snICsgdW5wYWNraW5nO1xuICAgICAgc3RyICs9IHVucGFja19uYW1lICsgXCIgPSBcIiArIHJpZ2h0X2NvZGUgKyBcIlxcblwiICsgc3AoKTtcbiAgICAgIHZhciBjaGlsZHJlbiA9IGxlZnQuY2hpbGRyZW47XG4gICAgICB2YXIgaSA9IDA7XG4gICAgICB2YXIgX2tleXM3ID0gT2JqZWN0LmtleXMoY2hpbGRyZW4pO1xuICAgICAgZm9yKHZhciBfaW5kZXg3ID0gMDsgX2luZGV4NyA8IF9rZXlzNy5sZW5ndGg7IF9pbmRleDcrKyApIHtcbiAgICAgICAgdmFyIGNoaWxkID0gY2hpbGRyZW5bX2tleXM3W19pbmRleDddXTtcbiAgICAgICAgdmFyIG4gPSBjaGlsZC5jaGlsZHJlblswXTtcbiAgICAgICAgcHJlZml4ID0gXCJcIjtcbiAgICAgICAgaWYobi50eXBlID09PSAnbmFtZScpe1xuICAgICAgICAgIGlmKG5zW24udmFsdWVdID09PSB1bmRlZmluZWQpe1xuICAgICAgICAgICAgbnNbbi52YWx1ZV0gPSB0cnVlO1xuICAgICAgICAgICAgaWYoIWV4cGxpY2l0X2dsb2JhbCl7XG4gICAgICAgICAgICAgIHByZWZpeCA9ICcnO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9O1xuICAgICAgICB9O1xuICAgICAgICBzdHIgKz0gcHJlZml4ICsgZ2VuZXJhdGVDb2RlKG4pICsgJyAnICsgb3AgKyAnICcgKyB1bnBhY2tfbmFtZSArICdbJyArIGkgKyAnXTtcXG4nICsgc3AoKTtcbiAgICAgICAgaSsrO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0cjtcbiAgICB9O1xuICAgIGlmKGxlZnQuY2hpbGRyZW5bMF0udHlwZSA9PT0gJ25hbWUnKXtcbiAgICAgIHZhciBjaCA9IGxlZnQuY2hpbGRyZW5bMF07XG4gICAgICBpZihuc1tjaC52YWx1ZV0gPT09IHVuZGVmaW5lZCl7XG4gICAgICAgIGlmKCFleHBsaWNpdF9nbG9iYWwpe1xuICAgICAgICAgIHByZWZpeCA9ICcnO1xuICAgICAgICB9O1xuICAgICAgICBuc1tjaC52YWx1ZV0gPSB0cnVlO1xuICAgICAgfTtcbiAgICB9O1xuICAgIHJldHVybiBwcmVmaXggKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5sZWZ0KSArICcgJyArIG9wICsgJyAnICsgcmlnaHRfY29kZTtcbiAgfVxuICAsXG4gIFNUQVRFTUVOVDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgZSA9IG5vZGUuY2hpbGRyZW5bMF0uY2hpbGRyZW5bMF07Oy8vIFRPRE86IHRoaXMgc2hvdWxkIGJlIHBvc3NpYmxlXG4gICAgaWYobm9kZS5jaGlsZHJlblswXS50eXBlID09PSAnRk9SJyB8fCBub2RlLmNoaWxkcmVuWzBdLnR5cGUgPT09ICdUUllfQ0FUQ0gnIHx8IG5vZGUuY2hpbGRyZW5bMF0udHlwZSA9PT0gJ1dISUxFJyB8fCBlICYmIChlLnR5cGUgPT09ICdGVU5DX0RFRicgfHwgZS50eXBlID09PSAnTEFNQkRBJykpe1xuICAgICAgcmV0dXJuIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzBdKTtcbiAgICB9O1xuICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblswXSkgKyAnJztcbiAgfVxuICAsXG4gIElGOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHIgPSAnJztcbiAgICBzdHIgPSAnaWYoJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJyl7JyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICAgIHZhciBlbGlmID0gbm9kZS5jaGlsZHJlbi5lbGlmO1xuICAgIGlmKGVsaWYpe1xuICAgICAgaWYoQXJyYXkuaXNBcnJheShlbGlmKSl7XG4gICAgICAgIHZhciBfa2V5czggPSBPYmplY3Qua2V5cyhlbGlmKTtcbiAgICAgICAgZm9yKHZhciBfaW5kZXg4ID0gMDsgX2luZGV4OCA8IF9rZXlzOC5sZW5ndGg7IF9pbmRleDgrKyApIHtcbiAgICAgICAgICB2YXIgdmFsdWUgPSBlbGlmW19rZXlzOFtfaW5kZXg4XV07XG4gICAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZSh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoZWxpZik7XG4gICAgICB9O1xuICAgIH07XG4gICAgaWYobm9kZS5jaGlsZHJlbi5lbCl7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZWwpO1xuICAgIH07XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuICAsXG4gIElGX0VYUFI6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciA9ICcnO1xuICAgIHN0ciA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnRlc3QpICsgJyA/ICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcgOiAnO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uZWwpe1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmVsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyICs9ICd1bmRlZmluZWQnO1xuICAgIH07XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuICAsXG4gIEVMU0VfRVhQUjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYik7XG4gIH1cbiAgLFxuICBXSElMRTogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJ3doaWxlKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcpeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgfVxuICAsXG4gIEZPUjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIga2V5SW5kZXhOYW1lID0gXCJfaW5kZXhcIiArIGZvckxvb3BDb3VudDtcbiAgICB2YXIga2V5QXJyYXlOYW1lID0gXCJfa2V5c1wiICsgZm9yTG9vcENvdW50O1xuICAgIGZvckxvb3BDb3VudCsrO1xuICAgIHZhciBpbmRleE5hbWUgPSBmYWxzZTtcbiAgICBpZihub2RlLmNoaWxkcmVuLmspe1xuICAgICAgaW5kZXhOYW1lID0gbm9kZS5jaGlsZHJlbi5rLnZhbHVlO1xuICAgIH07XG4gICAgdmFyIHN0ciA9ICdcIiArIGtleUFycmF5TmFtZSArIFwiID0gT2JqZWN0LmtleXMoJyArIG5vZGUuY2hpbGRyZW4uYS52YWx1ZSArICcpXFxuJztcbiAgICBzdHIgKz0gc3AoKSArICdmb3IoJyArIGtleUluZGV4TmFtZSArICc7ICcgKyBrZXlJbmRleE5hbWUgKyAnID0gMDsgJyArIGtleUluZGV4TmFtZSArICcgPCAnICsga2V5QXJyYXlOYW1lICsgJy5sZW5ndGg7ICcgKyBrZXlJbmRleE5hbWUgKyAnKyspIHtcXG4nO1xuICAgIGlmKGluZGV4TmFtZSl7XG4gICAgICBzdHIgKz0gc3AoMSkgKyAnJyArIGluZGV4TmFtZSArICcgPSAnICsga2V5QXJyYXlOYW1lICsgJ1snICsga2V5SW5kZXhOYW1lICsgJ11cXG4nO1xuICAgIH07XG4gICAgc3RyICs9IHNwKDEpICsgJycgKyBub2RlLmNoaWxkcmVuLnYudmFsdWUgKyAnID0gJyArIG5vZGUuY2hpbGRyZW4uYS52YWx1ZSArICdbJyArIGtleUFycmF5TmFtZSArICdbJyArIGtleUluZGV4TmFtZSArICddXSc7XG4gICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgLFxuICBFTFNFX0lGOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnIGVsc2UgaWYoJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJykgeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgfVxuICAsXG4gIEVMU0U6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuICcgZWxzZSB7JyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICB9XG4gICxcbiAgVFJZX0NBVENIOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHIgPSBcInRyeSB7XCI7XG4gICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIxKTtcbiAgICBzdHIgKz0gJ1xcbicgKyBzcCgpICsgXCJ9IGNhdGNoKFwiICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZXJyKSArIFwiKSB7XCI7XG4gICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIyKTtcbiAgICByZXR1cm4gc3RyICsgJ1xcbicgKyBzcCgpICsgXCJ9XCI7XG4gIH1cbiAgLFxuICBTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFI6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIGVsZW1lbnRzID0gW107XG4gICAgdmFyIGNoaWxkcmVuID0gbm9kZS5jaGlsZHJlbjtcbiAgICB2YXIgX2tleXM5ID0gT2JqZWN0LmtleXMoY2hpbGRyZW4pO1xuICAgIGZvcih2YXIgX2luZGV4OSA9IDA7IF9pbmRleDkgPCBfa2V5czkubGVuZ3RoOyBfaW5kZXg5KysgKSB7XG4gICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltfa2V5czlbX2luZGV4OV1dO1xuICAgICAgZWxlbWVudHMucHVzaChnZW5lcmF0ZUNvZGUoY2hpbGQpKTtcbiAgICB9XG4gICAgcmV0dXJuICdbJyArIGVsZW1lbnRzLmpvaW4oXCIsIFwiKSArICddJztcbiAgfVxuICAsXG4gIHN0cmluZzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgdiA9IG5vZGUudmFsdWU7XG4gICAgdiA9IHYucmVwbGFjZSgvXFxuL2csIFwiXFxcXG5cIik7XG4gICAgdmFyIGFzdCA9IHN0ckdyYW0ucGFyc2Uodik7XG4gICAgaWYoIWFzdC5jb21wbGV0ZSl7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYXN0LmhpbnQpO1xuICAgIH07XG4gICAgcmV0dXJuIGdlbmVyYXRlU3RyaW5nQ29kZShhc3QsIHYuY2hhckF0KDApKTtcbiAgfVxuICAsXG4gIGNvbW1lbnQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuIG5vZGUudmFsdWUucmVwbGFjZSgvXiMvZywgXCIvL1wiKTtcbiAgfVxuICAsXG4gIG5vdDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyEnO1xuICB9XG4gICxcbiAgY29tcGFyaXNvbjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICBpZihub2RlLnZhbHVlID09PSAnPT0nKXtcbiAgICAgIHJldHVybiAnPT09JztcbiAgICB9O1xuICAgIGlmKG5vZGUudmFsdWUgPT09ICchPScpe1xuICAgICAgcmV0dXJuICchPT0nO1xuICAgIH07XG4gICAgcmV0dXJuIG5vZGUudmFsdWU7XG4gIH1cbn07XG5mdW5jdGlvbiBnZW5lcmF0ZUNvZGUobm9kZSkge1xuICBpZighbm9kZSl7XG4gICAgLy8gZGVidWdnZXJcbiAgfTtcbiAgaWYoYmFja2VuZFtub2RlLnR5cGVdKXtcbiAgICByZXR1cm4gYmFja2VuZFtub2RlLnR5cGVdKG5vZGUpO1xuICB9O1xuICBpZihub2RlLnZhbHVlICE9PSB1bmRlZmluZWQpe1xuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9O1xuICB2YXIgc3RyID0gXCJcIjtcbiAgaWYoIW5vZGUuY2hpbGRyZW4pe1xuICAgIHJldHVybiAnJztcbiAgfTtcbiAgdmFyIGNoaWxkcmVuID0gbm9kZS5jaGlsZHJlbjtcbiAgdmFyIF9rZXlzMTAgPSBPYmplY3Qua2V5cyhjaGlsZHJlbik7XG4gIGZvcih2YXIgX2luZGV4MTAgPSAwOyBfaW5kZXgxMCA8IF9rZXlzMTAubGVuZ3RoOyBfaW5kZXgxMCsrICkge1xuICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW19rZXlzMTBbX2luZGV4MTBdXTtcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKGNoaWxkKTtcbiAgfVxuICByZXR1cm4gc3RyO1xufVxuZnVuY3Rpb24gZ2VuZXJhdGVFeHBvcnRzKGtleXMpIHtcbiAgdmFyIHN0ciA9ICdcXG5tb2R1bGUuZXhwb3J0cyA9IHsnO1xuICBrZXlzID0ga2V5cyB8fCBPYmplY3Qua2V5cyhjdXJyZW50TnMoKSk7XG4gIHZhciBfa2V5czExID0gT2JqZWN0LmtleXMoa2V5cyk7XG4gIGZvcih2YXIgX2luZGV4MTEgPSAwOyBfaW5kZXgxMSA8IF9rZXlzMTEubGVuZ3RoOyBfaW5kZXgxMSsrICkge1xuICAgIHZhciBrZXkgPSBrZXlzW19rZXlzMTFbX2luZGV4MTFdXTtcbiAgICBzdHIgKz0gJ1xcbiAgJyArIGtleSArICc6ICcgKyBrZXkgKyAnLCc7XG4gIH1cbiAgcmV0dXJuIHN0ciArICdcXG59Jztcbn1cbmZ1bmN0aW9uIGdlbmVyYXRlTW9kdWxlKGlucHV0LG9wdHMpIHtcbiAgcmVzZXRHbG9iYWwoKTtcbiAgdmFyIGFzdCA9IGdyYW0ucGFyc2UoaW5wdXQgKyBcIlxcblwiKTtcbiAgaWYoIWFzdC5jb21wbGV0ZSl7XG4gICAgdGhyb3cgbmV3IEVycm9yKGFzdC5oaW50KTtcbiAgfTtcbiAgdmFyIG9iaiA9IHthc3Q6IGFzdCwgY29kZTogZ2VuZXJhdGVDb2RlKGFzdCksIG5zOiBjdXJyZW50TnMoKX07XG4gIHJldHVybiBvYmo7XG59XG52YXIgZ3JhbSA9IGVwZWdqcy5jb21waWxlR3JhbW1hcihncmFtbWFyRGVmLCB0b2tlbkRlZik7XG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZ3JhbW1hcjogZ3JhbSxcbiAgc3RyR3JhbW1hcjogc3RyR3JhbSxcbiAgZ3JhbW1hckRlZjogZ3JhbW1hckRlZixcbiAgZXBlZ2pzOiBlcGVnanMsXG4gIHRva2VuRGVmOiB0b2tlbkRlZixcbiAgZ2VuZXJhdGVNb2R1bGU6IGdlbmVyYXRlTW9kdWxlLFxuICBnZW5lcmF0ZUNvZGU6IGdlbmVyYXRlQ29kZSxcbiAgZ2VuZXJhdGVFeHBvcnRzOiBnZW5lcmF0ZUV4cG9ydHNcbn07XG5cbiJdfQ==
