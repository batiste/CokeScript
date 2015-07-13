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
        if(n.type === 'name') {
          if(currentNsHas(n.value) === undefined) {
            ns[n.value] = true;
          }
        }
        
        str += generateCode(child) + ' ' + op + ' ' + unpack_name + '[' + i + '];\n' + sp();
        i++;
      }
      return str;
    }
    if(left.children[0].type === 'name') {
      ch = left.children[0];
      if(!currentNsHas(ch.value)) {
        if(!explicit_global) {
          ns[ch.value] = 'hoist';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb2tlc2NyaXB0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBRGorQkE7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGVwZWdqcywgZGVwdGgsIGZvckxvb3BDb3VudCwgdW5wYWNraW5nLCBuYW1lc3BhY2VzLCBsZXZlbFN0YWNrLCBwcmVmaXgsIGEsIHRva2VuRGVmLCBzdHJJbnRlcnBvbGF0aW9uVG9rZW5EZWYsIHN0ckludGVycG9sYXRpb25HcmFtbWFyRGVmLCBzdHJHcmFtLCBncmFtbWFyRGVmLCBuYywgYmFja2VuZCwgZ3JhbTtcbi8vIENva2VTY3JpcHQgbGFuZ3VhZ2UgYnkgQmF0aXN0ZSBCaWVsZXIgMjAxNVxuLy8gSW1wbGVtZW50ZWQgdXNpbmcgRVBFRy5KU1xuXG5lcGVnanMgPSByZXF1aXJlKFwiZXBlZ2pzXCIpO1xuXG5kZXB0aCA9IDA7XG5mb3JMb29wQ291bnQgPSAxO1xudW5wYWNraW5nID0gMDtcbm5hbWVzcGFjZXMgPSBbe31dO1xubGV2ZWxTdGFjayA9IFswXTtcbnByZWZpeCA9ICdfXyc7XG5cbmEgPSB7dDogMSwgejogMn07XG5cbmZ1bmN0aW9uIGhlbGxvKCkge1xuICByZXR1cm4ge3Q6IDEsIHo6IDJ9O1xufVxuXG5mdW5jdGlvbiBjdXJyZW50TnMoKSB7XG4gIHJldHVybiBuYW1lc3BhY2VzW25hbWVzcGFjZXMubGVuZ3RoIC0gMV07XG59XG5cbmZ1bmN0aW9uIGN1cnJlbnROc0hhcyhwKSB7XG4gIHJldHVybiBuYW1lc3BhY2VzW25hbWVzcGFjZXMubGVuZ3RoIC0gMV0uaGFzT3duUHJvcGVydHkocCk7XG59XG5cbmZ1bmN0aW9uIG5ld05zKCkge1xuICBuYW1lc3BhY2VzLnB1c2goe30pO1xuICByZXR1cm4gbmFtZXNwYWNlc1tuYW1lc3BhY2VzLmxlbmd0aCAtIDFdO1xufVxuXG5mdW5jdGlvbiByZXNldEdsb2JhbCgpIHtcbiAgbmFtZXNwYWNlcyA9IFt7fV07XG4gIGZvckxvb3BDb3VudCA9IDE7XG4gIGxldmVsU3RhY2sgPSBbMF07XG4gIGRlcHRoID0gMDtcbiAgdW5wYWNraW5nID0gMDtcbn1cblxuLy8gdG9rZW4gYXJlIG1hdGNoZWQgaW4gb3JkZXIgb2YgZGVjbGFyYXRpb247XG4vLyBUT0RPOiBhZGQgZnVuY3Rpb25zXG5cbnRva2VuRGVmID0gW1xuICB7a2V5OiBcInN0cmluZ1wiLCBmdW5jOiBzdHJpbmdEZWZ9LFxuICB7a2V5OiBcImNvbW1lbnRcIiwgZnVuYzogY29tbWVudERlZn0sXG4gIHtrZXk6IFwiZnVuY3Rpb25fZGVmXCIsIGZ1bmM6IGRlZkRlZiwgdmVyYm9zZTogXCJmdW5jdGlvblwifSxcbiAge2tleTogXCJjbGFzc1wiLCByZWc6IC9eY2xhc3MgL30sXG4gIHtrZXk6IFwicmV0XCIsIHJlZzogL15yZXR1cm4vLCB2ZXJib3NlOiBcInJldHVyblwifSxcbiAge2tleTogXCJpZlwiLCByZWc6IC9eaWYgL30sXG4gIHtrZXk6IFwib3JcIiwgcmVnOiAvXm9yIC99LFxuICB7a2V5OiBcImFuZFwiLCByZWc6IC9eYW5kIC99LFxuICB7a2V5OiBcIndoaWxlXCIsIHJlZzogL153aGlsZSAvfSxcbiAge2tleTogXCJpbnN0YW5jZW9mXCIsIHJlZzogL15pbnN0YW5jZW9mIC99LFxuICB7a2V5OiBcInRyeVwiLCByZWc6IC9edHJ5L30sXG4gIHtrZXk6IFwiY2F0Y2hcIiwgcmVnOiAvXmNhdGNoL30sXG4gIHtrZXk6IFwidGhyb3dcIiwgcmVnOiAvXnRocm93IC99LFxuICB7a2V5OiBcInBhenpcIiwgcmVnOiAvXnBhc3MvLCB2ZXJib3NlOiBcInBhc3NcIn0sXG4gIHtrZXk6IFwibmV3XCIsIHJlZzogL15uZXcgL30sXG4gIHtrZXk6IFwidGFnXCIsIHJlZzogL148W2EtekEtWl1bMC05YS16QS1aXXswLDI5fS99LFxuICB7a2V5OiBcIj5cIiwgcmVnOiAvXj4vfSxcbiAge2tleTogXCJlbHNlaWZcIiwgcmVnOiAvXmVsc2VpZiAvfSxcbiAge2tleTogXCJlbHNlXCIsIHJlZzogL15lbHNlL30sXG4gIHtrZXk6IFwiZm9yX2xvb3BcIiwgcmVnOiAvXmZvciAvLCB2ZXJib3NlOiBcImZvciBsb29wXCJ9LFxuICB7a2V5OiBcImluXCIsIHJlZzogL15pbiAvfSxcbiAge2tleTogXCJub3RcIiwgcmVnOiAvXm5vdCAvLCB2ZXJib3NlOiBcIm5vdFwifSxcbiAge2tleTogXCJuYW1lXCIsIHJlZzogL15bYS16QS1aXyRdWzAtOWEtekEtWl8kXXswLDI5fS99LFxuICB7a2V5OiBcInJlZ2V4cFwiLCBmdW5jOiByZWdFeHBEZWYsIHZlcmJvc2U6IFwicmVndWxhciBleHByZXNzaW9uXCJ9LFxuICB7a2V5OiBcIm1hdGhfb3BlcmF0b3JzXCIsIHJlZzogL14oXFwrXFwrfFxcLVxcLSkvLCB2ZXJib3NlOiBcIm1hdGggb3BlcmF0b3JcIn0sXG4gIHtrZXk6IFwiYmluYXJ5X29wZXJhdG9yc1wiLCByZWc6IC9eKFxcJlxcJnxcXHxcXHx8XFwmfFxcfHw8PHxcXD5cXD4pLywgdmVyYm9zZTogXCJiaW5hcnkgb3BlcmF0b3JcIn0sXG4gIHtrZXk6IFwiY29tcGFyaXNvblwiLCByZWc6IC9eKDw9fD49fDx8PnwhPXw9PSkvfSxcbiAge2tleTogXCJhc3NpZ25cIiwgcmVnOiAvXihcXCs9fC09fD18Oj0pL30sXG4gIHtrZXk6IFwibnVtYmVyXCIsIHJlZzogL15bLV0/WzAtOV0rXFwuP1swLTldKi99LFxuICB7a2V5OiBcImNvbW1hXCIsIHJlZzogL15cXCwvfSxcbiAge2tleTogXCJkb3RcIiwgcmVnOiAvXlxcLi99LFxuICB7a2V5OiBcImNvbG9uXCIsIHJlZzogL15cXDovLCB2ZXJib3NlOiBcIjpcIn0sXG4gIHtrZXk6IFwib3Blbl9wYXJcIiwgcmVnOiAvXlxcKC8sIHZlcmJvc2U6IFwiKFwifSxcbiAge2tleTogXCJjbG9zZV9wYXJcIiwgcmVnOiAvXlxcKS8sIHZlcmJvc2U6IFwiKVwifSxcbiAge2tleTogXCJvcGVuX2JyYVwiLCByZWc6IC9eXFxbLywgdmVyYm9zZTogXCJbXCJ9LFxuICB7a2V5OiBcImNsb3NlX2JyYVwiLCByZWc6IC9eXFxdLywgdmVyYm9zZTogXCJdXCJ9LFxuICB7a2V5OiBcIm9wZW5fY3VybHlcIiwgcmVnOiAvXlxcey8sIHZlcmJvc2U6IFwie1wifSxcbiAge2tleTogXCJjbG9zZV9jdXJseVwiLCByZWc6IC9eXFx9LywgdmVyYm9zZTogXCJ9XCJ9LFxuICB7a2V5OiBcIm1hdGhcIiwgcmVnOiAvXlstfFxcK3xcXCp8XFwvfCVdL30sXG4gIHtrZXk6IFwic2FtZWRlbnRcIiwgZnVuYzogZGVudChcInNhbWVkZW50XCIpLCB2ZXJib3NlOiBcInNhbWUgaW5kZW50YXRpb25cIn0sXG4gIHtrZXk6IFwiZGVkZW50XCIsIGZ1bmM6IGRlbnQoXCJkZWRlbnRcIil9LFxuICB7a2V5OiBcImluZGVudFwiLCBmdW5jOiBkZW50KFwiaW5kZW50XCIpfSxcbiAge2tleTogXCJXXCIsIHJlZzogL15bIF0vLCB2ZXJib3NlOiBcInNpbmdsZSB3aGl0ZXNwYWNlXCJ9XG5dO1xuXG5mdW5jdGlvbiBzdGFydFN0cihpbnB1dCxzdHJlYW0pIHtcbiAgdmFyIGxhc3Q7XG4gIGxhc3QgPSBzdHJlYW1bc3RyZWFtLmxlbmd0aCAtIDFdO1xuICBpZihsYXN0ICYmIGxhc3QudmFsdWUgPT09IFwiXFxcXFwiKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmKGlucHV0Lm1hdGNoKC9eI3svKSkge1xuICAgIHJldHVybiBcIiN7XCI7XG4gIH1cbn1cblxuc3RySW50ZXJwb2xhdGlvblRva2VuRGVmID0gW1xuICB7a2V5OiBcInN0YXJ0XCIsIGZ1bmM6IHN0YXJ0U3RyfSxcbiAge2tleTogXCJlbmRcIiwgcmVnOiAvXn0vfSxcbiAge2tleTogXCJuYW1lXCIsIHJlZzogL15bYS16QS1aXyRdWzAtOWEtekEtWl9dezAsMjl9L30sXG4gIHtrZXk6IFwiZG90XCIsIHJlZzogL15cXC4vfSxcbiAge2tleTogXCJjaGFyXCIsIHJlZzogL14uL31cbl07XG5cbnN0ckludGVycG9sYXRpb25HcmFtbWFyRGVmID0ge1xuICBTVEFSVDoge3J1bGVzOiBbXCJFTCogRU9GXCJdfSxcbiAgRUw6IHtydWxlczogW1wiVkFSXCIsIFwiY2hhclwiLCBcIm5hbWVcIiwgXCJzdGFydFwiLCBcImVuZFwiLCBcImRvdFwiXX0sXG4gIFZBUjoge3J1bGVzOiBbXCJzdGFydCBOQU1FIGVuZFwiXX0sXG4gIE5BTUU6IHtydWxlczogW1wibmFtZSBkb3QgTkFNRVwiLCBcIm5hbWVcIl19XG59O1xuXG5zdHJHcmFtID0gZXBlZ2pzLmNvbXBpbGVHcmFtbWFyKHN0ckludGVycG9sYXRpb25HcmFtbWFyRGVmLCBzdHJJbnRlcnBvbGF0aW9uVG9rZW5EZWYpO1xuXG5mdW5jdGlvbiBnZW5lcmF0ZVN0cmluZ0NvZGUobm9kZSxjKSB7XG4gIHZhciBzdHI7XG4gIGlmKG5vZGUudHlwZSA9PT0gJ1ZBUicpIHtcbiAgICByZXR1cm4gYyArICcgKyAnICsgZ2VuZXJhdGVTdHJpbmdDb2RlKG5vZGUuY2hpbGRyZW5bMV0sIGMpICsgJyArICcgKyBjO1xuICB9XG4gIFxuICBpZihub2RlLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgfVxuICBcbiAgc3RyID0gJyc7XG4gIGlmKCFub2RlLmNoaWxkcmVuKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG4gIFxuICB2YXIgX19rZXlzMSA9IE9iamVjdC5rZXlzKG5vZGUuY2hpbGRyZW4pO1xuICBmb3IodmFyIF9faW5kZXgxID0gMDsgX19pbmRleDEgPCBfX2tleXMxLmxlbmd0aDsgX19pbmRleDErKykge1xuICAgIHZhciBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX19rZXlzMVtfX2luZGV4MV1dO1xuICAgIHN0ciArPSBnZW5lcmF0ZVN0cmluZ0NvZGUoY2hpbGQsIGMpO1xuICB9XG4gIHJldHVybiBzdHI7XG59XG5cbmZ1bmN0aW9uIGN1cnJlbnRMZXZlbCgpIHtcbiAgcmV0dXJuIGxldmVsU3RhY2tbbGV2ZWxTdGFjay5sZW5ndGggLSAxXTtcbn1cblxuZnVuY3Rpb24gaW5kZW50VHlwZShsKSB7XG4gIGlmKGwgPiBjdXJyZW50TGV2ZWwoKSkge1xuICAgIHJldHVybiAnaW5kZW50JztcbiAgfVxuICBcbiAgaWYobCA8IGN1cnJlbnRMZXZlbCgpKSB7XG4gICAgcmV0dXJuICdkZWRlbnQnO1xuICB9XG4gIFxuICBpZihsID09PSBjdXJyZW50TGV2ZWwoKSkge1xuICAgIHJldHVybiAnc2FtZWRlbnQnO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRlbnQoZGVudFR5cGUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIF9kZW50KGlucHV0KSB7XG4gICAgdmFyIG0sIGxpbmVzLCBpbmRlbnQ7XG4gICAgLy8gZW1wdHkgbGluZSBpcyBhIHNhbWVkZW50XG4gICAgbSA9IGlucHV0Lm1hdGNoKC9eXFxuW1xcc10qLyk7XG4gICAgaWYobSkge1xuICAgICAgbGluZXMgPSBtWzBdLnNwbGl0KFwiXFxuXCIpO1xuICAgICAgaW5kZW50ID0gbGluZXNbbGluZXMubGVuZ3RoIC0gMV0ubGVuZ3RoO1xuICAgICAgaWYoaW5kZW50VHlwZShpbmRlbnQpID09PSBkZW50VHlwZSkge1xuICAgICAgICBpZihkZW50VHlwZSA9PT0gJ2RlZGVudCcpIHtcbiAgICAgICAgICBsZXZlbFN0YWNrLnBvcCgpO1xuICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYoZGVudFR5cGUgPT09ICdpbmRlbnQnKSB7XG4gICAgICAgICAgbGV2ZWxTdGFjay5wdXNoKGluZGVudCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiBtWzBdO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gc3RyaW5nRGVmKGlucHV0KSB7XG4gIHZhciBmaXJzdCwgaSwgY2g7XG4gIGZpcnN0ID0gaW5wdXQuY2hhckF0KDApO1xuICBpZihmaXJzdCA9PT0gJ1wiJyB8fCBmaXJzdCA9PT0gXCInXCIpIHtcbiAgICBpID0gMTtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpe1xuICAgICAgY2ggPSBpbnB1dC5jaGFyQXQoaSk7XG4gICAgICBpZihjaCA9PT0gJ1xcXFwnKSB7XG4gICAgICAgIGkrKztcbiAgICAgIH0gZWxzZSBpZihjaCA9PT0gZmlyc3QpIHtcbiAgICAgICAgcmV0dXJuIGlucHV0LnNsaWNlKDAsIGkgKyAxKTtcbiAgICAgIH1cbiAgICAgIGkrKztcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVnRXhwRGVmKGlucHV0KSB7XG4gIHZhciBpLCBjaDtcbiAgaWYoaW5wdXQuY2hhckF0KDApID09PSAnLycpIHtcbiAgICBpID0gMTtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpe1xuICAgICAgY2ggPSBpbnB1dC5jaGFyQXQoaSk7XG4gICAgICBpZihjaCA9PT0gJ1xcXFwnKSB7XG4gICAgICAgIGkrKztcbiAgICAgIH0gZWxzZSBpZihjaCA9PT0gJy8nKSB7XG4gICAgICAgIGkrKztcbiAgICAgICAgLy8gbW9kaWZpZXJzXG4gICAgICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSAmJiBcImlnbVwiLmluZGV4T2YoaW5wdXQuY2hhckF0KGkpKSAhPT0gLTEpe1xuICAgICAgICAgIGkrKztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGRlZkRlZihpbnB1dCkge1xuICBpZihpbnB1dC5tYXRjaCgvXmRlZltcXCh8IHxcXG5dLykpIHtcbiAgICByZXR1cm4gXCJkZWZcIjtcbiAgfVxuICBcbiAgaWYoaW5wdXQuaW5kZXhPZihcImRvbSBcIikgPT09IDApIHtcbiAgICByZXR1cm4gXCJkb21cIjtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb21tZW50RGVmKGlucHV0KSB7XG4gIHZhciBtLCBpLCBjaDtcbiAgbSA9IGlucHV0Lm1hdGNoKC9eIy8pO1xuICBpZihtKSB7XG4gICAgaSA9IG1bMF0ubGVuZ3RoO1xuICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSl7XG4gICAgICBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxuJykge1xuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHJlZmxlY3QocGFyYW1zKSB7IHJldHVybiBwYXJhbXM7IH1cblxuZ3JhbW1hckRlZiA9IHtcbiAgU1RBUlQ6IHtydWxlczogW1wiTElORSogRU9GXCJdfSxcbiAgRUxDOiB7cnVsZXM6IFtcIlcqIGNvbW1lbnRcIl0sIHZlcmJvc2U6IFwiY29tbWVudFwifSxcbiAgTElORToge3J1bGVzOiBbXCJTVEFURU1FTlQgRUxDPyBzYW1lZGVudCtcIiwgXCJTVEFURU1FTlQgRUxDPyAhZGVkZW50XCIsIFxuICAgIFwiRUxDPyBzYW1lZGVudFwiLCBcIkVMQyAhZGVkZW50XCJdLCB2ZXJib3NlOiBcIm5ldyBsaW5lXCJ9LFxuICBCTE9DSzoge3J1bGVzOiBbXCJpbmRlbnQgcGF6eiBkZWRlbnRcIiwgXCJpbmRlbnQgTElORSsgZGVkZW50XCJdfSxcbiAgU1RBVEVNRU5UOiB7cnVsZXM6IFtcIkFTU0lHTlwiLCBcIkVYUFJcIiwgXCJJRlwiLCBcIldISUxFXCIsIFwiRk9SXCIsIFwiUkVUVVJOXCIsIFxuICAgIFwiQ0xBU1NcIiwgXCJUQUdcIiwgXCJET01fQVNTSUdOXCIsIFwiVFJZX0NBVENIXCIsIFwiVEhST1dcIl19LFxuICBDTEFTU19NRVRIT0RTOiB7XG4gICAgcnVsZXM6IFtcInNhbWVkZW50KiBmOkZVTkNfREVGIHNhbWVkZW50KlwiXSxcbiAgICBob29rczogW2Z1bmN0aW9uIChwKSB7IHJldHVybiBwLmY7IH1dXG4gIH0sXG4gIENMQVNTOiB7XG4gICAgcnVsZXM6IFtcbiAgICAgIFwiY2xhc3MgbjpuYW1lIG9wZW5fcGFyIHA6bmFtZSBjbG9zZV9wYXIgaW5kZW50IG06Q0xBU1NfTUVUSE9EUysgZGVkZW50XCIsXG4gICAgICBcImNsYXNzIG46bmFtZSBpbmRlbnQgbTpDTEFTU19NRVRIT0RTKyBkZWRlbnRcIlxuICAgIF0sXG4gICAgaG9va3M6IFtcbiAgICAgIGZ1bmN0aW9uIChwKSB7IHJldHVybiB7bmFtZTogcC5uLCBtZXRob2RzOiBwLm0sIHBhcmVudDogcC5wfTsgfSxcbiAgICAgIGZ1bmN0aW9uIChwKSB7IHJldHVybiB7bmFtZTogcC5uLCBtZXRob2RzOiBwLm19OyB9XG4gICAgXVxuICB9LFxuICBGVU5DX0RFRl9QQVJBTVM6IHtydWxlczogW1xuICAgIFwicDE6RlVOQ19ERUZfUEFSQU1TIGNvbW1hIFcgcDI6RlVOQ19ERUZfUEFSQU1TXCIsXG4gICAgXCJwMTpuYW1lIGFzc2lnbiBlOkVYUFJcIixcbiAgICBcInAxOm5hbWVcIlxuICAgIF0sXG4gICAgdmVyYm9zZTogXCJkZWYgcGFyYW1ldGVyc1wiXG4gIH0sXG4gIExBTUJEQToge3J1bGVzOiBbXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIFcgYmxvY2s6RVhQUlwiLFxuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBvcGVuX3BhciBwYXJhbXM6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgVyBibG9jazpFWFBSXCIsXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgVyBibG9jazpFWFBSXCJcbiAgICBdLFxuICAgIGhvb2tzOiBbcmVmbGVjdCwgcmVmbGVjdCwgcmVmbGVjdF1cbiAgfSxcbiAgRlVOQ19ERUY6IHtydWxlczogW1xuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIG9wZW5fcGFyIHBhcmFtczpGVU5DX0RFRl9QQVJBTVM/IGNsb3NlX3BhciBibG9jazpCTE9DS1wiLFxuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBvcGVuX3BhciBwYXJhbXM6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgYmxvY2s6QkxPQ0tcIixcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGZuOm5hbWUgYmxvY2s6QkxPQ0tcIixcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBibG9jazpCTE9DS1wiXG4gICAgXSxcbiAgICBob29rczogW3JlZmxlY3QsIHJlZmxlY3QsIHJlZmxlY3QsIHJlZmxlY3RdLFxuICAgIHZlcmJvc2U6IFwiZGVmIGRlZmluaXRpb25cIlxuICB9LFxuICBFTFNFX0lGOiB7cnVsZXM6IFtcInNhbWVkZW50IGVsc2VpZiBlOkVYUFIgYjpCTE9DS1wiXSwgaG9va3M6IFtyZWZsZWN0XX0sXG4gIEVMU0U6IHtydWxlczogW1wic2FtZWRlbnQgZWxzZSBiOkJMT0NLXCJdLCBob29rczogW3JlZmxlY3RdfSxcbiAgSUY6IHtydWxlczogW1wiaWYgZTpFWFBSIGI6QkxPQ0sgZWxpZjpFTFNFX0lGKiBlbDpFTFNFP1wiXSwgaG9va3M6IFtyZWZsZWN0XX0sXG4gIEVMU0VfRVhQUjoge3J1bGVzOiBbXCJXIGVsc2UgVyBiOkVYUFJcIl0sIGhvb2tzOiBbcmVmbGVjdF19LFxuICBJRl9FWFBSOiB7cnVsZXM6IFtcImU6RVhQUiBXIGlmIHRlc3Q6RVhQUiBlbDpFTFNFX0VYUFI/XCJdLCBob29rczogW3JlZmxlY3RdfSxcbiAgV0hJTEU6IHtydWxlczogW1wid2hpbGUgZTpFWFBSIGI6QkxPQ0tcIl0sIGhvb2tzOiBbcmVmbGVjdF19LFxuICBNQVRIOiB7cnVsZXM6IFtcImUxOkVYUFIgVyBvcDptYXRoIFcgZTI6RVhQUlwiXX0sXG4gIFBBVEg6IHtydWxlczogW1wiUEFUSCBkb3QgbmFtZVwiLCBcIlBBVEggb3Blbl9icmEgbnVtYmVyIGNsb3NlX2JyYVwiLCBcIm5hbWVcIl19LFxuICBBU1NJR046IHtydWxlczogW1xuICAgIFwibGVmdDpFWFBSIFcgb3A6YXNzaWduIFcgcmlnaHQ6RVhQUlwiLFxuICAgIFwibGVmdDpTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFIgVyBvcDphc3NpZ24gVyByaWdodDpTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFJcIixcbiAgICBcImxlZnQ6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSIFcgb3A6YXNzaWduIFcgcmlnaHQ6RVhQUlwiXG4gIF0sIGhvb2tzOiBbcmVmbGVjdCwgcmVmbGVjdCwgcmVmbGVjdF19LFxuICBXX09SX1NBTUVERU5UOiB7cnVsZXM6IFtcIldcIiwgXCJzYW1lZGVudFwiXSwgdmVyYm9zZTogXCJzYW1lZGVudCBvciB3aGl0ZXNwYWNlXCJ9LFxuICBXX1NBTUVERU5UX0lOREVOVDoge3J1bGVzOiBbXCJXXCIsIFwic2FtZWRlbnRcIiwgXCJpbmRlbnRcIl0sIHZlcmJvc2U6IFwiaW5kZW50IG9yIHNhbWVkZW50IG9yIHdoaXRlc3BhY2VcIn0sXG4gIEFOWV9TUEFDRToge3J1bGVzOiBbXCJXXCIsIFwic2FtZWRlbnRcIiwgXCJpbmRlbnRcIiwgXCJkZWRlbnRcIiwgXCJjb21tZW50XCJdLCB2ZXJib3NlOiBcImFueSBzcGFjZVwifSxcbiAgRlVOQ19DQUxMX1BBUkFNUzoge3J1bGVzOiBbXCJFWFBSIGNvbW1hIEFOWV9TUEFDRSsgRlVOQ19DQUxMX1BBUkFNUyBBTllfU1BBQ0UqXCIsIFwiRVhQUiBBTllfU1BBQ0UqXCJdfSxcbiAgRlVOQ19DQUxMOiB7cnVsZXM6IFtcbiAgICBcIm9wZW5fcGFyIEZVTkNfQ0FMTF9QQVJBTVM/IGNsb3NlX3BhclwiXG4gIF19LFxuICBcbiAgVFlQRToge3J1bGVzOiBbXCJuYW1lIGNvbG9uXCJdfSxcbiAgXG4gIEZPUjoge3J1bGVzOiBbXG4gICAgXCJmb3JfbG9vcCBrOm5hbWUgY29tbWEgVyB2Om5hbWUgVyBpbiBhOkVYUFIgYjpCTE9DS1wiLFxuICAgIFwiZm9yX2xvb3AgdjpuYW1lIFcgaW4gYTpFWFBSIGI6QkxPQ0tcIl0sXG4gICAgaG9va3M6IFtyZWZsZWN0LCByZWZsZWN0XVxuICB9LFxuICBcbiAgU1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSOiB7cnVsZXM6IFtcbiAgICBcImUxOkVYUFIgY29tbWEgVyBlMjpTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFJcIixcbiAgICBcImUxOkVYUFIgY29tbWEgVyBlMjpFWFBSXCJcbiAgXSxcbiAgaG9va3M6IFtcbiAgICBmdW5jdGlvbiAocCkgeyByZXR1cm4gW3AuZTFdLmNvbmNhdChwLmUyLmNoaWxkcmVuKTsgfSwgZnVuY3Rpb24gKHApIHsgcmV0dXJuIFtwLmUxLCBwLmUyXTsgfVxuICBdIFxuICB9LFxuICBcbiAgQ09NTUFfU0VQQVJBVEVEX0VYUFI6IHtydWxlczogW1xuICAgIFwiRVhQUiBjb21tYSBBTllfU1BBQ0UrIENPTU1BX1NFUEFSQVRFRF9FWFBSIEFOWV9TUEFDRSpcIixcbiAgICBcIkVYUFIgQU5ZX1NQQUNFKlwiXG4gIF19LFxuICBcbiAgQVJSQVk6IHtydWxlczogW1xuICAgIFwib3Blbl9icmEgQU5ZX1NQQUNFKiBjOkNPTU1BX1NFUEFSQVRFRF9FWFBSPyBBTllfU1BBQ0UqIGNsb3NlX2JyYVwiXG4gIF19LFxuICBcbiAgTUVNQkVSUzoge3J1bGVzOiBbXG4gICAgXCJuYW1lIGNvbG9uIFcgRVhQUiBzYW1lZGVudD8gY29tbWEgQU5ZX1NQQUNFKyBNRU1CRVJTIEFOWV9TUEFDRSpcIixcbiAgICBcIm5hbWUgY29sb24gVyBFWFBSIEFOWV9TUEFDRSpcIlxuICBdfSxcbiAgXG4gIE9CSkVDVDoge3J1bGVzOiBbXG4gICAgXCJvcGVuX2N1cmx5IGluZGVudD8gTUVNQkVSUz8gY2xvc2VfY3VybHlcIlxuICBdfSxcbiAgXG4gIFRBR19QQVJBTVM6IHtydWxlczogW1xuICAgIFwibGVmdDpUQUdfUEFSQU1TIFcgcmlnaHQ6VEFHX1BBUkFNU1wiLFxuICAgIFwibjpuYW1lIGFzc2lnbiBlOkVYUFJcIixcbiAgICBcIm46bmFtZVwiXG4gICAgXSxcbiAgICBob29rczogW3JlZmxlY3QsIHJlZmxlY3QsIHJlZmxlY3RdLFxuICAgIHZlcmJvc2U6IFwidGFnIHBhcmFtZXRlcnNcIlxuICB9LFxuICBcbiAgVEFHOiB7cnVsZXM6IFtcbiAgICBcInRhZzp0YWcgVz8gcGFyYW1zOlRBR19QQVJBTVM/IGVuZDo+PyBibG9jazpCTE9DSz9cIlxuICBdLFxuICBob29rczogW3JlZmxlY3RdXG4gIH0sXG4gIFxuICBET01fQVNTSUdOOiB7cnVsZXM6IFtcbiAgICBcImFzc2lnbiBFWFBSXCJcbiAgXX0sXG4gIFxuICBUUllfQ0FUQ0g6IHtydWxlczogW1xuICAgIFwidHJ5IGIxOkJMT0NLIHNhbWVkZW50PyBjYXRjaCBvcGVuX3BhciBlcnI6bmFtZT8gY2xvc2VfcGFyIGIyOkJMT0NLXCJcbiAgICBdLFxuICAgIGhvb2tzOiBbcmVmbGVjdF1cbiAgfSxcbiAgXG4gIFRIUk9XOiB7cnVsZXM6IFtcbiAgICBcInRocm93IEVYUFJcIlxuICBdfSxcbiAgXG4gIFJFVFVSTjoge3J1bGVzOiBbXCJyZXQgVyBTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFJcIiwgXCJyZXQgVyBFWFBSXCIsIFwicmV0XCJdfSxcbiAgUklHSFRfRVhQUjoge3J1bGVzOiBbXG4gICAgXCJtYXRoX29wZXJhdG9yc1wiLFxuICAgIFwiVyBiaW5hcnlfb3BlcmF0b3JzIFcgRVhQUlwiLFxuICAgIFwiVyBvciBFWFBSXCIsXG4gICAgXCJXIGFuZCBFWFBSXCIsXG4gICAgXCJXIGNvbXBhcmlzb24gVyBFWFBSXCIsXG4gICAgXCJXID4gVyBFWFBSXCIsXG4gICAgXCJkb3QgRVhQUlwiLFxuICAgIFwiVyBpbnN0YW5jZW9mIEVYUFJcIixcbiAgICBcIm9wZW5fYnJhIEVYUFIgY2xvc2VfYnJhXCIsXG4gICAgXCJGVU5DX0NBTExcIlxuICAgIF0sXG4gICAgdmVyYm9zZTogXCJleHByZXNzaW9uXCJcbiAgfSxcbiAgXG4gIEVYUFI6IHtydWxlczogW1xuICAgIFwiSUZfRVhQUlwiLFxuICAgIFwiTUFUSFwiLFxuICAgIFwiT0JKRUNUXCIsXG4gICAgXCJGVU5DX0RFRlwiLFxuICAgIFwiRVhQUiBSSUdIVF9FWFBSXCIsXG4gICAgXCJuYW1lXCIsXG4gICAgXCJudW1iZXJcIixcbiAgICBcIkxBTUJEQVwiLFxuICAgIFwic3RyaW5nXCIsXG4gICAgXCJyZWdleHBcIixcbiAgICBcIm9wZW5fcGFyIEVYUFIgY2xvc2VfcGFyXCIsXG4gICAgXCJuZXcgRVhQUlwiLFxuICAgIFwibm90IEVYUFJcIixcbiAgICBcIkFSUkFZXCJcbiAgICBdLFxuICAgIHZlcmJvc2U6IFwiZXhwcmVzc2lvblwiXG4gIH1cbn07XG5cbmZ1bmN0aW9uIHNwYWNlcihuKSB7XG4gIHZhciBvdXQsIGk7XG4gIG91dCA9IFwiXCI7XG4gIGkgPSAwO1xuICB3aGlsZShpIDwgbil7XG4gICAgb3V0ICs9IFwiIFwiO1xuICAgIGkrKztcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiBzcChtb2QpIHtcbiAgaWYobW9kKSB7XG4gICAgcmV0dXJuIHNwYWNlcigyICogKGRlcHRoICsgbW9kKSk7XG4gIH1cbiAgcmV0dXJuIHNwYWNlcigyICogZGVwdGgpO1xufVxuXG5uYyA9IDE7XG5cbi8vIGNoaWxkcmVuIG5hbWVcbmZ1bmN0aW9uIENOKCkge1xuICByZXR1cm4gcHJlZml4ICsgJ2MnICsgbmM7XG59XG5cbmZ1bmN0aW9uIHB1c2hDTigpIHtcbiAgbmMrKztcbiAgcmV0dXJuIHByZWZpeCArICdjJyArIG5jO1xufVxuXG5mdW5jdGlvbiBwb3BDTigpIHtcbiAgbmMtLTtcbiAgcmV0dXJuIHByZWZpeCArICdjJyArIG5jO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZUhvaXN0ZWRWYXIoKSB7XG4gIHZhciBucywgaG9pc3RlZDtcbiAgbnMgPSBjdXJyZW50TnMoKTtcbiAgaG9pc3RlZCA9IFtdO1xuICB2YXIgX19rZXlzMiA9IE9iamVjdC5rZXlzKG5zKTtcbiAgZm9yKHZhciBfX2luZGV4MiA9IDA7IF9faW5kZXgyIDwgX19rZXlzMi5sZW5ndGg7IF9faW5kZXgyKyspIHtcbiAgICB2YXIga2V5ID0gX19rZXlzMltfX2luZGV4Ml07XG4gICAgdmFyIHZhbHVlID0gbnNbX19rZXlzMltfX2luZGV4Ml1dO1xuICAgIGlmKHZhbHVlID09PSAnaG9pc3QnKSB7XG4gICAgICBob2lzdGVkLnB1c2goa2V5KTtcbiAgICB9XG4gIH1cbiAgaWYoaG9pc3RlZC5sZW5ndGgpIHtcbiAgICByZXR1cm4gJ3ZhciAnICsgaG9pc3RlZC5qb2luKCcsICcpICsgJzsnO1xuICB9XG4gIHJldHVybiAnJztcbn1cblxuZnVuY3Rpb24gaG9pc3RWYXIobmFtZSkge1xuICB2YXIgbnM7XG4gIG5zID0gY3VycmVudE5zKCk7XG4gIG5zW25hbWVdID0gJ2hvaXN0Jztcbn1cblxuYmFja2VuZCA9IHtcbiAgU1RBUlQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciwgaG9pc3RlZDtcbiAgICBzdHIgPSAnJztcbiAgICB2YXIgX19rZXlzMyA9IE9iamVjdC5rZXlzKG5vZGUuY2hpbGRyZW4pO1xuICAgIGZvcih2YXIgX19pbmRleDMgPSAwOyBfX2luZGV4MyA8IF9fa2V5czMubGVuZ3RoOyBfX2luZGV4MysrKSB7XG4gICAgICB2YXIgY2hpbGQgPSBub2RlLmNoaWxkcmVuW19fa2V5czNbX19pbmRleDNdXTtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoY2hpbGQpO1xuICAgIH1cbiAgICBob2lzdGVkID0gZ2VuZXJhdGVIb2lzdGVkVmFyKCk7XG4gICAgaWYoaG9pc3RlZCkge1xuICAgICAgcmV0dXJuIGdlbmVyYXRlSG9pc3RlZFZhcigpICsgJ1xcbicgKyBzdHI7XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgLFxuICBkZWRlbnQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgZGVwdGggPSBNYXRoLm1heCgwLCBkZXB0aCAtIDEpO1xuICAgIHJldHVybiAnJztcbiAgfVxuICAsXG4gIGluZGVudDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICBkZXB0aCA9IGRlcHRoICsgMTtcbiAgICByZXR1cm4gJ1xcbicgKyBzcCgpO1xuICB9XG4gICxcbiAgc2FtZWRlbnQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIGwsIGksIHN0cjtcbiAgICBsID0gbm9kZS52YWx1ZS5zcGxpdCgnXFxuJykubGVuZ3RoIC0gMTtcbiAgICBpID0gMDtcbiAgICBzdHIgPSAnJztcbiAgICB3aGlsZShpIDwgbCl7XG4gICAgICBzdHIgKz0gJ1xcbicgKyBzcCgpO1xuICAgICAgaSsrO1xuICAgIH1cbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgRE9NX0FTU0lHTjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgbmFtZSwgdmFybmFtZSwgc3RyO1xuICAgIG5hbWUgPSBDTigpO1xuICAgIHZhcm5hbWUgPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblsxXSk7XG4gICAgaG9pc3RWYXIoQ04oKSk7XG4gICAgaG9pc3RWYXIoJycgKyBwcmVmaXggKyAndG1wJyk7XG4gICAgc3RyID0gJycgKyBwcmVmaXggKyAndG1wID0gJyArIHZhcm5hbWUgKyAnOyAnICsgcHJlZml4ICsgJ3RtcCBpbnN0YW5jZW9mIEFycmF5ID8gKCcgKyBuYW1lICsgJyA9ICcgKyBuYW1lICsgJy5jb25jYXQoJyArIHByZWZpeCArICd0bXApKSA6ICcgKyBuYW1lICsgJy5wdXNoKFN0cmluZygnICsgcHJlZml4ICsgJ3RtcCkpJztcbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgVEFHX1BBUkFNUzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgbmFtZTtcbiAgICBpZihub2RlLmNoaWxkcmVuLmxlZnQpIHtcbiAgICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5sZWZ0KSArICcsICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5yaWdodCk7XG4gICAgfVxuICAgIFxuICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuLm4udmFsdWU7XG4gICAgXG4gICAgaWYobm9kZS5jaGlsZHJlbi5lKSB7XG4gICAgICByZXR1cm4gbmFtZSArICc6ICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG5hbWUgKyAnOiB0cnVlJztcbiAgICB9XG4gIH1cbiAgLFxuICBUQUc6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciwgcGFyYW1zLCBuYW1lLCBzdWIsIG5zO1xuICAgIHN0ciA9ICcnO1xuICAgIHBhcmFtcyA9IFwie1wiO1xuICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuLnRhZy52YWx1ZS5zdWJzdHJpbmcoMSk7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5wYXJhbXMpIHtcbiAgICAgIHBhcmFtcyArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMpO1xuICAgIH1cbiAgICBcbiAgICBwYXJhbXMgKz0gJ30nO1xuICAgIHN1YiA9ICdbXSc7XG4gICAgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBcbiAgICBpZihub2RlLmNoaWxkcmVuLmJsb2NrKSB7XG4gICAgICBzdWIgPSBwdXNoQ04oKTtcbiAgICAgIHN0ciArPSBDTigpICsgJyA9IFtdOyc7XG4gICAgICBob2lzdFZhcihDTigpKTtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5ibG9jayk7XG4gICAgICBwb3BDTigpO1xuICAgIH1cbiAgICBcbiAgICBzdHIgKz0gJ1xcbicgKyBzcCgpICsgQ04oKSArICcucHVzaCh2aXJ0dWFsRG9tLmgoXCInICsgbmFtZSArICdcIiwge2F0dHJpYnV0ZXM6ICcgKyBwYXJhbXMgKyAnfSwgJyArIHN1YiArICcpKSc7XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuICAsXG4gIENMQVNTOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBuYW1lLCBmdW5jcywgcGFyZW50LCBzdHIsIGNvbnN0cnVjdG9yLCBmdW5jX2RlZiwgZnVuY19uYW1lLCBucywgcGFyYW1zLCBib2R5LCBjb25zX3N0cjtcbiAgICBuYW1lID0gbm9kZS5jaGlsZHJlbi5uYW1lLnZhbHVlO1xuICAgIGZ1bmNzID0gbm9kZS5jaGlsZHJlbi5tZXRob2RzO1xuICAgIHBhcmVudCA9IG5vZGUuY2hpbGRyZW4ucGFyZW50O1xuICAgIHN0ciA9ICcnO1xuICAgIGNvbnN0cnVjdG9yID0gbnVsbDtcbiAgICB2YXIgX19rZXlzNCA9IE9iamVjdC5rZXlzKGZ1bmNzKTtcbiAgICBmb3IodmFyIF9faW5kZXg0ID0gMDsgX19pbmRleDQgPCBfX2tleXM0Lmxlbmd0aDsgX19pbmRleDQrKykge1xuICAgICAgdmFyIGZ1bmMgPSBmdW5jc1tfX2tleXM0W19faW5kZXg0XV07XG4gICAgICBmdW5jX2RlZiA9IGZ1bmMuY2hpbGRyZW47XG4gICAgICBmdW5jX25hbWUgPSBmdW5jX2RlZi5jaGlsZHJlbi5mbi52YWx1ZTtcbiAgICAgIGlmKGZ1bmNfbmFtZSA9PT0gJ2NvbnN0cnVjdG9yJykge1xuICAgICAgICBjb25zdHJ1Y3RvciA9IGZ1bmNfZGVmO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyICs9ICdcXG4nICsgc3AoKSArIG5hbWUgKyAnLnByb3RvdHlwZS4nICsgZnVuY19uYW1lICsgJyA9ICcgKyBnZW5lcmF0ZUNvZGUoZnVuY19kZWYpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBob2lzdFZhcihuYW1lKTtcbiAgICBucyA9IG5ld05zKCk7XG4gICAgXG4gICAgcGFyYW1zID0gY29uc3RydWN0b3IgJiYgY29uc3RydWN0b3IuY2hpbGRyZW4ucGFyYW1zO1xuICAgIGlmKHBhcmFtcykge1xuICAgICAgcGFyYW1zID0gZ2VuZXJhdGVDb2RlKHBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcmFtcyA9ICcnO1xuICAgIH1cbiAgICBcbiAgICBib2R5ID0gY29uc3RydWN0b3IgJiYgY29uc3RydWN0b3IuY2hpbGRyZW4uYmxvY2s7XG4gICAgY29uc19zdHIgPSAnJyArIG5hbWUgKyAnID0gZnVuY3Rpb24gJyArIG5hbWUgKyAnICggJyArIHBhcmFtcyArICcgKSB7JztcbiAgICBjb25zX3N0ciArPSAnXFxuJyArIHNwKDEpICsgJ2lmKCEodGhpcyBpbnN0YW5jZW9mICcgKyBuYW1lICsgJykpeyByZXR1cm4gbmV3ICcgKyBuYW1lICsgJygnICsgT2JqZWN0LmtleXMobnMpLmpvaW4oJywnKSArICcpfSc7XG4gICAgdmFyIF9fa2V5czUgPSBPYmplY3Qua2V5cyhucyk7XG4gICAgZm9yKHZhciBfX2luZGV4NSA9IDA7IF9faW5kZXg1IDwgX19rZXlzNS5sZW5ndGg7IF9faW5kZXg1KyspIHtcbiAgICAgIHZhciBrZXkgPSBfX2tleXM1W19faW5kZXg1XTtcbiAgICAgIHZhciB2YWx1ZSA9IG5zW19fa2V5czVbX19pbmRleDVdXTtcbiAgICAgIGlmKHZhbHVlICE9PSB0cnVlICYmIHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc19zdHIgKz0gJ1xcbicgKyBzcCgxKSArICdpZignICsga2V5ICsgJyA9PT0gdW5kZWZpbmVkKSB7JyArIGtleSArICcgPSAnICsgZ2VuZXJhdGVDb2RlKHZhbHVlKSArICd9JztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYoYm9keSkge1xuICAgICAgY29uc19zdHIgKz0gZ2VuZXJhdGVDb2RlKGJvZHkpO1xuICAgIH1cbiAgICBjb25zX3N0ciArPSBzcCgpICsgJ1xcbn0nO1xuICAgIFxuICAgIGlmKHBhcmVudCkge1xuICAgICAgY29uc19zdHIgKz0gJ1xcbicgKyBzcCgpICsgJycgKyBuYW1lICsgJy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCcgKyBwYXJlbnQudmFsdWUgKyAnLnByb3RvdHlwZSknO1xuICAgICAgY29uc19zdHIgKz0gJ1xcbicgKyBzcCgpICsgJycgKyBuYW1lICsgJy5wcm90b3R5cGUuY29uc3RydWN0b3IgPSAnICsgbmFtZSArICcnO1xuICAgIH1cbiAgICBcbiAgICBuYW1lc3BhY2VzLnBvcCgpO1xuICAgIHJldHVybiBjb25zX3N0ciArIHN0cjtcbiAgfVxuICAsXG4gIExBTUJEQTogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgbmFtZSwgbnMsIHN0ciwgY29kZTtcbiAgICBuYW1lID0gXCJcIjtcbiAgICBucyA9IG5ld05zKCk7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5mbikge1xuICAgICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICBuc1tuYW1lXSA9IHRydWU7XG4gICAgfVxuICAgIFxuICAgIHN0ciA9IFwiZnVuY3Rpb24gXCIgKyBuYW1lICsgXCIoXCI7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5wYXJhbXMpIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMsIG5zKTtcbiAgICB9XG4gICAgXG4gICAgc3RyICs9ICcpIHsnO1xuICAgIHZhciBfX2tleXM2ID0gT2JqZWN0LmtleXMobnMpO1xuICAgIGZvcih2YXIgX19pbmRleDYgPSAwOyBfX2luZGV4NiA8IF9fa2V5czYubGVuZ3RoOyBfX2luZGV4NisrKSB7XG4gICAgICB2YXIga2V5ID0gX19rZXlzNltfX2luZGV4Nl07XG4gICAgICB2YXIgdmFsdWUgPSBuc1tfX2tleXM2W19faW5kZXg2XV07XG4gICAgICBpZih2YWx1ZSAhPT0gdHJ1ZSAmJiB2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvZGUgPSBnZW5lcmF0ZUNvZGUodmFsdWUpO1xuICAgICAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArICdpZignICsga2V5ICsgJyA9PT0gdW5kZWZpbmVkKSB7JyArIGtleSArICcgPSAnICsgY29kZSArICd9JztcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgc3RyICs9ICcgcmV0dXJuICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5ibG9jaywgbnMpO1xuICAgIH1cbiAgICBcbiAgICBuYW1lc3BhY2VzLnBvcCgpO1xuICAgIHJldHVybiBzdHIgKyBcIjsgfVwiO1xuICB9XG4gICxcbiAgRlVOQ19ERUY6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIG5hbWUsIG5zLCBpc19kb20sIHN0ciwgY29kZSwgYm9keSwgaG9pc3RlZDtcbiAgICBuYW1lID0gXCJcIjtcbiAgICBucyA9IGN1cnJlbnROcygpO1xuICAgIGlzX2RvbSA9IG5vZGUuY2hpbGRyZW4uZmQudmFsdWUgPT09ICdkb20nO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uZm4pIHtcbiAgICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuLmZuLnZhbHVlO1xuICAgICAgbnNbbmFtZV0gPSB0cnVlO1xuICAgIH1cbiAgICBcbiAgICBucyA9IG5ld05zKCk7XG4gICAgc3RyID0gXCJmdW5jdGlvbiBcIiArIG5hbWUgKyBcIihcIjtcbiAgICBpZihub2RlLmNoaWxkcmVuLnBhcmFtcykge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnBhcmFtcyk7XG4gICAgfVxuICAgIFxuICAgIHN0ciArPSAnKSB7JztcbiAgICB2YXIgX19rZXlzNyA9IE9iamVjdC5rZXlzKG5zKTtcbiAgICBmb3IodmFyIF9faW5kZXg3ID0gMDsgX19pbmRleDcgPCBfX2tleXM3Lmxlbmd0aDsgX19pbmRleDcrKykge1xuICAgICAgdmFyIGtleSA9IF9fa2V5czdbX19pbmRleDddO1xuICAgICAgdmFyIHZhbHVlID0gbnNbX19rZXlzN1tfX2luZGV4N11dO1xuICAgICAgaWYodmFsdWUgIT09IHRydWUgJiYgdmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb2RlID0gZ2VuZXJhdGVDb2RlKHZhbHVlKTtcbiAgICAgICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyAnaWYoJyArIGtleSArICcgPT09IHVuZGVmaW5lZCkgeycgKyBrZXkgKyAnID0gJyArIGNvZGUgKyAnO30nO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBib2R5ID0gJyc7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgYm9keSA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrKTtcbiAgICB9XG4gICAgXG4gICAgaWYoaXNfZG9tKSB7XG4gICAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArICd2YXIgJyArIENOKCkgKyAnID0gW107JztcbiAgICB9XG4gICAgXG4gICAgaG9pc3RlZCA9IGdlbmVyYXRlSG9pc3RlZFZhcigpO1xuICAgIGlmKGhvaXN0ZWQpIHtcbiAgICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgaG9pc3RlZDtcbiAgICB9XG4gICAgXG4gICAgc3RyICs9IGJvZHk7XG4gICAgXG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICBcbiAgICBpZihpc19kb20pIHtcbiAgICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgJ3JldHVybiAnICsgQ04oKSArICc7JztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHN0ciArICdcXG4nICsgc3AoKSArICd9JztcbiAgfVxuICAsXG4gIEZVTkNfREVGX1BBUkFNUzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyLCBucztcbiAgICBzdHIgPSBcIlwiO1xuICAgIG5zID0gY3VycmVudE5zKCk7XG4gICAgaWYobm9kZS5jaGlsZHJlblswXS50eXBlID09PSAnbmFtZScpIHtcbiAgICAgIG5zW25vZGUuY2hpbGRyZW5bMF0udmFsdWVdID0gdHJ1ZTtcbiAgICAgIGlmKG5vZGUuY2hpbGRyZW5bMV0gJiYgbm9kZS5jaGlsZHJlblsxXS50eXBlID09PSAnYXNzaWduJykge1xuICAgICAgICBuc1tub2RlLmNoaWxkcmVuWzBdLnZhbHVlXSA9IG5vZGUuY2hpbGRyZW5bMl07XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHZhciBfX2tleXM4ID0gT2JqZWN0LmtleXMobm9kZS5jaGlsZHJlbik7XG4gICAgZm9yKHZhciBfX2luZGV4OCA9IDA7IF9faW5kZXg4IDwgX19rZXlzOC5sZW5ndGg7IF9faW5kZXg4KyspIHtcbiAgICAgIHZhciBuID0gbm9kZS5jaGlsZHJlbltfX2tleXM4W19faW5kZXg4XV07XG4gICAgICBpZihuLnR5cGUgPT09ICduYW1lJyB8fCBuLnR5cGUgPT09ICdGVU5DX0RFRl9QQVJBTVMnIHx8IG4udHlwZSA9PT0gJ2NvbW1hJyB8fCBuLnR5cGUgPT09ICd3aW5kb3cnKSB7XG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobik7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgLFxuICBBU1NJR046IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciwgb3AsIGV4cGxpY2l0X2dsb2JhbCwgbnMsIGxlZnQsIHJpZ2h0X2NvZGUsIHVucGFja19uYW1lLCBpLCBuLCBjaDtcbiAgICBzdHIgPSBcIlwiO1xuICAgIG9wID0gbm9kZS5jaGlsZHJlbi5vcC52YWx1ZTtcbiAgICBleHBsaWNpdF9nbG9iYWwgPSBvcCA9PT0gJzo9JztcbiAgICBpZihleHBsaWNpdF9nbG9iYWwpIHtcbiAgICAgIG9wID0gJz0nO1xuICAgIH1cbiAgICBcbiAgICBucyA9IGN1cnJlbnROcygpO1xuICAgIGxlZnQgPSBub2RlLmNoaWxkcmVuLmxlZnQ7XG4gICAgcmlnaHRfY29kZSA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnJpZ2h0KTtcbiAgICBpZihsZWZ0LnR5cGUgPT09ICdTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFInKSB7XG4gICAgICB1bnBhY2tpbmcrKztcbiAgICAgIHVucGFja19uYW1lID0gJycgKyBwcmVmaXggKyAndW5wYWNrJyArIHVucGFja2luZyArICcnO1xuICAgICAgc3RyICs9ICd2YXIgJyArIHVucGFja19uYW1lICsgJyA9ICcgKyByaWdodF9jb2RlICsgJztcXG4nICsgc3AoKTtcbiAgICAgIGkgPSAwO1xuICAgICAgdmFyIF9fa2V5czkgPSBPYmplY3Qua2V5cyhsZWZ0LmNoaWxkcmVuKTtcbiAgICAgIGZvcih2YXIgX19pbmRleDkgPSAwOyBfX2luZGV4OSA8IF9fa2V5czkubGVuZ3RoOyBfX2luZGV4OSsrKSB7XG4gICAgICAgIHZhciBjaGlsZCA9IGxlZnQuY2hpbGRyZW5bX19rZXlzOVtfX2luZGV4OV1dO1xuICAgICAgICBuID0gY2hpbGQuY2hpbGRyZW5bMF07XG4gICAgICAgIGlmKG4udHlwZSA9PT0gJ25hbWUnKSB7XG4gICAgICAgICAgaWYoY3VycmVudE5zSGFzKG4udmFsdWUpID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIG5zW24udmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoY2hpbGQpICsgJyAnICsgb3AgKyAnICcgKyB1bnBhY2tfbmFtZSArICdbJyArIGkgKyAnXTtcXG4nICsgc3AoKTtcbiAgICAgICAgaSsrO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG4gICAgaWYobGVmdC5jaGlsZHJlblswXS50eXBlID09PSAnbmFtZScpIHtcbiAgICAgIGNoID0gbGVmdC5jaGlsZHJlblswXTtcbiAgICAgIGlmKCFjdXJyZW50TnNIYXMoY2gudmFsdWUpKSB7XG4gICAgICAgIGlmKCFleHBsaWNpdF9nbG9iYWwpIHtcbiAgICAgICAgICBuc1tjaC52YWx1ZV0gPSAnaG9pc3QnO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5sZWZ0KSArICcgJyArIG9wICsgJyAnICsgcmlnaHRfY29kZTtcbiAgfVxuICAsXG4gIFNUQVRFTUVOVDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyLCBlLCB0LCBvdGhlcjtcbiAgICBzdHIgPSAnJztcbiAgICB2YXIgX19rZXlzMTAgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgICBmb3IodmFyIF9faW5kZXgxMCA9IDA7IF9faW5kZXgxMCA8IF9fa2V5czEwLmxlbmd0aDsgX19pbmRleDEwKyspIHtcbiAgICAgIHZhciBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX19rZXlzMTBbX19pbmRleDEwXV07XG4gICAgICBlID0gY2hpbGQuY2hpbGRyZW4gJiYgY2hpbGQuY2hpbGRyZW5bMF07XG4gICAgICAvLyBUT0RPOiB0aGlzIHNob3VsZCBiZSBwb3NzaWJsZVxuICAgICAgdCA9IGNoaWxkLnR5cGU7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKGNoaWxkKTtcbiAgICAgIG90aGVyID0gZSAmJiAoZS50eXBlID09PSAnRlVOQ19ERUYnIHx8IGUudHlwZSA9PT0gJ0xBTUJEQScpO1xuICAgICAgaWYodCA9PT0gJ0ZPUicgfHwgdCA9PT0gJ1RSWV9DQVRDSCcgfHwgdCA9PT0gJ1dISUxFJyB8fCB0ID09PSAnSUYnIHx8IHQgPT09ICdTVEFURU1FTlQnIHx8IHQgPT09ICdzYW1lZGVudCcgfHwgb3RoZXIpIHtcbiAgICAgICAgXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgKz0gJzsnO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgSUY6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciwgZWxpZjtcbiAgICBzdHIgPSAnJztcbiAgICBzdHIgPSAnaWYoJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJykgeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgICBlbGlmID0gbm9kZS5jaGlsZHJlbi5lbGlmO1xuICAgIGlmKGVsaWYpIHtcbiAgICAgIGlmKEFycmF5LmlzQXJyYXkoZWxpZikpIHtcbiAgICAgICAgdmFyIF9fa2V5czExID0gT2JqZWN0LmtleXMoZWxpZik7XG4gICAgICAgIGZvcih2YXIgX19pbmRleDExID0gMDsgX19pbmRleDExIDwgX19rZXlzMTEubGVuZ3RoOyBfX2luZGV4MTErKykge1xuICAgICAgICAgIHZhciB2YWx1ZSA9IGVsaWZbX19rZXlzMTFbX19pbmRleDExXV07XG4gICAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZSh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoZWxpZik7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmKG5vZGUuY2hpbGRyZW4uZWwpIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lbCk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgLFxuICBJRl9FWFBSOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHI7XG4gICAgc3RyID0gJyc7XG4gICAgc3RyID0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4udGVzdCkgKyAnID8gJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJyA6ICc7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5lbCkge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmVsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyICs9ICd1bmRlZmluZWQnO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgRUxTRV9FWFBSOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKTtcbiAgfVxuICAsXG4gIFdISUxFOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnd2hpbGUoJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJyl7JyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICB9XG4gICxcbiAgRk9SOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBrZXlJbmRleE5hbWUsIGtleUFycmF5TmFtZSwgYXJyYXlOYW1lLCB2YXJOYW1lLCBpbmRleE5hbWUsIHN0cjtcbiAgICBrZXlJbmRleE5hbWUgPSBwcmVmaXggKyBcImluZGV4XCIgKyBmb3JMb29wQ291bnQ7XG4gICAga2V5QXJyYXlOYW1lID0gcHJlZml4ICsgXCJrZXlzXCIgKyBmb3JMb29wQ291bnQ7XG4gICAgYXJyYXlOYW1lID0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYSk7XG4gICAgdmFyTmFtZSA9IG5vZGUuY2hpbGRyZW4udi52YWx1ZTtcbiAgICBmb3JMb29wQ291bnQrKztcbiAgICBpbmRleE5hbWUgPSBmYWxzZTtcbiAgICBpZihub2RlLmNoaWxkcmVuLmspIHtcbiAgICAgIGluZGV4TmFtZSA9IG5vZGUuY2hpbGRyZW4uay52YWx1ZTtcbiAgICB9XG4gICAgXG4gICAgc3RyID0gJ3ZhciAnICsga2V5QXJyYXlOYW1lICsgJyA9IE9iamVjdC5rZXlzKCcgKyBhcnJheU5hbWUgKyAnKTtcXG4nO1xuICAgIHN0ciArPSBzcCgpICsgJ2Zvcih2YXIgJyArIGtleUluZGV4TmFtZSArICcgPSAwOyAnICsga2V5SW5kZXhOYW1lICsgJyA8ICcgKyBrZXlBcnJheU5hbWUgKyAnLmxlbmd0aDsgJyArIGtleUluZGV4TmFtZSArICcrKykge1xcbic7XG4gICAgaWYoaW5kZXhOYW1lKSB7XG4gICAgICBzdHIgKz0gc3AoMSkgKyAndmFyICcgKyBpbmRleE5hbWUgKyAnID0gJyArIGtleUFycmF5TmFtZSArICdbJyArIGtleUluZGV4TmFtZSArICddO1xcbic7XG4gICAgfVxuICAgIFxuICAgIHN0ciArPSBzcCgxKSArICd2YXIgJyArIHZhck5hbWUgKyAnID0gJyArIGFycmF5TmFtZSArICdbJyArIGtleUFycmF5TmFtZSArICdbJyArIGtleUluZGV4TmFtZSArICddXTsnO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgRUxTRV9JRjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyBlbHNlIGlmKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcpIHsnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYikgKyAnXFxuJyArIHNwKCkgKyAnfSc7XG4gIH1cbiAgLFxuICBFTFNFOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnIGVsc2UgeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgfVxuICAsXG4gIFRSWV9DQVRDSDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyO1xuICAgIHN0ciA9IFwidHJ5IHtcIjtcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYjEpO1xuICAgIHN0ciArPSAnXFxuJyArIHNwKCkgKyBcIn0gY2F0Y2goXCIgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lcnIpICsgXCIpIHtcIjtcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYjIpO1xuICAgIHJldHVybiBzdHIgKyAnXFxuJyArIHNwKCkgKyBcIn1cIjtcbiAgfVxuICAsXG4gIFNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgZWxlbWVudHM7XG4gICAgZWxlbWVudHMgPSBbXTtcbiAgICB2YXIgX19rZXlzMTIgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgICBmb3IodmFyIF9faW5kZXgxMiA9IDA7IF9faW5kZXgxMiA8IF9fa2V5czEyLmxlbmd0aDsgX19pbmRleDEyKyspIHtcbiAgICAgIHZhciBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX19rZXlzMTJbX19pbmRleDEyXV07XG4gICAgICBlbGVtZW50cy5wdXNoKGdlbmVyYXRlQ29kZShjaGlsZCkpO1xuICAgIH1cbiAgICByZXR1cm4gJ1snICsgZWxlbWVudHMuam9pbihcIiwgXCIpICsgJ10nO1xuICB9XG4gICxcbiAgc3RyaW5nOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciB2LCBhc3Q7XG4gICAgdiA9IG5vZGUudmFsdWU7XG4gICAgdiA9IHYucmVwbGFjZSgvXFxuL2csIFwiXFxcXG5cIik7XG4gICAgYXN0ID0gc3RyR3JhbS5wYXJzZSh2KTtcbiAgICBpZighYXN0LmNvbXBsZXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYXN0LmhpbnQpO1xuICAgIH1cbiAgICByZXR1cm4gZ2VuZXJhdGVTdHJpbmdDb2RlKGFzdCwgdi5jaGFyQXQoMCkpO1xuICB9XG4gICxcbiAgY29tbWVudDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZS5yZXBsYWNlKC9eIy9nLCBcIi8vXCIpO1xuICB9XG4gICxcbiAgcGF6ejogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgLFxuICBub3Q6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuICchJztcbiAgfVxuICAsXG4gIGFuZDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyYmICc7XG4gIH1cbiAgLFxuICBvcjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJ3x8ICc7XG4gIH1cbiAgLFxuICBjb21wYXJpc29uOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIGlmKG5vZGUudmFsdWUgPT09ICc9PScpIHtcbiAgICAgIHJldHVybiAnPT09JztcbiAgICB9XG4gICAgXG4gICAgaWYobm9kZS52YWx1ZSA9PT0gJyE9Jykge1xuICAgICAgcmV0dXJuICchPT0nO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgfVxufTtcblxuZnVuY3Rpb24gZ2VuZXJhdGVDb2RlKG5vZGUpIHtcbiAgdmFyIHN0cjtcbiAgaWYoIW5vZGUpIHtcbiAgICAvLyBkZWJ1Z2dlclxuICB9XG4gIGlmKGJhY2tlbmRbbm9kZS50eXBlXSkge1xuICAgIHJldHVybiBiYWNrZW5kW25vZGUudHlwZV0obm9kZSk7XG4gIH1cbiAgXG4gIGlmKG5vZGUudmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9XG4gIFxuICBzdHIgPSBcIlwiO1xuICBpZighbm9kZS5jaGlsZHJlbikge1xuICAgIHJldHVybiAnJztcbiAgfVxuICBcbiAgdmFyIF9fa2V5czEzID0gT2JqZWN0LmtleXMobm9kZS5jaGlsZHJlbik7XG4gIGZvcih2YXIgX19pbmRleDEzID0gMDsgX19pbmRleDEzIDwgX19rZXlzMTMubGVuZ3RoOyBfX2luZGV4MTMrKykge1xuICAgIHZhciBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX19rZXlzMTNbX19pbmRleDEzXV07XG4gICAgc3RyICs9IGdlbmVyYXRlQ29kZShjaGlsZCk7XG4gIH1cbiAgXG4gIHJldHVybiBzdHI7XG59XG5cblxuZnVuY3Rpb24gZ2VuZXJhdGVFeHBvcnRzKGtleXMpIHtcbiAgdmFyIHN0cjtcbiAgc3RyID0gJ1xcbm1vZHVsZS5leHBvcnRzID0geyc7XG4gIGtleXMgPSBrZXlzIHx8IE9iamVjdC5rZXlzKGN1cnJlbnROcygpKTtcbiAgdmFyIF9fa2V5czE0ID0gT2JqZWN0LmtleXMoa2V5cyk7XG4gIGZvcih2YXIgX19pbmRleDE0ID0gMDsgX19pbmRleDE0IDwgX19rZXlzMTQubGVuZ3RoOyBfX2luZGV4MTQrKykge1xuICAgIHZhciBrZXkgPSBrZXlzW19fa2V5czE0W19faW5kZXgxNF1dO1xuICAgIHN0ciArPSAnXFxuICAnICsga2V5ICsgJyA6ICcgKyBrZXkgKyAnLCc7XG4gIH1cbiAgcmV0dXJuIHN0ciArICdcXG59Jztcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVNb2R1bGUoaW5wdXQsb3B0cykge1xuICB2YXIgYXN0LCBvYmo7XG4gIHJlc2V0R2xvYmFsKCk7XG4gIGFzdCA9IGdyYW0ucGFyc2UoaW5wdXQgKyBcIlxcblwiKTtcbiAgaWYoIWFzdC5jb21wbGV0ZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihhc3QuaGludCk7XG4gIH1cbiAgXG4gIG9iaiA9IHthc3Q6IGFzdCwgY29kZTogZ2VuZXJhdGVDb2RlKGFzdCksIG5zOiBjdXJyZW50TnMoKX07XG4gIHJldHVybiBvYmo7XG59XG5cblxuZ3JhbSA9IGVwZWdqcy5jb21waWxlR3JhbW1hcihncmFtbWFyRGVmLCB0b2tlbkRlZik7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBncmFtbWFyOiBncmFtLFxuICBzdHJHcmFtbWFyOiBzdHJHcmFtLFxuICBncmFtbWFyRGVmOiBncmFtbWFyRGVmLFxuICBlcGVnanM6IGVwZWdqcyxcbiAgdG9rZW5EZWY6IHRva2VuRGVmLFxuICBnZW5lcmF0ZU1vZHVsZTogZ2VuZXJhdGVNb2R1bGUsXG4gIGdlbmVyYXRlQ29kZTogZ2VuZXJhdGVDb2RlLFxuICBnZW5lcmF0ZUV4cG9ydHM6IGdlbmVyYXRlRXhwb3J0c1xufTtcblxuXG4iXX0=
