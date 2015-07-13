!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.cokescript=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var epegjs, depth, forLoopCount, unpacking, namespaces, levelStack, prefix, a, tokenDef, strInterpolationTokenDef, strInterpolationGrammarDef, strGram, grammarDef, nc, backend, gram;
// CokeScript language by Batiste Bieler 2015
// Implemented using EPEG.JS

epegjs = require("epegjs");

depth = 0;
forLoopCount = 1;
unpacking = 0;
namespaces = [{}];
levelStack = [0];
prefix = '__';

a = {t: 1, z: 2};

function hello() {
  return {t: 1, z: 2};
}

function currentNs() {
  return namespaces[namespaces.length - 1];
}

function currentNsHas(p) {
  return namespaces[namespaces.length - 1].hasOwnProperty(p);
}

function newNs() {
  namespaces.push({});
  return namespaces[namespaces.length - 1];
}

function resetGlobal() {
  namespaces = [{}];
  forLoopCount = 1;
  levelStack = [0];
  depth = 0;
  unpacking = 0;
}

// token are matched in order of declaration;
// TODO: add functions

tokenDef = [
  {key: "string", func: stringDef},
  {key: "comment", func: commentDef},
  {key: "function_def", func: defDef, verbose: "function"},
  {key: "class", reg: /^class /},
  {key: "ret", reg: /^return/, verbose: "return"},
  {key: "if", reg: /^if /},
  {key: "or", reg: /^or /},
  {key: "and", reg: /^and /},
  {key: "while", reg: /^while /},
  {key: "instanceof", reg: /^instanceof /},
  {key: "try", reg: /^try/},
  {key: "catch", reg: /^catch/},
  {key: "throw", reg: /^throw /},
  {key: "pazz", reg: /^pass/, verbose: "pass"},
  {key: "new", reg: /^new /},
  {key: "tag", reg: /^<[a-zA-Z][0-9a-zA-Z]{0,29}/},
  {key: ">", reg: /^>/},
  {key: "elseif", reg: /^elseif /},
  {key: "else", reg: /^else/},
  {key: "for_loop", reg: /^for /, verbose: "for loop"},
  {key: "in", reg: /^in /},
  {key: "not", reg: /^not /, verbose: "not"},
  {key: "name", reg: /^[a-zA-Z_$][0-9a-zA-Z_$]{0,29}/},
  {key: "regexp", func: regExpDef, verbose: "regular expression"},
  {key: "math_operators", reg: /^(\+\+|\-\-)/, verbose: "math operator"},
  {key: "binary_operators", reg: /^(\&\&|\|\||\&|\||<<|\>\>)/, verbose: "binary operator"},
  {key: "comparison", reg: /^(<=|>=|<|>|!=|==)/},
  {key: "assign", reg: /^(\+=|-=|=|:=)/},
  {key: "number", reg: /^[-]?[0-9]+\.?[0-9]*/},
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
  var last;
  last = stream[stream.length - 1];
  if(last && last.value === "\\") {
    return;
  }
  if(input.match(/^#{/)) {
    return "#{";
  }
}

strInterpolationTokenDef = [
  {key: "start", func: startStr},
  {key: "end", reg: /^}/},
  {key: "name", reg: /^[a-zA-Z_$][0-9a-zA-Z_]{0,29}/},
  {key: "dot", reg: /^\./},
  {key: "char", reg: /^./}
];

strInterpolationGrammarDef = {
  START: {rules: ["EL* EOF"]},
  EL: {rules: ["VAR", "char", "name", "start", "end", "dot"]},
  VAR: {rules: ["start NAME end"]},
  NAME: {rules: ["name dot NAME", "name"]}
};

strGram = epegjs.compileGrammar(strInterpolationGrammarDef, strInterpolationTokenDef);

function generateStringCode(node,c) {
  var str;
  if(node.type === 'VAR') {
    return c + ' + ' + generateStringCode(node.children[1], c) + ' + ' + c;
  }
  
  if(node.value !== undefined) {
    return node.value;
  }
  
  str = '';
  if(!node.children) {
    return '';
  }
  
  var __keys1 = Object.keys(node.children);
  for(var __index1 = 0; __index1 < __keys1.length; __index1++) {
    var child = node.children[__keys1[__index1]];
    str += generateStringCode(child, c);
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
    var m, lines, indent;
    // empty line is a samedent
    m = input.match(/^\n[\s]*/);
    if(m) {
      lines = m[0].split("\n");
      indent = lines[lines.length - 1].length;
      if(indentType(indent) === dentType) {
        if(dentType === 'dedent') {
          levelStack.pop();
          return '';
        }
        
        if(dentType === 'indent') {
          levelStack.push(indent);
        }
        
        return m[0];
      }
    }
  };
}

function stringDef(input) {
  var first, i, ch;
  first = input.charAt(0);
  if(first === '"' || first === "'") {
    i = 1;
    while(input.charAt(i)){
      ch = input.charAt(i);
      if(ch === '\\') {
        i++;
      } else if(ch === first) {
        return input.slice(0, i + 1);
      }
      i++;
    }
  }
}

function regExpDef(input) {
  var i, ch;
  if(input.charAt(0) === '/') {
    i = 1;
    while(input.charAt(i)){
      ch = input.charAt(i);
      if(ch === '\\') {
        i++;
      } else if(ch === '/') {
        i++;
        // modifiers
        while(input.charAt(i) && "igm".indexOf(input.charAt(i)) !== -1){
          i++;
        }
        return input.slice(0, i);
      }
      i++;
    }
  }
}

function defDef(input) {
  if(input.match(/^def[\(| |\n]/)) {
    return "def";
  }
  
  if(input.indexOf("dom ") === 0) {
    return "dom";
  }
}

function commentDef(input) {
  var m, i, ch;
  m = input.match(/^#/);
  if(m) {
    i = m[0].length;
    while(input.charAt(i)){
      ch = input.charAt(i);
      if(ch === '\n') {
        return input.slice(0, i);
      }
      i++;
    }
  }
}

function reflect(params) { return params; }

grammarDef = {
  START: {rules: ["LINE* EOF"]},
  ELC: {rules: ["W* comment"], verbose: "comment"},
  LINE: {rules: ["STATEMENT ELC? samedent+", "STATEMENT ELC? !dedent", 
    "ELC? samedent", "ELC !dedent"], verbose: "new line"},
  BLOCK: {rules: ["indent pazz dedent", "indent LINE+ dedent"]},
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
  ANY_SPACE: {rules: ["W", "samedent", "indent", "dedent", "comment"], verbose: "any space"},
  FUNC_CALL_PARAMS: {rules: ["EXPR comma ANY_SPACE+ FUNC_CALL_PARAMS ANY_SPACE*", "EXPR ANY_SPACE*"]},
  FUNC_CALL: {rules: [
    "open_par FUNC_CALL_PARAMS? close_par"
  ]},
  
  TYPE: {rules: ["name colon"]},
  
  FOR: {rules: [
    "for_loop k:name comma W v:name W in a:EXPR b:BLOCK",
    "for_loop v:name W in a:EXPR b:BLOCK"],
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
    "W or EXPR",
    "W and EXPR",
    "W comparison W EXPR",
    "W > W EXPR",
    "dot EXPR",
    "W instanceof EXPR",
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
  var out, i;
  out = "";
  i = 0;
  while(i < n){
    out += " ";
    i++;
  }
  return out;
}

function sp(mod) {
  if(mod) {
    return spacer(2 * (depth + mod));
  }
  return spacer(2 * depth);
}

nc = 1;

// children name
function CN() {
  return prefix + 'c' + nc;
}

function pushCN() {
  nc++;
  return prefix + 'c' + nc;
}

function popCN() {
  nc--;
  return prefix + 'c' + nc;
}

function generateHoistedVar() {
  var ns, hoisted;
  ns = currentNs();
  hoisted = [];
  var __keys2 = Object.keys(ns);
  for(var __index2 = 0; __index2 < __keys2.length; __index2++) {
    var key = __keys2[__index2];
    var value = ns[__keys2[__index2]];
    if(value === 'hoist') {
      hoisted.push(key);
    }
  }
  if(hoisted.length) {
    return 'var ' + hoisted.join(', ') + ';';
  }
  return '';
}

function hoistVar(name) {
  var ns;
  ns = currentNs();
  ns[name] = 'hoist';
}

backend = {
  START: function (node) {
    var str, hoisted;
    str = '';
    var __keys3 = Object.keys(node.children);
    for(var __index3 = 0; __index3 < __keys3.length; __index3++) {
      var child = node.children[__keys3[__index3]];
      str += generateCode(child);
    }
    hoisted = generateHoistedVar();
    if(hoisted) {
      return generateHoistedVar() + '\n' + str;
    }
    return str;
  }
  ,
  dedent: function (node) {
    depth = Math.max(0, depth - 1);
    return '';
  }
  ,
  indent: function (node) {
    depth = depth + 1;
    return '\n' + sp();
  }
  ,
  samedent: function (node) {
    var l, i, str;
    l = node.value.split('\n').length - 1;
    i = 0;
    str = '';
    while(i < l){
      str += '\n' + sp();
      i++;
    }
    return str;
  }
  ,
  DOM_ASSIGN: function (node) {
    var name, varname, str;
    name = CN();
    varname = generateCode(node.children[1]);
    hoistVar(CN());
    hoistVar('' + prefix + 'tmp');
    str = '' + prefix + 'tmp = ' + varname + '; ' + prefix + 'tmp instanceof Array ? (' + name + ' = ' + name + '.concat(' + prefix + 'tmp)) : ' + name + '.push(String(' + prefix + 'tmp))';
    return str;
  }
  ,
  TAG_PARAMS: function (node) {
    var name;
    if(node.children.left) {
      return generateCode(node.children.left) + ', ' + generateCode(node.children.right);
    }
    
    name = node.children.n.value;
    
    if(node.children.e) {
      return name + ': ' + generateCode(node.children.e);
    } else {
      return name + ': true';
    }
  }
  ,
  TAG: function (node) {
    var str, params, name, sub, ns;
    str = '';
    params = "{";
    name = node.children.tag.value.substring(1);
    if(node.children.params) {
      params += generateCode(node.children.params);
    }
    
    params += '}';
    sub = '[]';
    ns = currentNs();
    
    if(node.children.block) {
      sub = pushCN();
      str += CN() + ' = [];';
      hoistVar(CN());
      str += generateCode(node.children.block);
      popCN();
    }
    
    str += '\n' + sp() + CN() + '.push(virtualDom.h("' + name + '", {attributes: ' + params + '}, ' + sub + '))';
    return str;
  }
  ,
  CLASS: function (node) {
    var name, funcs, parent, str, constructor, func_def, func_name, ns, params, body, cons_str;
    name = node.children.name.value;
    funcs = node.children.methods;
    parent = node.children.parent;
    str = '';
    constructor = null;
    var __keys4 = Object.keys(funcs);
    for(var __index4 = 0; __index4 < __keys4.length; __index4++) {
      var func = funcs[__keys4[__index4]];
      func_def = func.children;
      func_name = func_def.children.fn.value;
      if(func_name === 'constructor') {
        constructor = func_def;
      } else {
        str += '\n' + sp() + name + '.prototype.' + func_name + ' = ' + generateCode(func_def);
      }
    }
    
    hoistVar(name);
    ns = newNs();
    
    params = constructor && constructor.children.params;
    if(params) {
      params = generateCode(params);
    } else {
      params = '';
    }
    
    body = constructor && constructor.children.block;
    cons_str = '' + name + ' = function ' + name + ' ( ' + params + ' ) {';
    cons_str += '\n' + sp(1) + 'if(!(this instanceof ' + name + ')){ return new ' + name + '(' + Object.keys(ns).join(',') + ')}';
    var __keys5 = Object.keys(ns);
    for(var __index5 = 0; __index5 < __keys5.length; __index5++) {
      var key = __keys5[__index5];
      var value = ns[__keys5[__index5]];
      if(value !== true && value !== undefined) {
        cons_str += '\n' + sp(1) + 'if(' + key + ' === undefined) {' + key + ' = ' + generateCode(value) + '}';
      }
    }
    if(body) {
      cons_str += generateCode(body);
    }
    cons_str += sp() + '\n}';
    
    if(parent) {
      cons_str += '\n' + sp() + '' + name + '.prototype = Object.create(' + parent.value + '.prototype)';
      cons_str += '\n' + sp() + '' + name + '.prototype.constructor = ' + name + '';
    }
    
    namespaces.pop();
    return cons_str + str;
  }
  ,
  LAMBDA: function (node) {
    var name, ns, str, code;
    name = "";
    ns = newNs();
    if(node.children.fn) {
      name = node.children.fn.value;
      ns[name] = true;
    }
    
    str = "function " + name + "(";
    if(node.children.params) {
      str += generateCode(node.children.params, ns);
    }
    
    str += ') {';
    var __keys6 = Object.keys(ns);
    for(var __index6 = 0; __index6 < __keys6.length; __index6++) {
      var key = __keys6[__index6];
      var value = ns[__keys6[__index6]];
      if(value !== true && value !== undefined) {
        code = generateCode(value);
        str += '\n' + sp(1) + 'if(' + key + ' === undefined) {' + key + ' = ' + code + '}';
      }
    }
    
    if(node.children.block) {
      str += ' return ' + generateCode(node.children.block, ns);
    }
    
    namespaces.pop();
    return str + "; }";
  }
  ,
  FUNC_DEF: function (node) {
    var name, ns, is_dom, str, code, body, hoisted;
    name = "";
    ns = currentNs();
    is_dom = node.children.fd.value === 'dom';
    if(node.children.fn) {
      name = node.children.fn.value;
      ns[name] = true;
    }
    
    ns = newNs();
    str = "function " + name + "(";
    if(node.children.params) {
      str += generateCode(node.children.params);
    }
    
    str += ') {';
    var __keys7 = Object.keys(ns);
    for(var __index7 = 0; __index7 < __keys7.length; __index7++) {
      var key = __keys7[__index7];
      var value = ns[__keys7[__index7]];
      if(value !== true && value !== undefined) {
        code = generateCode(value);
        str += '\n' + sp(1) + 'if(' + key + ' === undefined) {' + key + ' = ' + code + ';}';
      }
    }
    
    body = '';
    if(node.children.block) {
      body = generateCode(node.children.block);
    }
    
    if(is_dom) {
      str += '\n' + sp(1) + 'var ' + CN() + ' = [];';
    }
    
    hoisted = generateHoistedVar();
    if(hoisted) {
      str += '\n' + sp(1) + hoisted;
    }
    
    str += body;
    
    namespaces.pop();
    
    if(is_dom) {
      str += '\n' + sp(1) + 'return ' + CN() + ';';
    }
    
    return str + '\n' + sp() + '}';
  }
  ,
  FUNC_DEF_PARAMS: function (node) {
    var str, ns;
    str = "";
    ns = currentNs();
    if(node.children[0].type === 'name') {
      ns[node.children[0].value] = true;
      if(node.children[1] && node.children[1].type === 'assign') {
        ns[node.children[0].value] = node.children[2];
      }
    }
    
    var __keys8 = Object.keys(node.children);
    for(var __index8 = 0; __index8 < __keys8.length; __index8++) {
      var n = node.children[__keys8[__index8]];
      if(n.type === 'name' || n.type === 'FUNC_DEF_PARAMS' || n.type === 'comma' || n.type === 'window') {
        str += generateCode(n);
      }
    }
    
    return str;
  }
  ,
  ASSIGN: function (node) {
    var str, op, explicit_global, ns, left, right_code, unpack_name, i, n, ch;
    str = "";
    op = node.children.op.value;
    explicit_global = op === ':=';
    if(explicit_global) {
      op = '=';
    }
    
    ns = currentNs();
    left = node.children.left;
    right_code = generateCode(node.children.right);
    if(left.type === 'STRICT_COMMA_SEPARATED_EXPR') {
      unpacking++;
      unpack_name = '' + prefix + 'unpack' + unpacking + '';
      str += 'var ' + unpack_name + ' = ' + right_code + ';\n' + sp();
      i = 0;
      var __keys9 = Object.keys(left.children);
      for(var __index9 = 0; __index9 < __keys9.length; __index9++) {
        var child = left.children[__keys9[__index9]];
        n = child.children[0];
        if(n.type === 'name' && child.children.length === 1) {
          hoistVar(n.value);
        }
        
        str += generateCode(child) + ' ' + op + ' ' + unpack_name + '[' + i + ']';
        if(i < left.children.length - 1) {
          str += ';\n' + sp();
        }
        i++;
      }
      return str;
    }
    
    if(left.children[0].type === 'name') {
      ch = left.children[0];
      if(!currentNsHas(ch.value)) {
        if(!explicit_global) {
          hoistVar(ch.value);
        }
      }
    }
    
    return generateCode(node.children.left) + ' ' + op + ' ' + right_code;
  }
  ,
  STATEMENT: function (node) {
    var str, e, t, other;
    str = '';
    var __keys10 = Object.keys(node.children);
    for(var __index10 = 0; __index10 < __keys10.length; __index10++) {
      var child = node.children[__keys10[__index10]];
      e = child.children && child.children[0];
      // TODO: this should be possible
      t = child.type;
      str += generateCode(child);
      other = e && (e.type === 'FUNC_DEF' || e.type === 'LAMBDA');
      if(t === 'FOR' || t === 'TRY_CATCH' || t === 'WHILE' || t === 'IF' || t === 'STATEMENT' || t === 'samedent' || other) {
        
      } else {
        str += ';';
      }
    }
    
    return str;
  }
  ,
  IF: function (node) {
    var str, elif;
    str = '';
    str = 'if(' + generateCode(node.children.e) + ') {' + generateCode(node.children.b) + '\n' + sp() + '}';
    elif = node.children.elif;
    if(elif) {
      if(Array.isArray(elif)) {
        var __keys11 = Object.keys(elif);
        for(var __index11 = 0; __index11 < __keys11.length; __index11++) {
          var value = elif[__keys11[__index11]];
          str += generateCode(value);
        }
      } else {
        str += generateCode(elif);
      }
    }
    
    if(node.children.el) {
      str += generateCode(node.children.el);
    }
    
    return str;
  }
  ,
  IF_EXPR: function (node) {
    var str;
    str = '';
    str = generateCode(node.children.test) + ' ? ' + generateCode(node.children.e) + ' : ';
    if(node.children.el) {
      str += generateCode(node.children.el);
    } else {
      str += 'undefined';
    }
    
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
    var keyIndexName, keyArrayName, arrayName, varName, indexName, str;
    keyIndexName = prefix + "index" + forLoopCount;
    keyArrayName = prefix + "keys" + forLoopCount;
    arrayName = generateCode(node.children.a);
    varName = node.children.v.value;
    forLoopCount++;
    indexName = false;
    if(node.children.k) {
      indexName = node.children.k.value;
    }
    
    str = 'var ' + keyArrayName + ' = Object.keys(' + arrayName + ');\n';
    str += sp() + 'for(var ' + keyIndexName + ' = 0; ' + keyIndexName + ' < ' + keyArrayName + '.length; ' + keyIndexName + '++) {\n';
    if(indexName) {
      str += sp(1) + 'var ' + indexName + ' = ' + keyArrayName + '[' + keyIndexName + '];\n';
    }
    
    str += sp(1) + 'var ' + varName + ' = ' + arrayName + '[' + keyArrayName + '[' + keyIndexName + ']];';
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
    var str;
    str = "try {";
    str += generateCode(node.children.b1);
    str += '\n' + sp() + "} catch(" + generateCode(node.children.err) + ") {";
    str += generateCode(node.children.b2);
    return str + '\n' + sp() + "}";
  }
  ,
  STRICT_COMMA_SEPARATED_EXPR: function (node) {
    var elements;
    elements = [];
    var __keys12 = Object.keys(node.children);
    for(var __index12 = 0; __index12 < __keys12.length; __index12++) {
      var child = node.children[__keys12[__index12]];
      elements.push(generateCode(child));
    }
    return '[' + elements.join(", ") + ']';
  }
  ,
  string: function (node) {
    var v, ast;
    v = node.value;
    v = v.replace(/\n/g, "\\n");
    ast = strGram.parse(v);
    if(!ast.complete) {
      throw new Error(ast.hint);
    }
    return generateStringCode(ast, v.charAt(0));
  }
  ,
  comment: function (node) {
    return node.value.replace(/^#/g, "//");
  }
  ,
  pazz: function (node) {
    return '';
  }
  ,
  not: function (node) {
    return '!';
  }
  ,
  and: function (node) {
    return '&& ';
  }
  ,
  or: function (node) {
    return '|| ';
  }
  ,
  comparison: function (node) {
    if(node.value === '==') {
      return '===';
    }
    
    if(node.value === '!=') {
      return '!==';
    }
    
    return node.value;
  }
};

function generateCode(node) {
  var str;
  if(!node) {
    // debugger
  }
  if(backend[node.type]) {
    return backend[node.type](node);
  }
  
  if(node.value !== undefined) {
    return node.value;
  }
  
  str = "";
  if(!node.children) {
    return '';
  }
  
  var __keys13 = Object.keys(node.children);
  for(var __index13 = 0; __index13 < __keys13.length; __index13++) {
    var child = node.children[__keys13[__index13]];
    str += generateCode(child);
  }
  
  return str;
}


function generateExports(keys) {
  var str;
  str = '\nmodule.exports = {';
  keys = keys || Object.keys(currentNs());
  var __keys14 = Object.keys(keys);
  for(var __index14 = 0; __index14 < __keys14.length; __index14++) {
    var key = keys[__keys14[__index14]];
    str += '\n  ' + key + ' : ' + key + ',';
  }
  return str + '\n}';
}

function generateModule(input,opts) {
  var ast, obj;
  resetGlobal();
  ast = gram.parse(input + "\n");
  if(!ast.complete) {
    throw new Error(ast.hint);
  }
  
  obj = {ast: ast, code: generateCode(ast), ns: currentNs()};
  return obj;
}


gram = epegjs.compileGrammar(grammarDef, tokenDef);

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
  var line = 0;
  var column = 0;

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
      lastToken = {type:key, value:candidate, pointer:pointer, line:line+1, column:column+1};
      stream.push(lastToken);
      var line_breaks_count = countLineBreak(candidate);
      line += line_breaks_count;
      if(line_breaks_count > 0) {
        column = 0;
      }
      column += countColumn(candidate);
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

function countLineBreak(str) {
  var m = str.split(/\n/g);
  return m.length - 1;
}

function countColumn(str) {
  var m = str.split(/\n/g);
  return m[m.length-1].length;
}

function copyToken(stoken, rtoken) {
  var t = {
    type:stoken.type,
    value:stoken.value,
    repeat:rtoken.repeat,
    line:stoken.line,
    column:stoken.column
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
    memo.line = result.line;
    memo.column = result.column;
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

  var rtoken = rule.tokens[rp];
  var stoken = stream[sp];

  var currentNode = {
    type: rule.key, 
    children:[], 
    start:pointer, 
    name:rule.name, 
    line:stoken.line, 
    column:stoken.column
  };

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
            line: result.line,
            column: result.column,
            hook: result.hook,
            name: rtoken.name,
            repeat: rtoken.repeat,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb2tlc2NyaXB0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QURuK0JBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBlcGVnanMsIGRlcHRoLCBmb3JMb29wQ291bnQsIHVucGFja2luZywgbmFtZXNwYWNlcywgbGV2ZWxTdGFjaywgcHJlZml4LCBhLCB0b2tlbkRlZiwgc3RySW50ZXJwb2xhdGlvblRva2VuRGVmLCBzdHJJbnRlcnBvbGF0aW9uR3JhbW1hckRlZiwgc3RyR3JhbSwgZ3JhbW1hckRlZiwgbmMsIGJhY2tlbmQsIGdyYW07XG4vLyBDb2tlU2NyaXB0IGxhbmd1YWdlIGJ5IEJhdGlzdGUgQmllbGVyIDIwMTVcbi8vIEltcGxlbWVudGVkIHVzaW5nIEVQRUcuSlNcblxuZXBlZ2pzID0gcmVxdWlyZShcImVwZWdqc1wiKTtcblxuZGVwdGggPSAwO1xuZm9yTG9vcENvdW50ID0gMTtcbnVucGFja2luZyA9IDA7XG5uYW1lc3BhY2VzID0gW3t9XTtcbmxldmVsU3RhY2sgPSBbMF07XG5wcmVmaXggPSAnX18nO1xuXG5hID0ge3Q6IDEsIHo6IDJ9O1xuXG5mdW5jdGlvbiBoZWxsbygpIHtcbiAgcmV0dXJuIHt0OiAxLCB6OiAyfTtcbn1cblxuZnVuY3Rpb24gY3VycmVudE5zKCkge1xuICByZXR1cm4gbmFtZXNwYWNlc1tuYW1lc3BhY2VzLmxlbmd0aCAtIDFdO1xufVxuXG5mdW5jdGlvbiBjdXJyZW50TnNIYXMocCkge1xuICByZXR1cm4gbmFtZXNwYWNlc1tuYW1lc3BhY2VzLmxlbmd0aCAtIDFdLmhhc093blByb3BlcnR5KHApO1xufVxuXG5mdW5jdGlvbiBuZXdOcygpIHtcbiAgbmFtZXNwYWNlcy5wdXNoKHt9KTtcbiAgcmV0dXJuIG5hbWVzcGFjZXNbbmFtZXNwYWNlcy5sZW5ndGggLSAxXTtcbn1cblxuZnVuY3Rpb24gcmVzZXRHbG9iYWwoKSB7XG4gIG5hbWVzcGFjZXMgPSBbe31dO1xuICBmb3JMb29wQ291bnQgPSAxO1xuICBsZXZlbFN0YWNrID0gWzBdO1xuICBkZXB0aCA9IDA7XG4gIHVucGFja2luZyA9IDA7XG59XG5cbi8vIHRva2VuIGFyZSBtYXRjaGVkIGluIG9yZGVyIG9mIGRlY2xhcmF0aW9uO1xuLy8gVE9ETzogYWRkIGZ1bmN0aW9uc1xuXG50b2tlbkRlZiA9IFtcbiAge2tleTogXCJzdHJpbmdcIiwgZnVuYzogc3RyaW5nRGVmfSxcbiAge2tleTogXCJjb21tZW50XCIsIGZ1bmM6IGNvbW1lbnREZWZ9LFxuICB7a2V5OiBcImZ1bmN0aW9uX2RlZlwiLCBmdW5jOiBkZWZEZWYsIHZlcmJvc2U6IFwiZnVuY3Rpb25cIn0sXG4gIHtrZXk6IFwiY2xhc3NcIiwgcmVnOiAvXmNsYXNzIC99LFxuICB7a2V5OiBcInJldFwiLCByZWc6IC9ecmV0dXJuLywgdmVyYm9zZTogXCJyZXR1cm5cIn0sXG4gIHtrZXk6IFwiaWZcIiwgcmVnOiAvXmlmIC99LFxuICB7a2V5OiBcIm9yXCIsIHJlZzogL15vciAvfSxcbiAge2tleTogXCJhbmRcIiwgcmVnOiAvXmFuZCAvfSxcbiAge2tleTogXCJ3aGlsZVwiLCByZWc6IC9ed2hpbGUgL30sXG4gIHtrZXk6IFwiaW5zdGFuY2VvZlwiLCByZWc6IC9eaW5zdGFuY2VvZiAvfSxcbiAge2tleTogXCJ0cnlcIiwgcmVnOiAvXnRyeS99LFxuICB7a2V5OiBcImNhdGNoXCIsIHJlZzogL15jYXRjaC99LFxuICB7a2V5OiBcInRocm93XCIsIHJlZzogL150aHJvdyAvfSxcbiAge2tleTogXCJwYXp6XCIsIHJlZzogL15wYXNzLywgdmVyYm9zZTogXCJwYXNzXCJ9LFxuICB7a2V5OiBcIm5ld1wiLCByZWc6IC9ebmV3IC99LFxuICB7a2V5OiBcInRhZ1wiLCByZWc6IC9ePFthLXpBLVpdWzAtOWEtekEtWl17MCwyOX0vfSxcbiAge2tleTogXCI+XCIsIHJlZzogL14+L30sXG4gIHtrZXk6IFwiZWxzZWlmXCIsIHJlZzogL15lbHNlaWYgL30sXG4gIHtrZXk6IFwiZWxzZVwiLCByZWc6IC9eZWxzZS99LFxuICB7a2V5OiBcImZvcl9sb29wXCIsIHJlZzogL15mb3IgLywgdmVyYm9zZTogXCJmb3IgbG9vcFwifSxcbiAge2tleTogXCJpblwiLCByZWc6IC9eaW4gL30sXG4gIHtrZXk6IFwibm90XCIsIHJlZzogL15ub3QgLywgdmVyYm9zZTogXCJub3RcIn0sXG4gIHtrZXk6IFwibmFtZVwiLCByZWc6IC9eW2EtekEtWl8kXVswLTlhLXpBLVpfJF17MCwyOX0vfSxcbiAge2tleTogXCJyZWdleHBcIiwgZnVuYzogcmVnRXhwRGVmLCB2ZXJib3NlOiBcInJlZ3VsYXIgZXhwcmVzc2lvblwifSxcbiAge2tleTogXCJtYXRoX29wZXJhdG9yc1wiLCByZWc6IC9eKFxcK1xcK3xcXC1cXC0pLywgdmVyYm9zZTogXCJtYXRoIG9wZXJhdG9yXCJ9LFxuICB7a2V5OiBcImJpbmFyeV9vcGVyYXRvcnNcIiwgcmVnOiAvXihcXCZcXCZ8XFx8XFx8fFxcJnxcXHx8PDx8XFw+XFw+KS8sIHZlcmJvc2U6IFwiYmluYXJ5IG9wZXJhdG9yXCJ9LFxuICB7a2V5OiBcImNvbXBhcmlzb25cIiwgcmVnOiAvXig8PXw+PXw8fD58IT18PT0pL30sXG4gIHtrZXk6IFwiYXNzaWduXCIsIHJlZzogL14oXFwrPXwtPXw9fDo9KS99LFxuICB7a2V5OiBcIm51bWJlclwiLCByZWc6IC9eWy1dP1swLTldK1xcLj9bMC05XSovfSxcbiAge2tleTogXCJjb21tYVwiLCByZWc6IC9eXFwsL30sXG4gIHtrZXk6IFwiZG90XCIsIHJlZzogL15cXC4vfSxcbiAge2tleTogXCJjb2xvblwiLCByZWc6IC9eXFw6LywgdmVyYm9zZTogXCI6XCJ9LFxuICB7a2V5OiBcIm9wZW5fcGFyXCIsIHJlZzogL15cXCgvLCB2ZXJib3NlOiBcIihcIn0sXG4gIHtrZXk6IFwiY2xvc2VfcGFyXCIsIHJlZzogL15cXCkvLCB2ZXJib3NlOiBcIilcIn0sXG4gIHtrZXk6IFwib3Blbl9icmFcIiwgcmVnOiAvXlxcWy8sIHZlcmJvc2U6IFwiW1wifSxcbiAge2tleTogXCJjbG9zZV9icmFcIiwgcmVnOiAvXlxcXS8sIHZlcmJvc2U6IFwiXVwifSxcbiAge2tleTogXCJvcGVuX2N1cmx5XCIsIHJlZzogL15cXHsvLCB2ZXJib3NlOiBcIntcIn0sXG4gIHtrZXk6IFwiY2xvc2VfY3VybHlcIiwgcmVnOiAvXlxcfS8sIHZlcmJvc2U6IFwifVwifSxcbiAge2tleTogXCJtYXRoXCIsIHJlZzogL15bLXxcXCt8XFwqfFxcL3wlXS99LFxuICB7a2V5OiBcInNhbWVkZW50XCIsIGZ1bmM6IGRlbnQoXCJzYW1lZGVudFwiKSwgdmVyYm9zZTogXCJzYW1lIGluZGVudGF0aW9uXCJ9LFxuICB7a2V5OiBcImRlZGVudFwiLCBmdW5jOiBkZW50KFwiZGVkZW50XCIpfSxcbiAge2tleTogXCJpbmRlbnRcIiwgZnVuYzogZGVudChcImluZGVudFwiKX0sXG4gIHtrZXk6IFwiV1wiLCByZWc6IC9eWyBdLywgdmVyYm9zZTogXCJzaW5nbGUgd2hpdGVzcGFjZVwifVxuXTtcblxuZnVuY3Rpb24gc3RhcnRTdHIoaW5wdXQsc3RyZWFtKSB7XG4gIHZhciBsYXN0O1xuICBsYXN0ID0gc3RyZWFtW3N0cmVhbS5sZW5ndGggLSAxXTtcbiAgaWYobGFzdCAmJiBsYXN0LnZhbHVlID09PSBcIlxcXFxcIikge1xuICAgIHJldHVybjtcbiAgfVxuICBpZihpbnB1dC5tYXRjaCgvXiN7LykpIHtcbiAgICByZXR1cm4gXCIje1wiO1xuICB9XG59XG5cbnN0ckludGVycG9sYXRpb25Ub2tlbkRlZiA9IFtcbiAge2tleTogXCJzdGFydFwiLCBmdW5jOiBzdGFydFN0cn0sXG4gIHtrZXk6IFwiZW5kXCIsIHJlZzogL159L30sXG4gIHtrZXk6IFwibmFtZVwiLCByZWc6IC9eW2EtekEtWl8kXVswLTlhLXpBLVpfXXswLDI5fS99LFxuICB7a2V5OiBcImRvdFwiLCByZWc6IC9eXFwuL30sXG4gIHtrZXk6IFwiY2hhclwiLCByZWc6IC9eLi99XG5dO1xuXG5zdHJJbnRlcnBvbGF0aW9uR3JhbW1hckRlZiA9IHtcbiAgU1RBUlQ6IHtydWxlczogW1wiRUwqIEVPRlwiXX0sXG4gIEVMOiB7cnVsZXM6IFtcIlZBUlwiLCBcImNoYXJcIiwgXCJuYW1lXCIsIFwic3RhcnRcIiwgXCJlbmRcIiwgXCJkb3RcIl19LFxuICBWQVI6IHtydWxlczogW1wic3RhcnQgTkFNRSBlbmRcIl19LFxuICBOQU1FOiB7cnVsZXM6IFtcIm5hbWUgZG90IE5BTUVcIiwgXCJuYW1lXCJdfVxufTtcblxuc3RyR3JhbSA9IGVwZWdqcy5jb21waWxlR3JhbW1hcihzdHJJbnRlcnBvbGF0aW9uR3JhbW1hckRlZiwgc3RySW50ZXJwb2xhdGlvblRva2VuRGVmKTtcblxuZnVuY3Rpb24gZ2VuZXJhdGVTdHJpbmdDb2RlKG5vZGUsYykge1xuICB2YXIgc3RyO1xuICBpZihub2RlLnR5cGUgPT09ICdWQVInKSB7XG4gICAgcmV0dXJuIGMgKyAnICsgJyArIGdlbmVyYXRlU3RyaW5nQ29kZShub2RlLmNoaWxkcmVuWzFdLCBjKSArICcgKyAnICsgYztcbiAgfVxuICBcbiAgaWYobm9kZS52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG5vZGUudmFsdWU7XG4gIH1cbiAgXG4gIHN0ciA9ICcnO1xuICBpZighbm9kZS5jaGlsZHJlbikge1xuICAgIHJldHVybiAnJztcbiAgfVxuICBcbiAgdmFyIF9fa2V5czEgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgZm9yKHZhciBfX2luZGV4MSA9IDA7IF9faW5kZXgxIDwgX19rZXlzMS5sZW5ndGg7IF9faW5kZXgxKyspIHtcbiAgICB2YXIgY2hpbGQgPSBub2RlLmNoaWxkcmVuW19fa2V5czFbX19pbmRleDFdXTtcbiAgICBzdHIgKz0gZ2VuZXJhdGVTdHJpbmdDb2RlKGNoaWxkLCBjKTtcbiAgfVxuICByZXR1cm4gc3RyO1xufVxuXG5mdW5jdGlvbiBjdXJyZW50TGV2ZWwoKSB7XG4gIHJldHVybiBsZXZlbFN0YWNrW2xldmVsU3RhY2subGVuZ3RoIC0gMV07XG59XG5cbmZ1bmN0aW9uIGluZGVudFR5cGUobCkge1xuICBpZihsID4gY3VycmVudExldmVsKCkpIHtcbiAgICByZXR1cm4gJ2luZGVudCc7XG4gIH1cbiAgXG4gIGlmKGwgPCBjdXJyZW50TGV2ZWwoKSkge1xuICAgIHJldHVybiAnZGVkZW50JztcbiAgfVxuICBcbiAgaWYobCA9PT0gY3VycmVudExldmVsKCkpIHtcbiAgICByZXR1cm4gJ3NhbWVkZW50JztcbiAgfVxufVxuXG5mdW5jdGlvbiBkZW50KGRlbnRUeXBlKSB7XG4gIHJldHVybiBmdW5jdGlvbiBfZGVudChpbnB1dCkge1xuICAgIHZhciBtLCBsaW5lcywgaW5kZW50O1xuICAgIC8vIGVtcHR5IGxpbmUgaXMgYSBzYW1lZGVudFxuICAgIG0gPSBpbnB1dC5tYXRjaCgvXlxcbltcXHNdKi8pO1xuICAgIGlmKG0pIHtcbiAgICAgIGxpbmVzID0gbVswXS5zcGxpdChcIlxcblwiKTtcbiAgICAgIGluZGVudCA9IGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdLmxlbmd0aDtcbiAgICAgIGlmKGluZGVudFR5cGUoaW5kZW50KSA9PT0gZGVudFR5cGUpIHtcbiAgICAgICAgaWYoZGVudFR5cGUgPT09ICdkZWRlbnQnKSB7XG4gICAgICAgICAgbGV2ZWxTdGFjay5wb3AoKTtcbiAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmKGRlbnRUeXBlID09PSAnaW5kZW50Jykge1xuICAgICAgICAgIGxldmVsU3RhY2sucHVzaChpbmRlbnQpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gbVswXTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG5cbmZ1bmN0aW9uIHN0cmluZ0RlZihpbnB1dCkge1xuICB2YXIgZmlyc3QsIGksIGNoO1xuICBmaXJzdCA9IGlucHV0LmNoYXJBdCgwKTtcbiAgaWYoZmlyc3QgPT09ICdcIicgfHwgZmlyc3QgPT09IFwiJ1wiKSB7XG4gICAgaSA9IDE7XG4gICAgd2hpbGUoaW5wdXQuY2hhckF0KGkpKXtcbiAgICAgIGNoID0gaW5wdXQuY2hhckF0KGkpO1xuICAgICAgaWYoY2ggPT09ICdcXFxcJykge1xuICAgICAgICBpKys7XG4gICAgICB9IGVsc2UgaWYoY2ggPT09IGZpcnN0KSB7XG4gICAgICAgIHJldHVybiBpbnB1dC5zbGljZSgwLCBpICsgMSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHJlZ0V4cERlZihpbnB1dCkge1xuICB2YXIgaSwgY2g7XG4gIGlmKGlucHV0LmNoYXJBdCgwKSA9PT0gJy8nKSB7XG4gICAgaSA9IDE7XG4gICAgd2hpbGUoaW5wdXQuY2hhckF0KGkpKXtcbiAgICAgIGNoID0gaW5wdXQuY2hhckF0KGkpO1xuICAgICAgaWYoY2ggPT09ICdcXFxcJykge1xuICAgICAgICBpKys7XG4gICAgICB9IGVsc2UgaWYoY2ggPT09ICcvJykge1xuICAgICAgICBpKys7XG4gICAgICAgIC8vIG1vZGlmaWVyc1xuICAgICAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkgJiYgXCJpZ21cIi5pbmRleE9mKGlucHV0LmNoYXJBdChpKSkgIT09IC0xKXtcbiAgICAgICAgICBpKys7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGlucHV0LnNsaWNlKDAsIGkpO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBkZWZEZWYoaW5wdXQpIHtcbiAgaWYoaW5wdXQubWF0Y2goL15kZWZbXFwofCB8XFxuXS8pKSB7XG4gICAgcmV0dXJuIFwiZGVmXCI7XG4gIH1cbiAgXG4gIGlmKGlucHV0LmluZGV4T2YoXCJkb20gXCIpID09PSAwKSB7XG4gICAgcmV0dXJuIFwiZG9tXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tbWVudERlZihpbnB1dCkge1xuICB2YXIgbSwgaSwgY2g7XG4gIG0gPSBpbnB1dC5tYXRjaCgvXiMvKTtcbiAgaWYobSkge1xuICAgIGkgPSBtWzBdLmxlbmd0aDtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpe1xuICAgICAgY2ggPSBpbnB1dC5jaGFyQXQoaSk7XG4gICAgICBpZihjaCA9PT0gJ1xcbicpIHtcbiAgICAgICAgcmV0dXJuIGlucHV0LnNsaWNlKDAsIGkpO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiByZWZsZWN0KHBhcmFtcykgeyByZXR1cm4gcGFyYW1zOyB9XG5cbmdyYW1tYXJEZWYgPSB7XG4gIFNUQVJUOiB7cnVsZXM6IFtcIkxJTkUqIEVPRlwiXX0sXG4gIEVMQzoge3J1bGVzOiBbXCJXKiBjb21tZW50XCJdLCB2ZXJib3NlOiBcImNvbW1lbnRcIn0sXG4gIExJTkU6IHtydWxlczogW1wiU1RBVEVNRU5UIEVMQz8gc2FtZWRlbnQrXCIsIFwiU1RBVEVNRU5UIEVMQz8gIWRlZGVudFwiLCBcbiAgICBcIkVMQz8gc2FtZWRlbnRcIiwgXCJFTEMgIWRlZGVudFwiXSwgdmVyYm9zZTogXCJuZXcgbGluZVwifSxcbiAgQkxPQ0s6IHtydWxlczogW1wiaW5kZW50IHBhenogZGVkZW50XCIsIFwiaW5kZW50IExJTkUrIGRlZGVudFwiXX0sXG4gIFNUQVRFTUVOVDoge3J1bGVzOiBbXCJBU1NJR05cIiwgXCJFWFBSXCIsIFwiSUZcIiwgXCJXSElMRVwiLCBcIkZPUlwiLCBcIlJFVFVSTlwiLCBcbiAgICBcIkNMQVNTXCIsIFwiVEFHXCIsIFwiRE9NX0FTU0lHTlwiLCBcIlRSWV9DQVRDSFwiLCBcIlRIUk9XXCJdfSxcbiAgQ0xBU1NfTUVUSE9EUzoge1xuICAgIHJ1bGVzOiBbXCJzYW1lZGVudCogZjpGVU5DX0RFRiBzYW1lZGVudCpcIl0sXG4gICAgaG9va3M6IFtmdW5jdGlvbiAocCkgeyByZXR1cm4gcC5mOyB9XVxuICB9LFxuICBDTEFTUzoge1xuICAgIHJ1bGVzOiBbXG4gICAgICBcImNsYXNzIG46bmFtZSBvcGVuX3BhciBwOm5hbWUgY2xvc2VfcGFyIGluZGVudCBtOkNMQVNTX01FVEhPRFMrIGRlZGVudFwiLFxuICAgICAgXCJjbGFzcyBuOm5hbWUgaW5kZW50IG06Q0xBU1NfTUVUSE9EUysgZGVkZW50XCJcbiAgICBdLFxuICAgIGhvb2tzOiBbXG4gICAgICBmdW5jdGlvbiAocCkgeyByZXR1cm4ge25hbWU6IHAubiwgbWV0aG9kczogcC5tLCBwYXJlbnQ6IHAucH07IH0sXG4gICAgICBmdW5jdGlvbiAocCkgeyByZXR1cm4ge25hbWU6IHAubiwgbWV0aG9kczogcC5tfTsgfVxuICAgIF1cbiAgfSxcbiAgRlVOQ19ERUZfUEFSQU1TOiB7cnVsZXM6IFtcbiAgICBcInAxOkZVTkNfREVGX1BBUkFNUyBjb21tYSBXIHAyOkZVTkNfREVGX1BBUkFNU1wiLFxuICAgIFwicDE6bmFtZSBhc3NpZ24gZTpFWFBSXCIsXG4gICAgXCJwMTpuYW1lXCJcbiAgICBdLFxuICAgIHZlcmJvc2U6IFwiZGVmIHBhcmFtZXRlcnNcIlxuICB9LFxuICBMQU1CREE6IHtydWxlczogW1xuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIG9wZW5fcGFyIHBhcmFtczpGVU5DX0RFRl9QQVJBTVM/IGNsb3NlX3BhciBXIGJsb2NrOkVYUFJcIixcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGZuOm5hbWUgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIFcgYmxvY2s6RVhQUlwiLFxuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgYmxvY2s6RVhQUlwiXG4gICAgXSxcbiAgICBob29rczogW3JlZmxlY3QsIHJlZmxlY3QsIHJlZmxlY3RdXG4gIH0sXG4gIEZVTkNfREVGOiB7cnVsZXM6IFtcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBvcGVuX3BhciBwYXJhbXM6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgYmxvY2s6QkxPQ0tcIixcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGZuOm5hbWUgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIGJsb2NrOkJMT0NLXCIsXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgVyBmbjpuYW1lIGJsb2NrOkJMT0NLXCIsXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgYmxvY2s6QkxPQ0tcIlxuICAgIF0sXG4gICAgaG9va3M6IFtyZWZsZWN0LCByZWZsZWN0LCByZWZsZWN0LCByZWZsZWN0XSxcbiAgICB2ZXJib3NlOiBcImRlZiBkZWZpbml0aW9uXCJcbiAgfSxcbiAgRUxTRV9JRjoge3J1bGVzOiBbXCJzYW1lZGVudCBlbHNlaWYgZTpFWFBSIGI6QkxPQ0tcIl0sIGhvb2tzOiBbcmVmbGVjdF19LFxuICBFTFNFOiB7cnVsZXM6IFtcInNhbWVkZW50IGVsc2UgYjpCTE9DS1wiXSwgaG9va3M6IFtyZWZsZWN0XX0sXG4gIElGOiB7cnVsZXM6IFtcImlmIGU6RVhQUiBiOkJMT0NLIGVsaWY6RUxTRV9JRiogZWw6RUxTRT9cIl0sIGhvb2tzOiBbcmVmbGVjdF19LFxuICBFTFNFX0VYUFI6IHtydWxlczogW1wiVyBlbHNlIFcgYjpFWFBSXCJdLCBob29rczogW3JlZmxlY3RdfSxcbiAgSUZfRVhQUjoge3J1bGVzOiBbXCJlOkVYUFIgVyBpZiB0ZXN0OkVYUFIgZWw6RUxTRV9FWFBSP1wiXSwgaG9va3M6IFtyZWZsZWN0XX0sXG4gIFdISUxFOiB7cnVsZXM6IFtcIndoaWxlIGU6RVhQUiBiOkJMT0NLXCJdLCBob29rczogW3JlZmxlY3RdfSxcbiAgTUFUSDoge3J1bGVzOiBbXCJlMTpFWFBSIFcgb3A6bWF0aCBXIGUyOkVYUFJcIl19LFxuICBQQVRIOiB7cnVsZXM6IFtcIlBBVEggZG90IG5hbWVcIiwgXCJQQVRIIG9wZW5fYnJhIG51bWJlciBjbG9zZV9icmFcIiwgXCJuYW1lXCJdfSxcbiAgQVNTSUdOOiB7cnVsZXM6IFtcbiAgICBcImxlZnQ6RVhQUiBXIG9wOmFzc2lnbiBXIHJpZ2h0OkVYUFJcIixcbiAgICBcImxlZnQ6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSIFcgb3A6YXNzaWduIFcgcmlnaHQ6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSXCIsXG4gICAgXCJsZWZ0OlNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUiBXIG9wOmFzc2lnbiBXIHJpZ2h0OkVYUFJcIlxuICBdLCBob29rczogW3JlZmxlY3QsIHJlZmxlY3QsIHJlZmxlY3RdfSxcbiAgV19PUl9TQU1FREVOVDoge3J1bGVzOiBbXCJXXCIsIFwic2FtZWRlbnRcIl0sIHZlcmJvc2U6IFwic2FtZWRlbnQgb3Igd2hpdGVzcGFjZVwifSxcbiAgV19TQU1FREVOVF9JTkRFTlQ6IHtydWxlczogW1wiV1wiLCBcInNhbWVkZW50XCIsIFwiaW5kZW50XCJdLCB2ZXJib3NlOiBcImluZGVudCBvciBzYW1lZGVudCBvciB3aGl0ZXNwYWNlXCJ9LFxuICBBTllfU1BBQ0U6IHtydWxlczogW1wiV1wiLCBcInNhbWVkZW50XCIsIFwiaW5kZW50XCIsIFwiZGVkZW50XCIsIFwiY29tbWVudFwiXSwgdmVyYm9zZTogXCJhbnkgc3BhY2VcIn0sXG4gIEZVTkNfQ0FMTF9QQVJBTVM6IHtydWxlczogW1wiRVhQUiBjb21tYSBBTllfU1BBQ0UrIEZVTkNfQ0FMTF9QQVJBTVMgQU5ZX1NQQUNFKlwiLCBcIkVYUFIgQU5ZX1NQQUNFKlwiXX0sXG4gIEZVTkNfQ0FMTDoge3J1bGVzOiBbXG4gICAgXCJvcGVuX3BhciBGVU5DX0NBTExfUEFSQU1TPyBjbG9zZV9wYXJcIlxuICBdfSxcbiAgXG4gIFRZUEU6IHtydWxlczogW1wibmFtZSBjb2xvblwiXX0sXG4gIFxuICBGT1I6IHtydWxlczogW1xuICAgIFwiZm9yX2xvb3AgazpuYW1lIGNvbW1hIFcgdjpuYW1lIFcgaW4gYTpFWFBSIGI6QkxPQ0tcIixcbiAgICBcImZvcl9sb29wIHY6bmFtZSBXIGluIGE6RVhQUiBiOkJMT0NLXCJdLFxuICAgIGhvb2tzOiBbcmVmbGVjdCwgcmVmbGVjdF1cbiAgfSxcbiAgXG4gIFNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUjoge3J1bGVzOiBbXG4gICAgXCJlMTpFWFBSIGNvbW1hIFcgZTI6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSXCIsXG4gICAgXCJlMTpFWFBSIGNvbW1hIFcgZTI6RVhQUlwiXG4gIF0sXG4gIGhvb2tzOiBbXG4gICAgZnVuY3Rpb24gKHApIHsgcmV0dXJuIFtwLmUxXS5jb25jYXQocC5lMi5jaGlsZHJlbik7IH0sIGZ1bmN0aW9uIChwKSB7IHJldHVybiBbcC5lMSwgcC5lMl07IH1cbiAgXSBcbiAgfSxcbiAgXG4gIENPTU1BX1NFUEFSQVRFRF9FWFBSOiB7cnVsZXM6IFtcbiAgICBcIkVYUFIgY29tbWEgQU5ZX1NQQUNFKyBDT01NQV9TRVBBUkFURURfRVhQUiBBTllfU1BBQ0UqXCIsXG4gICAgXCJFWFBSIEFOWV9TUEFDRSpcIlxuICBdfSxcbiAgXG4gIEFSUkFZOiB7cnVsZXM6IFtcbiAgICBcIm9wZW5fYnJhIEFOWV9TUEFDRSogYzpDT01NQV9TRVBBUkFURURfRVhQUj8gQU5ZX1NQQUNFKiBjbG9zZV9icmFcIlxuICBdfSxcbiAgXG4gIE1FTUJFUlM6IHtydWxlczogW1xuICAgIFwibmFtZSBjb2xvbiBXIEVYUFIgc2FtZWRlbnQ/IGNvbW1hIEFOWV9TUEFDRSsgTUVNQkVSUyBBTllfU1BBQ0UqXCIsXG4gICAgXCJuYW1lIGNvbG9uIFcgRVhQUiBBTllfU1BBQ0UqXCJcbiAgXX0sXG4gIFxuICBPQkpFQ1Q6IHtydWxlczogW1xuICAgIFwib3Blbl9jdXJseSBpbmRlbnQ/IE1FTUJFUlM/IGNsb3NlX2N1cmx5XCJcbiAgXX0sXG4gIFxuICBUQUdfUEFSQU1TOiB7cnVsZXM6IFtcbiAgICBcImxlZnQ6VEFHX1BBUkFNUyBXIHJpZ2h0OlRBR19QQVJBTVNcIixcbiAgICBcIm46bmFtZSBhc3NpZ24gZTpFWFBSXCIsXG4gICAgXCJuOm5hbWVcIlxuICAgIF0sXG4gICAgaG9va3M6IFtyZWZsZWN0LCByZWZsZWN0LCByZWZsZWN0XSxcbiAgICB2ZXJib3NlOiBcInRhZyBwYXJhbWV0ZXJzXCJcbiAgfSxcbiAgXG4gIFRBRzoge3J1bGVzOiBbXG4gICAgXCJ0YWc6dGFnIFc/IHBhcmFtczpUQUdfUEFSQU1TPyBlbmQ6Pj8gYmxvY2s6QkxPQ0s/XCJcbiAgXSxcbiAgaG9va3M6IFtyZWZsZWN0XVxuICB9LFxuICBcbiAgRE9NX0FTU0lHTjoge3J1bGVzOiBbXG4gICAgXCJhc3NpZ24gRVhQUlwiXG4gIF19LFxuICBcbiAgVFJZX0NBVENIOiB7cnVsZXM6IFtcbiAgICBcInRyeSBiMTpCTE9DSyBzYW1lZGVudD8gY2F0Y2ggb3Blbl9wYXIgZXJyOm5hbWU/IGNsb3NlX3BhciBiMjpCTE9DS1wiXG4gICAgXSxcbiAgICBob29rczogW3JlZmxlY3RdXG4gIH0sXG4gIFxuICBUSFJPVzoge3J1bGVzOiBbXG4gICAgXCJ0aHJvdyBFWFBSXCJcbiAgXX0sXG4gIFxuICBSRVRVUk46IHtydWxlczogW1wicmV0IFcgU1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSXCIsIFwicmV0IFcgRVhQUlwiLCBcInJldFwiXX0sXG4gIFJJR0hUX0VYUFI6IHtydWxlczogW1xuICAgIFwibWF0aF9vcGVyYXRvcnNcIixcbiAgICBcIlcgYmluYXJ5X29wZXJhdG9ycyBXIEVYUFJcIixcbiAgICBcIlcgb3IgRVhQUlwiLFxuICAgIFwiVyBhbmQgRVhQUlwiLFxuICAgIFwiVyBjb21wYXJpc29uIFcgRVhQUlwiLFxuICAgIFwiVyA+IFcgRVhQUlwiLFxuICAgIFwiZG90IEVYUFJcIixcbiAgICBcIlcgaW5zdGFuY2VvZiBFWFBSXCIsXG4gICAgXCJvcGVuX2JyYSBFWFBSIGNsb3NlX2JyYVwiLFxuICAgIFwiRlVOQ19DQUxMXCJcbiAgICBdLFxuICAgIHZlcmJvc2U6IFwiZXhwcmVzc2lvblwiXG4gIH0sXG4gIFxuICBFWFBSOiB7cnVsZXM6IFtcbiAgICBcIklGX0VYUFJcIixcbiAgICBcIk1BVEhcIixcbiAgICBcIk9CSkVDVFwiLFxuICAgIFwiRlVOQ19ERUZcIixcbiAgICBcIkVYUFIgUklHSFRfRVhQUlwiLFxuICAgIFwibmFtZVwiLFxuICAgIFwibnVtYmVyXCIsXG4gICAgXCJMQU1CREFcIixcbiAgICBcInN0cmluZ1wiLFxuICAgIFwicmVnZXhwXCIsXG4gICAgXCJvcGVuX3BhciBFWFBSIGNsb3NlX3BhclwiLFxuICAgIFwibmV3IEVYUFJcIixcbiAgICBcIm5vdCBFWFBSXCIsXG4gICAgXCJBUlJBWVwiXG4gICAgXSxcbiAgICB2ZXJib3NlOiBcImV4cHJlc3Npb25cIlxuICB9XG59O1xuXG5mdW5jdGlvbiBzcGFjZXIobikge1xuICB2YXIgb3V0LCBpO1xuICBvdXQgPSBcIlwiO1xuICBpID0gMDtcbiAgd2hpbGUoaSA8IG4pe1xuICAgIG91dCArPSBcIiBcIjtcbiAgICBpKys7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cblxuZnVuY3Rpb24gc3AobW9kKSB7XG4gIGlmKG1vZCkge1xuICAgIHJldHVybiBzcGFjZXIoMiAqIChkZXB0aCArIG1vZCkpO1xuICB9XG4gIHJldHVybiBzcGFjZXIoMiAqIGRlcHRoKTtcbn1cblxubmMgPSAxO1xuXG4vLyBjaGlsZHJlbiBuYW1lXG5mdW5jdGlvbiBDTigpIHtcbiAgcmV0dXJuIHByZWZpeCArICdjJyArIG5jO1xufVxuXG5mdW5jdGlvbiBwdXNoQ04oKSB7XG4gIG5jKys7XG4gIHJldHVybiBwcmVmaXggKyAnYycgKyBuYztcbn1cblxuZnVuY3Rpb24gcG9wQ04oKSB7XG4gIG5jLS07XG4gIHJldHVybiBwcmVmaXggKyAnYycgKyBuYztcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVIb2lzdGVkVmFyKCkge1xuICB2YXIgbnMsIGhvaXN0ZWQ7XG4gIG5zID0gY3VycmVudE5zKCk7XG4gIGhvaXN0ZWQgPSBbXTtcbiAgdmFyIF9fa2V5czIgPSBPYmplY3Qua2V5cyhucyk7XG4gIGZvcih2YXIgX19pbmRleDIgPSAwOyBfX2luZGV4MiA8IF9fa2V5czIubGVuZ3RoOyBfX2luZGV4MisrKSB7XG4gICAgdmFyIGtleSA9IF9fa2V5czJbX19pbmRleDJdO1xuICAgIHZhciB2YWx1ZSA9IG5zW19fa2V5czJbX19pbmRleDJdXTtcbiAgICBpZih2YWx1ZSA9PT0gJ2hvaXN0Jykge1xuICAgICAgaG9pc3RlZC5wdXNoKGtleSk7XG4gICAgfVxuICB9XG4gIGlmKGhvaXN0ZWQubGVuZ3RoKSB7XG4gICAgcmV0dXJuICd2YXIgJyArIGhvaXN0ZWQuam9pbignLCAnKSArICc7JztcbiAgfVxuICByZXR1cm4gJyc7XG59XG5cbmZ1bmN0aW9uIGhvaXN0VmFyKG5hbWUpIHtcbiAgdmFyIG5zO1xuICBucyA9IGN1cnJlbnROcygpO1xuICBuc1tuYW1lXSA9ICdob2lzdCc7XG59XG5cbmJhY2tlbmQgPSB7XG4gIFNUQVJUOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHIsIGhvaXN0ZWQ7XG4gICAgc3RyID0gJyc7XG4gICAgdmFyIF9fa2V5czMgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgICBmb3IodmFyIF9faW5kZXgzID0gMDsgX19pbmRleDMgPCBfX2tleXMzLmxlbmd0aDsgX19pbmRleDMrKykge1xuICAgICAgdmFyIGNoaWxkID0gbm9kZS5jaGlsZHJlbltfX2tleXMzW19faW5kZXgzXV07XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKGNoaWxkKTtcbiAgICB9XG4gICAgaG9pc3RlZCA9IGdlbmVyYXRlSG9pc3RlZFZhcigpO1xuICAgIGlmKGhvaXN0ZWQpIHtcbiAgICAgIHJldHVybiBnZW5lcmF0ZUhvaXN0ZWRWYXIoKSArICdcXG4nICsgc3RyO1xuICAgIH1cbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgZGVkZW50OiBmdW5jdGlvbiAobm9kZSkge1xuICAgIGRlcHRoID0gTWF0aC5tYXgoMCwgZGVwdGggLSAxKTtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgLFxuICBpbmRlbnQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgZGVwdGggPSBkZXB0aCArIDE7XG4gICAgcmV0dXJuICdcXG4nICsgc3AoKTtcbiAgfVxuICAsXG4gIHNhbWVkZW50OiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBsLCBpLCBzdHI7XG4gICAgbCA9IG5vZGUudmFsdWUuc3BsaXQoJ1xcbicpLmxlbmd0aCAtIDE7XG4gICAgaSA9IDA7XG4gICAgc3RyID0gJyc7XG4gICAgd2hpbGUoaSA8IGwpe1xuICAgICAgc3RyICs9ICdcXG4nICsgc3AoKTtcbiAgICAgIGkrKztcbiAgICB9XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuICAsXG4gIERPTV9BU1NJR046IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIG5hbWUsIHZhcm5hbWUsIHN0cjtcbiAgICBuYW1lID0gQ04oKTtcbiAgICB2YXJuYW1lID0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bMV0pO1xuICAgIGhvaXN0VmFyKENOKCkpO1xuICAgIGhvaXN0VmFyKCcnICsgcHJlZml4ICsgJ3RtcCcpO1xuICAgIHN0ciA9ICcnICsgcHJlZml4ICsgJ3RtcCA9ICcgKyB2YXJuYW1lICsgJzsgJyArIHByZWZpeCArICd0bXAgaW5zdGFuY2VvZiBBcnJheSA/ICgnICsgbmFtZSArICcgPSAnICsgbmFtZSArICcuY29uY2F0KCcgKyBwcmVmaXggKyAndG1wKSkgOiAnICsgbmFtZSArICcucHVzaChTdHJpbmcoJyArIHByZWZpeCArICd0bXApKSc7XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuICAsXG4gIFRBR19QQVJBTVM6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIG5hbWU7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5sZWZ0KSB7XG4gICAgICByZXR1cm4gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ubGVmdCkgKyAnLCAnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucmlnaHQpO1xuICAgIH1cbiAgICBcbiAgICBuYW1lID0gbm9kZS5jaGlsZHJlbi5uLnZhbHVlO1xuICAgIFxuICAgIGlmKG5vZGUuY2hpbGRyZW4uZSkge1xuICAgICAgcmV0dXJuIG5hbWUgKyAnOiAnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBuYW1lICsgJzogdHJ1ZSc7XG4gICAgfVxuICB9XG4gICxcbiAgVEFHOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHIsIHBhcmFtcywgbmFtZSwgc3ViLCBucztcbiAgICBzdHIgPSAnJztcbiAgICBwYXJhbXMgPSBcIntcIjtcbiAgICBuYW1lID0gbm9kZS5jaGlsZHJlbi50YWcudmFsdWUuc3Vic3RyaW5nKDEpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ucGFyYW1zKSB7XG4gICAgICBwYXJhbXMgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucGFyYW1zKTtcbiAgICB9XG4gICAgXG4gICAgcGFyYW1zICs9ICd9JztcbiAgICBzdWIgPSAnW10nO1xuICAgIG5zID0gY3VycmVudE5zKCk7XG4gICAgXG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgc3ViID0gcHVzaENOKCk7XG4gICAgICBzdHIgKz0gQ04oKSArICcgPSBbXTsnO1xuICAgICAgaG9pc3RWYXIoQ04oKSk7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYmxvY2spO1xuICAgICAgcG9wQ04oKTtcbiAgICB9XG4gICAgXG4gICAgc3RyICs9ICdcXG4nICsgc3AoKSArIENOKCkgKyAnLnB1c2godmlydHVhbERvbS5oKFwiJyArIG5hbWUgKyAnXCIsIHthdHRyaWJ1dGVzOiAnICsgcGFyYW1zICsgJ30sICcgKyBzdWIgKyAnKSknO1xuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgLFxuICBDTEFTUzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgbmFtZSwgZnVuY3MsIHBhcmVudCwgc3RyLCBjb25zdHJ1Y3RvciwgZnVuY19kZWYsIGZ1bmNfbmFtZSwgbnMsIHBhcmFtcywgYm9keSwgY29uc19zdHI7XG4gICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4ubmFtZS52YWx1ZTtcbiAgICBmdW5jcyA9IG5vZGUuY2hpbGRyZW4ubWV0aG9kcztcbiAgICBwYXJlbnQgPSBub2RlLmNoaWxkcmVuLnBhcmVudDtcbiAgICBzdHIgPSAnJztcbiAgICBjb25zdHJ1Y3RvciA9IG51bGw7XG4gICAgdmFyIF9fa2V5czQgPSBPYmplY3Qua2V5cyhmdW5jcyk7XG4gICAgZm9yKHZhciBfX2luZGV4NCA9IDA7IF9faW5kZXg0IDwgX19rZXlzNC5sZW5ndGg7IF9faW5kZXg0KyspIHtcbiAgICAgIHZhciBmdW5jID0gZnVuY3NbX19rZXlzNFtfX2luZGV4NF1dO1xuICAgICAgZnVuY19kZWYgPSBmdW5jLmNoaWxkcmVuO1xuICAgICAgZnVuY19uYW1lID0gZnVuY19kZWYuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICBpZihmdW5jX25hbWUgPT09ICdjb25zdHJ1Y3RvcicpIHtcbiAgICAgICAgY29uc3RydWN0b3IgPSBmdW5jX2RlZjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSAnXFxuJyArIHNwKCkgKyBuYW1lICsgJy5wcm90b3R5cGUuJyArIGZ1bmNfbmFtZSArICcgPSAnICsgZ2VuZXJhdGVDb2RlKGZ1bmNfZGVmKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgaG9pc3RWYXIobmFtZSk7XG4gICAgbnMgPSBuZXdOcygpO1xuICAgIFxuICAgIHBhcmFtcyA9IGNvbnN0cnVjdG9yICYmIGNvbnN0cnVjdG9yLmNoaWxkcmVuLnBhcmFtcztcbiAgICBpZihwYXJhbXMpIHtcbiAgICAgIHBhcmFtcyA9IGdlbmVyYXRlQ29kZShwYXJhbXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJhbXMgPSAnJztcbiAgICB9XG4gICAgXG4gICAgYm9keSA9IGNvbnN0cnVjdG9yICYmIGNvbnN0cnVjdG9yLmNoaWxkcmVuLmJsb2NrO1xuICAgIGNvbnNfc3RyID0gJycgKyBuYW1lICsgJyA9IGZ1bmN0aW9uICcgKyBuYW1lICsgJyAoICcgKyBwYXJhbXMgKyAnICkgeyc7XG4gICAgY29uc19zdHIgKz0gJ1xcbicgKyBzcCgxKSArICdpZighKHRoaXMgaW5zdGFuY2VvZiAnICsgbmFtZSArICcpKXsgcmV0dXJuIG5ldyAnICsgbmFtZSArICcoJyArIE9iamVjdC5rZXlzKG5zKS5qb2luKCcsJykgKyAnKX0nO1xuICAgIHZhciBfX2tleXM1ID0gT2JqZWN0LmtleXMobnMpO1xuICAgIGZvcih2YXIgX19pbmRleDUgPSAwOyBfX2luZGV4NSA8IF9fa2V5czUubGVuZ3RoOyBfX2luZGV4NSsrKSB7XG4gICAgICB2YXIga2V5ID0gX19rZXlzNVtfX2luZGV4NV07XG4gICAgICB2YXIgdmFsdWUgPSBuc1tfX2tleXM1W19faW5kZXg1XV07XG4gICAgICBpZih2YWx1ZSAhPT0gdHJ1ZSAmJiB2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnNfc3RyICs9ICdcXG4nICsgc3AoMSkgKyAnaWYoJyArIGtleSArICcgPT09IHVuZGVmaW5lZCkgeycgKyBrZXkgKyAnID0gJyArIGdlbmVyYXRlQ29kZSh2YWx1ZSkgKyAnfSc7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGJvZHkpIHtcbiAgICAgIGNvbnNfc3RyICs9IGdlbmVyYXRlQ29kZShib2R5KTtcbiAgICB9XG4gICAgY29uc19zdHIgKz0gc3AoKSArICdcXG59JztcbiAgICBcbiAgICBpZihwYXJlbnQpIHtcbiAgICAgIGNvbnNfc3RyICs9ICdcXG4nICsgc3AoKSArICcnICsgbmFtZSArICcucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSgnICsgcGFyZW50LnZhbHVlICsgJy5wcm90b3R5cGUpJztcbiAgICAgIGNvbnNfc3RyICs9ICdcXG4nICsgc3AoKSArICcnICsgbmFtZSArICcucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gJyArIG5hbWUgKyAnJztcbiAgICB9XG4gICAgXG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICByZXR1cm4gY29uc19zdHIgKyBzdHI7XG4gIH1cbiAgLFxuICBMQU1CREE6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIG5hbWUsIG5zLCBzdHIsIGNvZGU7XG4gICAgbmFtZSA9IFwiXCI7XG4gICAgbnMgPSBuZXdOcygpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uZm4pIHtcbiAgICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuLmZuLnZhbHVlO1xuICAgICAgbnNbbmFtZV0gPSB0cnVlO1xuICAgIH1cbiAgICBcbiAgICBzdHIgPSBcImZ1bmN0aW9uIFwiICsgbmFtZSArIFwiKFwiO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ucGFyYW1zKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucGFyYW1zLCBucyk7XG4gICAgfVxuICAgIFxuICAgIHN0ciArPSAnKSB7JztcbiAgICB2YXIgX19rZXlzNiA9IE9iamVjdC5rZXlzKG5zKTtcbiAgICBmb3IodmFyIF9faW5kZXg2ID0gMDsgX19pbmRleDYgPCBfX2tleXM2Lmxlbmd0aDsgX19pbmRleDYrKykge1xuICAgICAgdmFyIGtleSA9IF9fa2V5czZbX19pbmRleDZdO1xuICAgICAgdmFyIHZhbHVlID0gbnNbX19rZXlzNltfX2luZGV4Nl1dO1xuICAgICAgaWYodmFsdWUgIT09IHRydWUgJiYgdmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb2RlID0gZ2VuZXJhdGVDb2RlKHZhbHVlKTtcbiAgICAgICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyAnaWYoJyArIGtleSArICcgPT09IHVuZGVmaW5lZCkgeycgKyBrZXkgKyAnID0gJyArIGNvZGUgKyAnfSc7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmKG5vZGUuY2hpbGRyZW4uYmxvY2spIHtcbiAgICAgIHN0ciArPSAnIHJldHVybiAnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYmxvY2ssIG5zKTtcbiAgICB9XG4gICAgXG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICByZXR1cm4gc3RyICsgXCI7IH1cIjtcbiAgfVxuICAsXG4gIEZVTkNfREVGOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBuYW1lLCBucywgaXNfZG9tLCBzdHIsIGNvZGUsIGJvZHksIGhvaXN0ZWQ7XG4gICAgbmFtZSA9IFwiXCI7XG4gICAgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBpc19kb20gPSBub2RlLmNoaWxkcmVuLmZkLnZhbHVlID09PSAnZG9tJztcbiAgICBpZihub2RlLmNoaWxkcmVuLmZuKSB7XG4gICAgICBuYW1lID0gbm9kZS5jaGlsZHJlbi5mbi52YWx1ZTtcbiAgICAgIG5zW25hbWVdID0gdHJ1ZTtcbiAgICB9XG4gICAgXG4gICAgbnMgPSBuZXdOcygpO1xuICAgIHN0ciA9IFwiZnVuY3Rpb24gXCIgKyBuYW1lICsgXCIoXCI7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5wYXJhbXMpIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMpO1xuICAgIH1cbiAgICBcbiAgICBzdHIgKz0gJykgeyc7XG4gICAgdmFyIF9fa2V5czcgPSBPYmplY3Qua2V5cyhucyk7XG4gICAgZm9yKHZhciBfX2luZGV4NyA9IDA7IF9faW5kZXg3IDwgX19rZXlzNy5sZW5ndGg7IF9faW5kZXg3KyspIHtcbiAgICAgIHZhciBrZXkgPSBfX2tleXM3W19faW5kZXg3XTtcbiAgICAgIHZhciB2YWx1ZSA9IG5zW19fa2V5czdbX19pbmRleDddXTtcbiAgICAgIGlmKHZhbHVlICE9PSB0cnVlICYmIHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29kZSA9IGdlbmVyYXRlQ29kZSh2YWx1ZSk7XG4gICAgICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgJ2lmKCcgKyBrZXkgKyAnID09PSB1bmRlZmluZWQpIHsnICsga2V5ICsgJyA9ICcgKyBjb2RlICsgJzt9JztcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgYm9keSA9ICcnO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uYmxvY2spIHtcbiAgICAgIGJvZHkgPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5ibG9jayk7XG4gICAgfVxuICAgIFxuICAgIGlmKGlzX2RvbSkge1xuICAgICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyAndmFyICcgKyBDTigpICsgJyA9IFtdOyc7XG4gICAgfVxuICAgIFxuICAgIGhvaXN0ZWQgPSBnZW5lcmF0ZUhvaXN0ZWRWYXIoKTtcbiAgICBpZihob2lzdGVkKSB7XG4gICAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArIGhvaXN0ZWQ7XG4gICAgfVxuICAgIFxuICAgIHN0ciArPSBib2R5O1xuICAgIFxuICAgIG5hbWVzcGFjZXMucG9wKCk7XG4gICAgXG4gICAgaWYoaXNfZG9tKSB7XG4gICAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArICdyZXR1cm4gJyArIENOKCkgKyAnOyc7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzdHIgKyAnXFxuJyArIHNwKCkgKyAnfSc7XG4gIH1cbiAgLFxuICBGVU5DX0RFRl9QQVJBTVM6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciwgbnM7XG4gICAgc3RyID0gXCJcIjtcbiAgICBucyA9IGN1cnJlbnROcygpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW5bMF0udHlwZSA9PT0gJ25hbWUnKSB7XG4gICAgICBuc1tub2RlLmNoaWxkcmVuWzBdLnZhbHVlXSA9IHRydWU7XG4gICAgICBpZihub2RlLmNoaWxkcmVuWzFdICYmIG5vZGUuY2hpbGRyZW5bMV0udHlwZSA9PT0gJ2Fzc2lnbicpIHtcbiAgICAgICAgbnNbbm9kZS5jaGlsZHJlblswXS52YWx1ZV0gPSBub2RlLmNoaWxkcmVuWzJdO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICB2YXIgX19rZXlzOCA9IE9iamVjdC5rZXlzKG5vZGUuY2hpbGRyZW4pO1xuICAgIGZvcih2YXIgX19pbmRleDggPSAwOyBfX2luZGV4OCA8IF9fa2V5czgubGVuZ3RoOyBfX2luZGV4OCsrKSB7XG4gICAgICB2YXIgbiA9IG5vZGUuY2hpbGRyZW5bX19rZXlzOFtfX2luZGV4OF1dO1xuICAgICAgaWYobi50eXBlID09PSAnbmFtZScgfHwgbi50eXBlID09PSAnRlVOQ19ERUZfUEFSQU1TJyB8fCBuLnR5cGUgPT09ICdjb21tYScgfHwgbi50eXBlID09PSAnd2luZG93Jykge1xuICAgICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG4pO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgQVNTSUdOOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHIsIG9wLCBleHBsaWNpdF9nbG9iYWwsIG5zLCBsZWZ0LCByaWdodF9jb2RlLCB1bnBhY2tfbmFtZSwgaSwgbiwgY2g7XG4gICAgc3RyID0gXCJcIjtcbiAgICBvcCA9IG5vZGUuY2hpbGRyZW4ub3AudmFsdWU7XG4gICAgZXhwbGljaXRfZ2xvYmFsID0gb3AgPT09ICc6PSc7XG4gICAgaWYoZXhwbGljaXRfZ2xvYmFsKSB7XG4gICAgICBvcCA9ICc9JztcbiAgICB9XG4gICAgXG4gICAgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBsZWZ0ID0gbm9kZS5jaGlsZHJlbi5sZWZ0O1xuICAgIHJpZ2h0X2NvZGUgPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5yaWdodCk7XG4gICAgaWYobGVmdC50eXBlID09PSAnU1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSJykge1xuICAgICAgdW5wYWNraW5nKys7XG4gICAgICB1bnBhY2tfbmFtZSA9ICcnICsgcHJlZml4ICsgJ3VucGFjaycgKyB1bnBhY2tpbmcgKyAnJztcbiAgICAgIHN0ciArPSAndmFyICcgKyB1bnBhY2tfbmFtZSArICcgPSAnICsgcmlnaHRfY29kZSArICc7XFxuJyArIHNwKCk7XG4gICAgICBpID0gMDtcbiAgICAgIHZhciBfX2tleXM5ID0gT2JqZWN0LmtleXMobGVmdC5jaGlsZHJlbik7XG4gICAgICBmb3IodmFyIF9faW5kZXg5ID0gMDsgX19pbmRleDkgPCBfX2tleXM5Lmxlbmd0aDsgX19pbmRleDkrKykge1xuICAgICAgICB2YXIgY2hpbGQgPSBsZWZ0LmNoaWxkcmVuW19fa2V5czlbX19pbmRleDldXTtcbiAgICAgICAgbiA9IGNoaWxkLmNoaWxkcmVuWzBdO1xuICAgICAgICBpZihuLnR5cGUgPT09ICduYW1lJyAmJiBjaGlsZC5jaGlsZHJlbi5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICBob2lzdFZhcihuLnZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShjaGlsZCkgKyAnICcgKyBvcCArICcgJyArIHVucGFja19uYW1lICsgJ1snICsgaSArICddJztcbiAgICAgICAgaWYoaSA8IGxlZnQuY2hpbGRyZW4ubGVuZ3RoIC0gMSkge1xuICAgICAgICAgIHN0ciArPSAnO1xcbicgKyBzcCgpO1xuICAgICAgICB9XG4gICAgICAgIGkrKztcbiAgICAgIH1cbiAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICAgIFxuICAgIGlmKGxlZnQuY2hpbGRyZW5bMF0udHlwZSA9PT0gJ25hbWUnKSB7XG4gICAgICBjaCA9IGxlZnQuY2hpbGRyZW5bMF07XG4gICAgICBpZighY3VycmVudE5zSGFzKGNoLnZhbHVlKSkge1xuICAgICAgICBpZighZXhwbGljaXRfZ2xvYmFsKSB7XG4gICAgICAgICAgaG9pc3RWYXIoY2gudmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5sZWZ0KSArICcgJyArIG9wICsgJyAnICsgcmlnaHRfY29kZTtcbiAgfVxuICAsXG4gIFNUQVRFTUVOVDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyLCBlLCB0LCBvdGhlcjtcbiAgICBzdHIgPSAnJztcbiAgICB2YXIgX19rZXlzMTAgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgICBmb3IodmFyIF9faW5kZXgxMCA9IDA7IF9faW5kZXgxMCA8IF9fa2V5czEwLmxlbmd0aDsgX19pbmRleDEwKyspIHtcbiAgICAgIHZhciBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX19rZXlzMTBbX19pbmRleDEwXV07XG4gICAgICBlID0gY2hpbGQuY2hpbGRyZW4gJiYgY2hpbGQuY2hpbGRyZW5bMF07XG4gICAgICAvLyBUT0RPOiB0aGlzIHNob3VsZCBiZSBwb3NzaWJsZVxuICAgICAgdCA9IGNoaWxkLnR5cGU7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKGNoaWxkKTtcbiAgICAgIG90aGVyID0gZSAmJiAoZS50eXBlID09PSAnRlVOQ19ERUYnIHx8IGUudHlwZSA9PT0gJ0xBTUJEQScpO1xuICAgICAgaWYodCA9PT0gJ0ZPUicgfHwgdCA9PT0gJ1RSWV9DQVRDSCcgfHwgdCA9PT0gJ1dISUxFJyB8fCB0ID09PSAnSUYnIHx8IHQgPT09ICdTVEFURU1FTlQnIHx8IHQgPT09ICdzYW1lZGVudCcgfHwgb3RoZXIpIHtcbiAgICAgICAgXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgKz0gJzsnO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgSUY6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciwgZWxpZjtcbiAgICBzdHIgPSAnJztcbiAgICBzdHIgPSAnaWYoJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJykgeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgICBlbGlmID0gbm9kZS5jaGlsZHJlbi5lbGlmO1xuICAgIGlmKGVsaWYpIHtcbiAgICAgIGlmKEFycmF5LmlzQXJyYXkoZWxpZikpIHtcbiAgICAgICAgdmFyIF9fa2V5czExID0gT2JqZWN0LmtleXMoZWxpZik7XG4gICAgICAgIGZvcih2YXIgX19pbmRleDExID0gMDsgX19pbmRleDExIDwgX19rZXlzMTEubGVuZ3RoOyBfX2luZGV4MTErKykge1xuICAgICAgICAgIHZhciB2YWx1ZSA9IGVsaWZbX19rZXlzMTFbX19pbmRleDExXV07XG4gICAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZSh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoZWxpZik7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmKG5vZGUuY2hpbGRyZW4uZWwpIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lbCk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgLFxuICBJRl9FWFBSOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHI7XG4gICAgc3RyID0gJyc7XG4gICAgc3RyID0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4udGVzdCkgKyAnID8gJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJyA6ICc7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5lbCkge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmVsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyICs9ICd1bmRlZmluZWQnO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgRUxTRV9FWFBSOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKTtcbiAgfVxuICAsXG4gIFdISUxFOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnd2hpbGUoJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJyl7JyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICB9XG4gICxcbiAgRk9SOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBrZXlJbmRleE5hbWUsIGtleUFycmF5TmFtZSwgYXJyYXlOYW1lLCB2YXJOYW1lLCBpbmRleE5hbWUsIHN0cjtcbiAgICBrZXlJbmRleE5hbWUgPSBwcmVmaXggKyBcImluZGV4XCIgKyBmb3JMb29wQ291bnQ7XG4gICAga2V5QXJyYXlOYW1lID0gcHJlZml4ICsgXCJrZXlzXCIgKyBmb3JMb29wQ291bnQ7XG4gICAgYXJyYXlOYW1lID0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYSk7XG4gICAgdmFyTmFtZSA9IG5vZGUuY2hpbGRyZW4udi52YWx1ZTtcbiAgICBmb3JMb29wQ291bnQrKztcbiAgICBpbmRleE5hbWUgPSBmYWxzZTtcbiAgICBpZihub2RlLmNoaWxkcmVuLmspIHtcbiAgICAgIGluZGV4TmFtZSA9IG5vZGUuY2hpbGRyZW4uay52YWx1ZTtcbiAgICB9XG4gICAgXG4gICAgc3RyID0gJ3ZhciAnICsga2V5QXJyYXlOYW1lICsgJyA9IE9iamVjdC5rZXlzKCcgKyBhcnJheU5hbWUgKyAnKTtcXG4nO1xuICAgIHN0ciArPSBzcCgpICsgJ2Zvcih2YXIgJyArIGtleUluZGV4TmFtZSArICcgPSAwOyAnICsga2V5SW5kZXhOYW1lICsgJyA8ICcgKyBrZXlBcnJheU5hbWUgKyAnLmxlbmd0aDsgJyArIGtleUluZGV4TmFtZSArICcrKykge1xcbic7XG4gICAgaWYoaW5kZXhOYW1lKSB7XG4gICAgICBzdHIgKz0gc3AoMSkgKyAndmFyICcgKyBpbmRleE5hbWUgKyAnID0gJyArIGtleUFycmF5TmFtZSArICdbJyArIGtleUluZGV4TmFtZSArICddO1xcbic7XG4gICAgfVxuICAgIFxuICAgIHN0ciArPSBzcCgxKSArICd2YXIgJyArIHZhck5hbWUgKyAnID0gJyArIGFycmF5TmFtZSArICdbJyArIGtleUFycmF5TmFtZSArICdbJyArIGtleUluZGV4TmFtZSArICddXTsnO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgRUxTRV9JRjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyBlbHNlIGlmKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcpIHsnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYikgKyAnXFxuJyArIHNwKCkgKyAnfSc7XG4gIH1cbiAgLFxuICBFTFNFOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnIGVsc2UgeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgfVxuICAsXG4gIFRSWV9DQVRDSDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyO1xuICAgIHN0ciA9IFwidHJ5IHtcIjtcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYjEpO1xuICAgIHN0ciArPSAnXFxuJyArIHNwKCkgKyBcIn0gY2F0Y2goXCIgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lcnIpICsgXCIpIHtcIjtcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYjIpO1xuICAgIHJldHVybiBzdHIgKyAnXFxuJyArIHNwKCkgKyBcIn1cIjtcbiAgfVxuICAsXG4gIFNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgZWxlbWVudHM7XG4gICAgZWxlbWVudHMgPSBbXTtcbiAgICB2YXIgX19rZXlzMTIgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgICBmb3IodmFyIF9faW5kZXgxMiA9IDA7IF9faW5kZXgxMiA8IF9fa2V5czEyLmxlbmd0aDsgX19pbmRleDEyKyspIHtcbiAgICAgIHZhciBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX19rZXlzMTJbX19pbmRleDEyXV07XG4gICAgICBlbGVtZW50cy5wdXNoKGdlbmVyYXRlQ29kZShjaGlsZCkpO1xuICAgIH1cbiAgICByZXR1cm4gJ1snICsgZWxlbWVudHMuam9pbihcIiwgXCIpICsgJ10nO1xuICB9XG4gICxcbiAgc3RyaW5nOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciB2LCBhc3Q7XG4gICAgdiA9IG5vZGUudmFsdWU7XG4gICAgdiA9IHYucmVwbGFjZSgvXFxuL2csIFwiXFxcXG5cIik7XG4gICAgYXN0ID0gc3RyR3JhbS5wYXJzZSh2KTtcbiAgICBpZighYXN0LmNvbXBsZXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYXN0LmhpbnQpO1xuICAgIH1cbiAgICByZXR1cm4gZ2VuZXJhdGVTdHJpbmdDb2RlKGFzdCwgdi5jaGFyQXQoMCkpO1xuICB9XG4gICxcbiAgY29tbWVudDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZS5yZXBsYWNlKC9eIy9nLCBcIi8vXCIpO1xuICB9XG4gICxcbiAgcGF6ejogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgLFxuICBub3Q6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuICchJztcbiAgfVxuICAsXG4gIGFuZDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyYmICc7XG4gIH1cbiAgLFxuICBvcjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJ3x8ICc7XG4gIH1cbiAgLFxuICBjb21wYXJpc29uOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIGlmKG5vZGUudmFsdWUgPT09ICc9PScpIHtcbiAgICAgIHJldHVybiAnPT09JztcbiAgICB9XG4gICAgXG4gICAgaWYobm9kZS52YWx1ZSA9PT0gJyE9Jykge1xuICAgICAgcmV0dXJuICchPT0nO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgfVxufTtcblxuZnVuY3Rpb24gZ2VuZXJhdGVDb2RlKG5vZGUpIHtcbiAgdmFyIHN0cjtcbiAgaWYoIW5vZGUpIHtcbiAgICAvLyBkZWJ1Z2dlclxuICB9XG4gIGlmKGJhY2tlbmRbbm9kZS50eXBlXSkge1xuICAgIHJldHVybiBiYWNrZW5kW25vZGUudHlwZV0obm9kZSk7XG4gIH1cbiAgXG4gIGlmKG5vZGUudmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9XG4gIFxuICBzdHIgPSBcIlwiO1xuICBpZighbm9kZS5jaGlsZHJlbikge1xuICAgIHJldHVybiAnJztcbiAgfVxuICBcbiAgdmFyIF9fa2V5czEzID0gT2JqZWN0LmtleXMobm9kZS5jaGlsZHJlbik7XG4gIGZvcih2YXIgX19pbmRleDEzID0gMDsgX19pbmRleDEzIDwgX19rZXlzMTMubGVuZ3RoOyBfX2luZGV4MTMrKykge1xuICAgIHZhciBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX19rZXlzMTNbX19pbmRleDEzXV07XG4gICAgc3RyICs9IGdlbmVyYXRlQ29kZShjaGlsZCk7XG4gIH1cbiAgXG4gIHJldHVybiBzdHI7XG59XG5cblxuZnVuY3Rpb24gZ2VuZXJhdGVFeHBvcnRzKGtleXMpIHtcbiAgdmFyIHN0cjtcbiAgc3RyID0gJ1xcbm1vZHVsZS5leHBvcnRzID0geyc7XG4gIGtleXMgPSBrZXlzIHx8IE9iamVjdC5rZXlzKGN1cnJlbnROcygpKTtcbiAgdmFyIF9fa2V5czE0ID0gT2JqZWN0LmtleXMoa2V5cyk7XG4gIGZvcih2YXIgX19pbmRleDE0ID0gMDsgX19pbmRleDE0IDwgX19rZXlzMTQubGVuZ3RoOyBfX2luZGV4MTQrKykge1xuICAgIHZhciBrZXkgPSBrZXlzW19fa2V5czE0W19faW5kZXgxNF1dO1xuICAgIHN0ciArPSAnXFxuICAnICsga2V5ICsgJyA6ICcgKyBrZXkgKyAnLCc7XG4gIH1cbiAgcmV0dXJuIHN0ciArICdcXG59Jztcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVNb2R1bGUoaW5wdXQsb3B0cykge1xuICB2YXIgYXN0LCBvYmo7XG4gIHJlc2V0R2xvYmFsKCk7XG4gIGFzdCA9IGdyYW0ucGFyc2UoaW5wdXQgKyBcIlxcblwiKTtcbiAgaWYoIWFzdC5jb21wbGV0ZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihhc3QuaGludCk7XG4gIH1cbiAgXG4gIG9iaiA9IHthc3Q6IGFzdCwgY29kZTogZ2VuZXJhdGVDb2RlKGFzdCksIG5zOiBjdXJyZW50TnMoKX07XG4gIHJldHVybiBvYmo7XG59XG5cblxuZ3JhbSA9IGVwZWdqcy5jb21waWxlR3JhbW1hcihncmFtbWFyRGVmLCB0b2tlbkRlZik7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBncmFtbWFyOiBncmFtLFxuICBzdHJHcmFtbWFyOiBzdHJHcmFtLFxuICBncmFtbWFyRGVmOiBncmFtbWFyRGVmLFxuICBlcGVnanM6IGVwZWdqcyxcbiAgdG9rZW5EZWY6IHRva2VuRGVmLFxuICBnZW5lcmF0ZU1vZHVsZTogZ2VuZXJhdGVNb2R1bGUsXG4gIGdlbmVyYXRlQ29kZTogZ2VuZXJhdGVDb2RlLFxuICBnZW5lcmF0ZUV4cG9ydHM6IGdlbmVyYXRlRXhwb3J0c1xufTtcblxuXG4iXX0=
