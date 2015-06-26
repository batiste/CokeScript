!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.cokescript=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var epegjs, depth, forLoopCount, unpacking, namespaces, levelStack, prefix, tokenDef, strInterpolationTokenDef, strInterpolationGrammarDef, strGram, grammarDef, nc, backend, gram;
// CokeScript language by Batiste Bieler 2015
// Implemented using EPEG.JS

epegjs = require("epegjs");

depth = 0;
forLoopCount = 1;
unpacking = 0;
namespaces = [{}];
levelStack = [0];
prefix = '__';

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
  {key: "function_def", func: defDef, verbose: "def definition"},
  {key: "class", reg: /^class /},
  {key: "ret", reg: /^return/, verbose: "return"},
  {key: "if", reg: /^if /},
  {key: "while", reg: /^while /},
  {key: "try", reg: /^try/},
  {key: "catch", reg: /^catch/},
  {key: "throw", reg: /^throw /},
  {key: "pazz", reg: /^pass/},
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
  
  var _keys1 = Object.keys(node.children);
  for(var _index1 = 0; _index1 < _keys1.length; _index1++) {
    var child = node.children[_keys1[_index1]];
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
  var _keys2 = Object.keys(ns);
  for(var _index2 = 0; _index2 < _keys2.length; _index2++) {
    var key = _keys2[_index2];
    var value = ns[_keys2[_index2]];
    if(value === 'hoist') {
      hoisted.push(key);
    }
  }
  if(hoisted.length) {
    return 'var ' + hoisted.join(', ') + ';';
  }
  return '';
}

backend = {
  START: function (node) {
    var str, hoisted;
    str = '';
    var _keys3 = Object.keys(node.children);
    for(var _index3 = 0; _index3 < _keys3.length; _index3++) {
      var child = node.children[_keys3[_index3]];
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
    str = 'var ' + prefix + 'tmp = ' + varname + '; ' + prefix + 'tmp instanceof Array ? (' + name + ' = ' + name + '.concat(' + prefix + 'tmp)) : ' + name + '.push(String(' + prefix + 'tmp))';
    return str;
  }
  ,
  TAG_PARAMS: function (node) {
    if(node.children.left) {
      return generateCode(node.children.left) + ', ' + generateCode(node.children.right);
    }
    
    if(node.children.e) {
      return node.children.n.value + ': ' + generateCode(node.children.e);
    } else {
      return node.children.n.value + ': true';
    }
  }
  ,
  TAG: function (node) {
    var str, params, name, sub;
    str = '';
    params = "{";
    name = node.children.tag.value.substring(1);
    if(node.children.params) {
      params += generateCode(node.children.params);
    }
    
    params += '}';
    sub = '[]';
    if(node.children.block) {
      sub = pushCN();
      str += 'var ' + CN() + ' = [];';
      str += generateCode(node.children.block);
      popCN();
    }
    
    str += '\n' + sp() + CN() + '.push(h("' + name + '", ' + params + ', ' + sub + '))';
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
    var _keys4 = Object.keys(funcs);
    for(var _index4 = 0; _index4 < _keys4.length; _index4++) {
      var func = funcs[_keys4[_index4]];
      func_def = func.children;
      func_name = func_def.children.fn.value;
      if(func_name === 'constructor') {
        constructor = func_def;
      } else {
        str += '\n' + sp() + name + '.prototype.' + func_name + ' = ' + generateCode(func_def);
      }
    }
    
    ns = currentNs();
    ns[name] = 'hoist';
    ns = newNs();
    
    params = constructor && constructor.children.params;
    if(params) {
      params = generateCode(params);
    } else {
      params = '';
    }
    
    body = constructor && constructor.children.block;
    cons_str = '' + name + ' = function ' + name + '(' + params + ') {';
    cons_str += '\n' + sp(1) + 'if(!(this instanceof ' + name + ')){ return new ' + name + '(' + Object.keys(ns).join(',') + ')}';
    var _keys5 = Object.keys(ns);
    for(var _index5 = 0; _index5 < _keys5.length; _index5++) {
      var key = _keys5[_index5];
      var value = ns[_keys5[_index5]];
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
    var _keys6 = Object.keys(ns);
    for(var _index6 = 0; _index6 < _keys6.length; _index6++) {
      var key = _keys6[_index6];
      var value = ns[_keys6[_index6]];
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
    var _keys7 = Object.keys(ns);
    for(var _index7 = 0; _index7 < _keys7.length; _index7++) {
      var key = _keys7[_index7];
      var value = ns[_keys7[_index7]];
      if(value !== true && value !== undefined) {
        code = generateCode(value);
        str += '\n' + sp(1) + 'if(' + key + ' === undefined) {' + key + ' = ' + code + ';}';
      }
    }
    
    if(is_dom) {
      str += '\n' + sp(1) + 'var ' + CN() + ' = [];';
    }
    
    body = '';
    if(node.children.block) {
      body = generateCode(node.children.block);
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
    
    var _keys8 = Object.keys(node.children);
    for(var _index8 = 0; _index8 < _keys8.length; _index8++) {
      var n = node.children[_keys8[_index8]];
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
      str += 'var ' + unpack_name + ' = ' + right_code + '\n' + sp();
      i = 0;
      var _keys9 = Object.keys(left.children);
      for(var _index9 = 0; _index9 < _keys9.length; _index9++) {
        var child = left.children[_keys9[_index9]];
        n = child.children[0];
        if(n.type === 'name') {
          if(currentNsHas(n.value) === undefined) {
            ns[n.value] = true;
          }
        }
        
        str += generateCode(n) + ' ' + op + ' ' + unpack_name + '[' + i + '];\n' + sp();
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
    var _keys10 = Object.keys(node.children);
    for(var _index10 = 0; _index10 < _keys10.length; _index10++) {
      var child = node.children[_keys10[_index10]];
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
        var _keys11 = Object.keys(elif);
        for(var _index11 = 0; _index11 < _keys11.length; _index11++) {
          var value = elif[_keys11[_index11]];
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
    var _keys12 = Object.keys(node.children);
    for(var _index12 = 0; _index12 < _keys12.length; _index12++) {
      var child = node.children[_keys12[_index12]];
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
  
  var _keys13 = Object.keys(node.children);
  for(var _index13 = 0; _index13 < _keys13.length; _index13++) {
    var child = node.children[_keys13[_index13]];
    str += generateCode(child);
  }
  
  return str;
}


function generateExports(keys) {
  var str;
  str = '\nmodule.exports = {';
  keys = keys || Object.keys(currentNs());
  var _keys14 = Object.keys(keys);
  for(var _index14 = 0; _index14 < _keys14.length; _index14++) {
    var key = keys[_keys14[_index14]];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb2tlc2NyaXB0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBRGg4QkE7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGVwZWdqcywgZGVwdGgsIGZvckxvb3BDb3VudCwgdW5wYWNraW5nLCBuYW1lc3BhY2VzLCBsZXZlbFN0YWNrLCBwcmVmaXgsIHRva2VuRGVmLCBzdHJJbnRlcnBvbGF0aW9uVG9rZW5EZWYsIHN0ckludGVycG9sYXRpb25HcmFtbWFyRGVmLCBzdHJHcmFtLCBncmFtbWFyRGVmLCBuYywgYmFja2VuZCwgZ3JhbTtcbi8vIENva2VTY3JpcHQgbGFuZ3VhZ2UgYnkgQmF0aXN0ZSBCaWVsZXIgMjAxNVxuLy8gSW1wbGVtZW50ZWQgdXNpbmcgRVBFRy5KU1xuXG5lcGVnanMgPSByZXF1aXJlKFwiZXBlZ2pzXCIpO1xuXG5kZXB0aCA9IDA7XG5mb3JMb29wQ291bnQgPSAxO1xudW5wYWNraW5nID0gMDtcbm5hbWVzcGFjZXMgPSBbe31dO1xubGV2ZWxTdGFjayA9IFswXTtcbnByZWZpeCA9ICdfXyc7XG5cbmZ1bmN0aW9uIGN1cnJlbnROcygpIHtcbiAgcmV0dXJuIG5hbWVzcGFjZXNbbmFtZXNwYWNlcy5sZW5ndGggLSAxXTtcbn1cblxuZnVuY3Rpb24gY3VycmVudE5zSGFzKHApIHtcbiAgcmV0dXJuIG5hbWVzcGFjZXNbbmFtZXNwYWNlcy5sZW5ndGggLSAxXS5oYXNPd25Qcm9wZXJ0eShwKTtcbn1cblxuZnVuY3Rpb24gbmV3TnMoKSB7XG4gIG5hbWVzcGFjZXMucHVzaCh7fSk7XG4gIHJldHVybiBuYW1lc3BhY2VzW25hbWVzcGFjZXMubGVuZ3RoIC0gMV07XG59XG5cbmZ1bmN0aW9uIHJlc2V0R2xvYmFsKCkge1xuICBuYW1lc3BhY2VzID0gW3t9XTtcbiAgZm9yTG9vcENvdW50ID0gMTtcbiAgbGV2ZWxTdGFjayA9IFswXTtcbiAgZGVwdGggPSAwO1xuICB1bnBhY2tpbmcgPSAwO1xufVxuXG4vLyB0b2tlbiBhcmUgbWF0Y2hlZCBpbiBvcmRlciBvZiBkZWNsYXJhdGlvbjtcbi8vIFRPRE86IGFkZCBmdW5jdGlvbnNcblxudG9rZW5EZWYgPSBbXG4gIHtrZXk6IFwic3RyaW5nXCIsIGZ1bmM6IHN0cmluZ0RlZn0sXG4gIHtrZXk6IFwiY29tbWVudFwiLCBmdW5jOiBjb21tZW50RGVmfSxcbiAge2tleTogXCJmdW5jdGlvbl9kZWZcIiwgZnVuYzogZGVmRGVmLCB2ZXJib3NlOiBcImRlZiBkZWZpbml0aW9uXCJ9LFxuICB7a2V5OiBcImNsYXNzXCIsIHJlZzogL15jbGFzcyAvfSxcbiAge2tleTogXCJyZXRcIiwgcmVnOiAvXnJldHVybi8sIHZlcmJvc2U6IFwicmV0dXJuXCJ9LFxuICB7a2V5OiBcImlmXCIsIHJlZzogL15pZiAvfSxcbiAge2tleTogXCJ3aGlsZVwiLCByZWc6IC9ed2hpbGUgL30sXG4gIHtrZXk6IFwidHJ5XCIsIHJlZzogL150cnkvfSxcbiAge2tleTogXCJjYXRjaFwiLCByZWc6IC9eY2F0Y2gvfSxcbiAge2tleTogXCJ0aHJvd1wiLCByZWc6IC9edGhyb3cgL30sXG4gIHtrZXk6IFwicGF6elwiLCByZWc6IC9ecGFzcy99LFxuICB7a2V5OiBcIm5ld1wiLCByZWc6IC9ebmV3IC99LFxuICB7a2V5OiBcInRhZ1wiLCByZWc6IC9ePFthLXpBLVpdWzAtOWEtekEtWl17MCwyOX0vfSxcbiAge2tleTogXCI+XCIsIHJlZzogL14+L30sXG4gIHtrZXk6IFwiZWxzZWlmXCIsIHJlZzogL15lbHNlaWYgL30sXG4gIHtrZXk6IFwiZWxzZVwiLCByZWc6IC9eZWxzZS99LFxuICB7a2V5OiBcImZvcl9sb29wXCIsIHJlZzogL15mb3IgLywgdmVyYm9zZTogXCJmb3IgbG9vcFwifSxcbiAge2tleTogXCJpblwiLCByZWc6IC9eaW4gL30sXG4gIHtrZXk6IFwibm90XCIsIHJlZzogL15ub3QgLywgdmVyYm9zZTogXCJub3RcIn0sXG4gIHtrZXk6IFwibmFtZVwiLCByZWc6IC9eW2EtekEtWl8kXVswLTlhLXpBLVpfJF17MCwyOX0vfSxcbiAge2tleTogXCJyZWdleHBcIiwgZnVuYzogcmVnRXhwRGVmLCB2ZXJib3NlOiBcInJlZ3VsYXIgZXByZXNzaW9uXCJ9LFxuICB7a2V5OiBcIm1hdGhfb3BlcmF0b3JzXCIsIHJlZzogL14oXFwrXFwrfFxcLVxcLSkvLCB2ZXJib3NlOiBcIm1hdGggb3BlcmF0b3JcIn0sXG4gIHtrZXk6IFwiYmluYXJ5X29wZXJhdG9yc1wiLCByZWc6IC9eKFxcJlxcJnxcXHxcXHx8XFwmfFxcfHw8PHxcXD5cXD4pLywgdmVyYm9zZTogXCJiaW5hcnkgb3BlcmF0b3JcIn0sXG4gIHtrZXk6IFwiY29tcGFyaXNvblwiLCByZWc6IC9eKDw9fD49fDx8PnwhPXw9PSkvfSxcbiAge2tleTogXCJhc3NpZ25cIiwgcmVnOiAvXihcXCs9fC09fD18Oj0pL30sXG4gIHtrZXk6IFwibnVtYmVyXCIsIHJlZzogL15bLV0/WzAtOV0rXFwuP1swLTldKi99LFxuICB7a2V5OiBcImNvbW1hXCIsIHJlZzogL15cXCwvfSxcbiAge2tleTogXCJkb3RcIiwgcmVnOiAvXlxcLi99LFxuICB7a2V5OiBcImNvbG9uXCIsIHJlZzogL15cXDovLCB2ZXJib3NlOiBcIjpcIn0sXG4gIHtrZXk6IFwib3Blbl9wYXJcIiwgcmVnOiAvXlxcKC8sIHZlcmJvc2U6IFwiKFwifSxcbiAge2tleTogXCJjbG9zZV9wYXJcIiwgcmVnOiAvXlxcKS8sIHZlcmJvc2U6IFwiKVwifSxcbiAge2tleTogXCJvcGVuX2JyYVwiLCByZWc6IC9eXFxbLywgdmVyYm9zZTogXCJbXCJ9LFxuICB7a2V5OiBcImNsb3NlX2JyYVwiLCByZWc6IC9eXFxdLywgdmVyYm9zZTogXCJdXCJ9LFxuICB7a2V5OiBcIm9wZW5fY3VybHlcIiwgcmVnOiAvXlxcey8sIHZlcmJvc2U6IFwie1wifSxcbiAge2tleTogXCJjbG9zZV9jdXJseVwiLCByZWc6IC9eXFx9LywgdmVyYm9zZTogXCJ9XCJ9LFxuICB7a2V5OiBcIm1hdGhcIiwgcmVnOiAvXlstfFxcK3xcXCp8XFwvfCVdL30sXG4gIHtrZXk6IFwic2FtZWRlbnRcIiwgZnVuYzogZGVudChcInNhbWVkZW50XCIpLCB2ZXJib3NlOiBcInNhbWUgaW5kZW50YXRpb25cIn0sXG4gIHtrZXk6IFwiZGVkZW50XCIsIGZ1bmM6IGRlbnQoXCJkZWRlbnRcIil9LFxuICB7a2V5OiBcImluZGVudFwiLCBmdW5jOiBkZW50KFwiaW5kZW50XCIpfSxcbiAge2tleTogXCJXXCIsIHJlZzogL15bIF0vLCB2ZXJib3NlOiBcInNpbmdsZSB3aGl0ZXNwYWNlXCJ9XG5dO1xuXG5mdW5jdGlvbiBzdGFydFN0cihpbnB1dCxzdHJlYW0pIHtcbiAgdmFyIGxhc3Q7XG4gIGxhc3QgPSBzdHJlYW1bc3RyZWFtLmxlbmd0aCAtIDFdO1xuICBpZihsYXN0ICYmIGxhc3QudmFsdWUgPT09IFwiXFxcXFwiKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmKGlucHV0Lm1hdGNoKC9eI3svKSkge1xuICAgIHJldHVybiBcIiN7XCI7XG4gIH1cbn1cblxuc3RySW50ZXJwb2xhdGlvblRva2VuRGVmID0gW1xuICB7a2V5OiBcInN0YXJ0XCIsIGZ1bmM6IHN0YXJ0U3RyfSxcbiAge2tleTogXCJlbmRcIiwgcmVnOiAvXn0vfSxcbiAge2tleTogXCJuYW1lXCIsIHJlZzogL15bYS16QS1aXyRdWzAtOWEtekEtWl9dezAsMjl9L30sXG4gIHtrZXk6IFwiZG90XCIsIHJlZzogL15cXC4vfSxcbiAge2tleTogXCJjaGFyXCIsIHJlZzogL14uL31cbl07XG5cbnN0ckludGVycG9sYXRpb25HcmFtbWFyRGVmID0ge1xuICBTVEFSVDoge3J1bGVzOiBbXCJFTCogRU9GXCJdfSxcbiAgRUw6IHtydWxlczogW1wiVkFSXCIsIFwiY2hhclwiLCBcIm5hbWVcIiwgXCJzdGFydFwiLCBcImVuZFwiLCBcImRvdFwiXX0sXG4gIFZBUjoge3J1bGVzOiBbXCJzdGFydCBOQU1FIGVuZFwiXX0sXG4gIE5BTUU6IHtydWxlczogW1wibmFtZSBkb3QgTkFNRVwiLCBcIm5hbWVcIl19XG59O1xuXG5zdHJHcmFtID0gZXBlZ2pzLmNvbXBpbGVHcmFtbWFyKHN0ckludGVycG9sYXRpb25HcmFtbWFyRGVmLCBzdHJJbnRlcnBvbGF0aW9uVG9rZW5EZWYpO1xuXG5mdW5jdGlvbiBnZW5lcmF0ZVN0cmluZ0NvZGUobm9kZSxjKSB7XG4gIHZhciBzdHI7XG4gIGlmKG5vZGUudHlwZSA9PT0gJ1ZBUicpIHtcbiAgICByZXR1cm4gYyArICcgKyAnICsgZ2VuZXJhdGVTdHJpbmdDb2RlKG5vZGUuY2hpbGRyZW5bMV0sIGMpICsgJyArICcgKyBjO1xuICB9XG4gIFxuICBpZihub2RlLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgfVxuICBcbiAgc3RyID0gJyc7XG4gIGlmKCFub2RlLmNoaWxkcmVuKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG4gIFxuICB2YXIgX2tleXMxID0gT2JqZWN0LmtleXMobm9kZS5jaGlsZHJlbik7XG4gIGZvcih2YXIgX2luZGV4MSA9IDA7IF9pbmRleDEgPCBfa2V5czEubGVuZ3RoOyBfaW5kZXgxKyspIHtcbiAgICB2YXIgY2hpbGQgPSBub2RlLmNoaWxkcmVuW19rZXlzMVtfaW5kZXgxXV07XG4gICAgc3RyICs9IGdlbmVyYXRlU3RyaW5nQ29kZShjaGlsZCwgYyk7XG4gIH1cbiAgcmV0dXJuIHN0cjtcbn1cblxuZnVuY3Rpb24gY3VycmVudExldmVsKCkge1xuICByZXR1cm4gbGV2ZWxTdGFja1tsZXZlbFN0YWNrLmxlbmd0aCAtIDFdO1xufVxuXG5mdW5jdGlvbiBpbmRlbnRUeXBlKGwpIHtcbiAgaWYobCA+IGN1cnJlbnRMZXZlbCgpKSB7XG4gICAgcmV0dXJuICdpbmRlbnQnO1xuICB9XG4gIFxuICBpZihsIDwgY3VycmVudExldmVsKCkpIHtcbiAgICByZXR1cm4gJ2RlZGVudCc7XG4gIH1cbiAgXG4gIGlmKGwgPT09IGN1cnJlbnRMZXZlbCgpKSB7XG4gICAgcmV0dXJuICdzYW1lZGVudCc7XG4gIH1cbn1cblxuZnVuY3Rpb24gZGVudChkZW50VHlwZSkge1xuICByZXR1cm4gZnVuY3Rpb24gX2RlbnQoaW5wdXQpIHtcbiAgICB2YXIgbSwgbGluZXMsIGluZGVudDtcbiAgICAvLyBlbXB0eSBsaW5lIGlzIGEgc2FtZWRlbnRcbiAgICBtID0gaW5wdXQubWF0Y2goL15cXG5bXFxzXSovKTtcbiAgICBpZihtKSB7XG4gICAgICBsaW5lcyA9IG1bMF0uc3BsaXQoXCJcXG5cIik7XG4gICAgICBpbmRlbnQgPSBsaW5lc1tsaW5lcy5sZW5ndGggLSAxXS5sZW5ndGg7XG4gICAgICBpZihpbmRlbnRUeXBlKGluZGVudCkgPT09IGRlbnRUeXBlKSB7XG4gICAgICAgIGlmKGRlbnRUeXBlID09PSAnZGVkZW50Jykge1xuICAgICAgICAgIGxldmVsU3RhY2sucG9wKCk7XG4gICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZihkZW50VHlwZSA9PT0gJ2luZGVudCcpIHtcbiAgICAgICAgICBsZXZlbFN0YWNrLnB1c2goaW5kZW50KTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIG1bMF07XG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuXG5mdW5jdGlvbiBzdHJpbmdEZWYoaW5wdXQpIHtcbiAgdmFyIGZpcnN0LCBpLCBjaDtcbiAgZmlyc3QgPSBpbnB1dC5jaGFyQXQoMCk7XG4gIGlmKGZpcnN0ID09PSAnXCInIHx8IGZpcnN0ID09PSBcIidcIikge1xuICAgIGkgPSAxO1xuICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSl7XG4gICAgICBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxcXCcpIHtcbiAgICAgICAgaSsrO1xuICAgICAgfSBlbHNlIGlmKGNoID09PSBmaXJzdCkge1xuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSArIDEpO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiByZWdFeHBEZWYoaW5wdXQpIHtcbiAgdmFyIGksIGNoO1xuICBpZihpbnB1dC5jaGFyQXQoMCkgPT09ICcvJykge1xuICAgIGkgPSAxO1xuICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSl7XG4gICAgICBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxcXCcpIHtcbiAgICAgICAgaSsrO1xuICAgICAgfSBlbHNlIGlmKGNoID09PSAnLycpIHtcbiAgICAgICAgaSsrO1xuICAgICAgICAvLyBtb2RpZmllcnNcbiAgICAgICAgd2hpbGUoaW5wdXQuY2hhckF0KGkpICYmIFwiaWdtXCIuaW5kZXhPZihpbnB1dC5jaGFyQXQoaSkpICE9PSAtMSl7XG4gICAgICAgICAgaSsrO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpbnB1dC5zbGljZSgwLCBpKTtcbiAgICAgIH1cbiAgICAgIGkrKztcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZGVmRGVmKGlucHV0KSB7XG4gIGlmKGlucHV0Lm1hdGNoKC9eZGVmW1xcKHwgfFxcbl0vKSkge1xuICAgIHJldHVybiBcImRlZlwiO1xuICB9XG4gIFxuICBpZihpbnB1dC5pbmRleE9mKFwiZG9tIFwiKSA9PT0gMCkge1xuICAgIHJldHVybiBcImRvbVwiO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbW1lbnREZWYoaW5wdXQpIHtcbiAgdmFyIG0sIGksIGNoO1xuICBtID0gaW5wdXQubWF0Y2goL14jLyk7XG4gIGlmKG0pIHtcbiAgICBpID0gbVswXS5sZW5ndGg7XG4gICAgd2hpbGUoaW5wdXQuY2hhckF0KGkpKXtcbiAgICAgIGNoID0gaW5wdXQuY2hhckF0KGkpO1xuICAgICAgaWYoY2ggPT09ICdcXG4nKSB7XG4gICAgICAgIHJldHVybiBpbnB1dC5zbGljZSgwLCBpKTtcbiAgICAgIH1cbiAgICAgIGkrKztcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVmbGVjdChwYXJhbXMpIHsgcmV0dXJuIHBhcmFtczsgfVxuXG5ncmFtbWFyRGVmID0ge1xuICBTVEFSVDoge3J1bGVzOiBbXCJMSU5FKiBFT0ZcIl19LFxuICBFTEM6IHtydWxlczogW1wiVyogY29tbWVudFwiXSwgdmVyYm9zZTogXCJjb21tZW50XCJ9LFxuICBMSU5FOiB7cnVsZXM6IFtcIlNUQVRFTUVOVCBFTEM/IHNhbWVkZW50K1wiLCBcIlNUQVRFTUVOVCBFTEM/ICFkZWRlbnRcIiwgXG4gICAgXCJFTEM/IHNhbWVkZW50XCIsIFwiRUxDICFkZWRlbnRcIl0sIHZlcmJvc2U6IFwibmV3IGxpbmVcIn0sXG4gIEJMT0NLOiB7cnVsZXM6IFtcImluZGVudCBwYXp6IGRlZGVudFwiLCBcImluZGVudCBMSU5FKyBkZWRlbnRcIl19LFxuICBTVEFURU1FTlQ6IHtydWxlczogW1wiQVNTSUdOXCIsIFwiRVhQUlwiLCBcIklGXCIsIFwiV0hJTEVcIiwgXCJGT1JcIiwgXCJSRVRVUk5cIiwgXG4gICAgXCJDTEFTU1wiLCBcIlRBR1wiLCBcIkRPTV9BU1NJR05cIiwgXCJUUllfQ0FUQ0hcIiwgXCJUSFJPV1wiXX0sXG4gIENMQVNTX01FVEhPRFM6IHtcbiAgICBydWxlczogW1wic2FtZWRlbnQqIGY6RlVOQ19ERUYgc2FtZWRlbnQqXCJdLFxuICAgIGhvb2tzOiBbZnVuY3Rpb24gKHApIHsgcmV0dXJuIHAuZjsgfV1cbiAgfSxcbiAgQ0xBU1M6IHtcbiAgICBydWxlczogW1xuICAgICAgXCJjbGFzcyBuOm5hbWUgb3Blbl9wYXIgcDpuYW1lIGNsb3NlX3BhciBpbmRlbnQgbTpDTEFTU19NRVRIT0RTKyBkZWRlbnRcIixcbiAgICAgIFwiY2xhc3MgbjpuYW1lIGluZGVudCBtOkNMQVNTX01FVEhPRFMrIGRlZGVudFwiXG4gICAgXSxcbiAgICBob29rczogW1xuICAgICAgZnVuY3Rpb24gKHApIHsgcmV0dXJuIHtuYW1lOiBwLm4sIG1ldGhvZHM6IHAubSwgcGFyZW50OiBwLnB9OyB9LFxuICAgICAgZnVuY3Rpb24gKHApIHsgcmV0dXJuIHtuYW1lOiBwLm4sIG1ldGhvZHM6IHAubX07IH1cbiAgICBdXG4gIH0sXG4gIEZVTkNfREVGX1BBUkFNUzoge3J1bGVzOiBbXG4gICAgXCJwMTpGVU5DX0RFRl9QQVJBTVMgY29tbWEgVyBwMjpGVU5DX0RFRl9QQVJBTVNcIixcbiAgICBcInAxOm5hbWUgYXNzaWduIGU6RVhQUlwiLFxuICAgIFwicDE6bmFtZVwiXG4gICAgXSxcbiAgICB2ZXJib3NlOiBcImRlZiBwYXJhbWV0ZXJzXCJcbiAgfSxcbiAgTEFNQkRBOiB7cnVsZXM6IFtcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBvcGVuX3BhciBwYXJhbXM6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgVyBibG9jazpFWFBSXCIsXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgVyBmbjpuYW1lIG9wZW5fcGFyIHBhcmFtczpGVU5DX0RFRl9QQVJBTVM/IGNsb3NlX3BhciBXIGJsb2NrOkVYUFJcIixcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGJsb2NrOkVYUFJcIlxuICAgIF0sXG4gICAgaG9va3M6IFtyZWZsZWN0LCByZWZsZWN0LCByZWZsZWN0XVxuICB9LFxuICBGVU5DX0RFRjoge3J1bGVzOiBbXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIGJsb2NrOkJMT0NLXCIsXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgVyBmbjpuYW1lIG9wZW5fcGFyIHBhcmFtczpGVU5DX0RFRl9QQVJBTVM/IGNsb3NlX3BhciBibG9jazpCTE9DS1wiLFxuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBibG9jazpCTE9DS1wiLFxuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIGJsb2NrOkJMT0NLXCJcbiAgICBdLFxuICAgIGhvb2tzOiBbcmVmbGVjdCwgcmVmbGVjdCwgcmVmbGVjdCwgcmVmbGVjdF0sXG4gICAgdmVyYm9zZTogXCJkZWYgZGVmaW5pdGlvblwiXG4gIH0sXG4gIEVMU0VfSUY6IHtydWxlczogW1wic2FtZWRlbnQgZWxzZWlmIGU6RVhQUiBiOkJMT0NLXCJdLCBob29rczogW3JlZmxlY3RdfSxcbiAgRUxTRToge3J1bGVzOiBbXCJzYW1lZGVudCBlbHNlIGI6QkxPQ0tcIl0sIGhvb2tzOiBbcmVmbGVjdF19LFxuICBJRjoge3J1bGVzOiBbXCJpZiBlOkVYUFIgYjpCTE9DSyBlbGlmOkVMU0VfSUYqIGVsOkVMU0U/XCJdLCBob29rczogW3JlZmxlY3RdfSxcbiAgRUxTRV9FWFBSOiB7cnVsZXM6IFtcIlcgZWxzZSBXIGI6RVhQUlwiXSwgaG9va3M6IFtyZWZsZWN0XX0sXG4gIElGX0VYUFI6IHtydWxlczogW1wiZTpFWFBSIFcgaWYgdGVzdDpFWFBSIGVsOkVMU0VfRVhQUj9cIl0sIGhvb2tzOiBbcmVmbGVjdF19LFxuICBXSElMRToge3J1bGVzOiBbXCJ3aGlsZSBlOkVYUFIgYjpCTE9DS1wiXSwgaG9va3M6IFtyZWZsZWN0XX0sXG4gIE1BVEg6IHtydWxlczogW1wiZTE6RVhQUiBXIG9wOm1hdGggVyBlMjpFWFBSXCJdfSxcbiAgUEFUSDoge3J1bGVzOiBbXCJQQVRIIGRvdCBuYW1lXCIsIFwiUEFUSCBvcGVuX2JyYSBudW1iZXIgY2xvc2VfYnJhXCIsIFwibmFtZVwiXX0sXG4gIEFTU0lHTjoge3J1bGVzOiBbXG4gICAgXCJsZWZ0OkVYUFIgVyBvcDphc3NpZ24gVyByaWdodDpFWFBSXCIsXG4gICAgXCJsZWZ0OlNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUiBXIG9wOmFzc2lnbiBXIHJpZ2h0OlNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUlwiLFxuICAgIFwibGVmdDpTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFIgVyBvcDphc3NpZ24gVyByaWdodDpFWFBSXCJcbiAgXSwgaG9va3M6IFtyZWZsZWN0LCByZWZsZWN0LCByZWZsZWN0XX0sXG4gIFdfT1JfU0FNRURFTlQ6IHtydWxlczogW1wiV1wiLCBcInNhbWVkZW50XCJdLCB2ZXJib3NlOiBcInNhbWVkZW50IG9yIHdoaXRlc3BhY2VcIn0sXG4gIFdfU0FNRURFTlRfSU5ERU5UOiB7cnVsZXM6IFtcIldcIiwgXCJzYW1lZGVudFwiLCBcImluZGVudFwiXSwgdmVyYm9zZTogXCJpbmRlbnQgb3Igc2FtZWRlbnQgb3Igd2hpdGVzcGFjZVwifSxcbiAgQU5ZX1NQQUNFOiB7cnVsZXM6IFtcIldcIiwgXCJzYW1lZGVudFwiLCBcImluZGVudFwiLCBcImRlZGVudFwiLCBcImNvbW1lbnRcIl0sIHZlcmJvc2U6IFwiYW55IHNwYWNlXCJ9LFxuICBGVU5DX0NBTExfUEFSQU1TOiB7cnVsZXM6IFtcIkVYUFIgY29tbWEgQU5ZX1NQQUNFKyBGVU5DX0NBTExfUEFSQU1TIEFOWV9TUEFDRSpcIiwgXCJFWFBSIEFOWV9TUEFDRSpcIl19LFxuICBGVU5DX0NBTEw6IHtydWxlczogW1xuICAgIFwib3Blbl9wYXIgRlVOQ19DQUxMX1BBUkFNUz8gY2xvc2VfcGFyXCJcbiAgXX0sXG4gIFxuICBUWVBFOiB7cnVsZXM6IFtcIm5hbWUgY29sb25cIl19LFxuICBcbiAgRk9SOiB7cnVsZXM6IFtcbiAgICBcImZvcl9sb29wIGs6bmFtZSBjb21tYSBXIHY6bmFtZSBXIGluIGE6RVhQUiBiOkJMT0NLXCIsXG4gICAgXCJmb3JfbG9vcCB2Om5hbWUgVyBpbiBhOkVYUFIgYjpCTE9DS1wiXSxcbiAgICBob29rczogW3JlZmxlY3QsIHJlZmxlY3RdXG4gIH0sXG4gIFxuICBTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFI6IHtydWxlczogW1xuICAgIFwiZTE6RVhQUiBjb21tYSBXIGUyOlNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUlwiLFxuICAgIFwiZTE6RVhQUiBjb21tYSBXIGUyOkVYUFJcIlxuICBdLFxuICBob29rczogW1xuICAgIGZ1bmN0aW9uIChwKSB7IHJldHVybiBbcC5lMV0uY29uY2F0KHAuZTIuY2hpbGRyZW4pOyB9LCBmdW5jdGlvbiAocCkgeyByZXR1cm4gW3AuZTEsIHAuZTJdOyB9XG4gIF0gXG4gIH0sXG4gIFxuICBDT01NQV9TRVBBUkFURURfRVhQUjoge3J1bGVzOiBbXG4gICAgXCJFWFBSIGNvbW1hIEFOWV9TUEFDRSsgQ09NTUFfU0VQQVJBVEVEX0VYUFIgQU5ZX1NQQUNFKlwiLFxuICAgIFwiRVhQUiBBTllfU1BBQ0UqXCJcbiAgXX0sXG4gIFxuICBBUlJBWToge3J1bGVzOiBbXG4gICAgXCJvcGVuX2JyYSBBTllfU1BBQ0UqIGM6Q09NTUFfU0VQQVJBVEVEX0VYUFI/IEFOWV9TUEFDRSogY2xvc2VfYnJhXCJcbiAgXX0sXG4gIFxuICBNRU1CRVJTOiB7cnVsZXM6IFtcbiAgICBcIm5hbWUgY29sb24gVyBFWFBSIHNhbWVkZW50PyBjb21tYSBBTllfU1BBQ0UrIE1FTUJFUlMgQU5ZX1NQQUNFKlwiLFxuICAgIFwibmFtZSBjb2xvbiBXIEVYUFIgQU5ZX1NQQUNFKlwiXG4gIF19LFxuICBcbiAgT0JKRUNUOiB7cnVsZXM6IFtcbiAgICBcIm9wZW5fY3VybHkgaW5kZW50PyBNRU1CRVJTPyBjbG9zZV9jdXJseVwiXG4gIF19LFxuICBcbiAgVEFHX1BBUkFNUzoge3J1bGVzOiBbXG4gICAgXCJsZWZ0OlRBR19QQVJBTVMgVyByaWdodDpUQUdfUEFSQU1TXCIsXG4gICAgXCJuOm5hbWUgYXNzaWduIGU6RVhQUlwiLFxuICAgIFwibjpuYW1lXCJcbiAgICBdLFxuICAgIGhvb2tzOiBbcmVmbGVjdCwgcmVmbGVjdCwgcmVmbGVjdF0sXG4gICAgdmVyYm9zZTogXCJ0YWcgcGFyYW1ldGVyc1wiXG4gIH0sXG4gIFxuICBUQUc6IHtydWxlczogW1xuICAgIFwidGFnOnRhZyBXPyBwYXJhbXM6VEFHX1BBUkFNUz8gZW5kOj4/IGJsb2NrOkJMT0NLP1wiXG4gIF0sXG4gIGhvb2tzOiBbcmVmbGVjdF1cbiAgfSxcbiAgXG4gIERPTV9BU1NJR046IHtydWxlczogW1xuICAgIFwiYXNzaWduIEVYUFJcIlxuICBdfSxcbiAgXG4gIFRSWV9DQVRDSDoge3J1bGVzOiBbXG4gICAgXCJ0cnkgYjE6QkxPQ0sgc2FtZWRlbnQ/IGNhdGNoIG9wZW5fcGFyIGVycjpuYW1lPyBjbG9zZV9wYXIgYjI6QkxPQ0tcIlxuICAgIF0sXG4gICAgaG9va3M6IFtyZWZsZWN0XVxuICB9LFxuICBcbiAgVEhST1c6IHtydWxlczogW1xuICAgIFwidGhyb3cgRVhQUlwiXG4gIF19LFxuICBcbiAgUkVUVVJOOiB7cnVsZXM6IFtcInJldCBXIFNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUlwiLCBcInJldCBXIEVYUFJcIiwgXCJyZXRcIl19LFxuICBSSUdIVF9FWFBSOiB7cnVsZXM6IFtcbiAgICBcIm1hdGhfb3BlcmF0b3JzXCIsXG4gICAgXCJXIGJpbmFyeV9vcGVyYXRvcnMgVyBFWFBSXCIsXG4gICAgXCJXIGNvbXBhcmlzb24gVyBFWFBSXCIsXG4gICAgXCJXID4gVyBFWFBSXCIsXG4gICAgXCJkb3QgRVhQUlwiLFxuICAgIFwib3Blbl9icmEgRVhQUiBjbG9zZV9icmFcIixcbiAgICBcIkZVTkNfQ0FMTFwiXG4gICAgXSxcbiAgICB2ZXJib3NlOiBcImV4cHJlc3Npb25cIlxuICB9LFxuICBcbiAgRVhQUjoge3J1bGVzOiBbXG4gICAgXCJJRl9FWFBSXCIsXG4gICAgXCJNQVRIXCIsXG4gICAgXCJPQkpFQ1RcIixcbiAgICBcIkZVTkNfREVGXCIsXG4gICAgXCJFWFBSIFJJR0hUX0VYUFJcIixcbiAgICBcIm5hbWVcIixcbiAgICBcIm51bWJlclwiLFxuICAgIFwiTEFNQkRBXCIsXG4gICAgXCJzdHJpbmdcIixcbiAgICBcInJlZ2V4cFwiLFxuICAgIFwib3Blbl9wYXIgRVhQUiBjbG9zZV9wYXJcIixcbiAgICBcIm5ldyBFWFBSXCIsXG4gICAgXCJub3QgRVhQUlwiLFxuICAgIFwiQVJSQVlcIlxuICAgIF0sXG4gICAgdmVyYm9zZTogXCJleHByZXNzaW9uXCJcbiAgfVxufTtcblxuZnVuY3Rpb24gc3BhY2VyKG4pIHtcbiAgdmFyIG91dCwgaTtcbiAgb3V0ID0gXCJcIjtcbiAgaSA9IDA7XG4gIHdoaWxlKGkgPCBuKXtcbiAgICBvdXQgKz0gXCIgXCI7XG4gICAgaSsrO1xuICB9XG4gIHJldHVybiBvdXQ7XG59XG5cbmZ1bmN0aW9uIHNwKG1vZCkge1xuICBpZihtb2QpIHtcbiAgICByZXR1cm4gc3BhY2VyKDIgKiAoZGVwdGggKyBtb2QpKTtcbiAgfVxuICByZXR1cm4gc3BhY2VyKDIgKiBkZXB0aCk7XG59XG5cbm5jID0gMTtcbi8vIGNoaWxkcmVuIG5hbWVcbmZ1bmN0aW9uIENOKCkge1xuICByZXR1cm4gcHJlZml4ICsgJ2MnICsgbmM7XG59XG5cbmZ1bmN0aW9uIHB1c2hDTigpIHtcbiAgbmMrKztcbiAgcmV0dXJuIHByZWZpeCArICdjJyArIG5jO1xufVxuXG5mdW5jdGlvbiBwb3BDTigpIHtcbiAgbmMtLTtcbiAgcmV0dXJuIHByZWZpeCArICdjJyArIG5jO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZUhvaXN0ZWRWYXIoKSB7XG4gIHZhciBucywgaG9pc3RlZDtcbiAgbnMgPSBjdXJyZW50TnMoKTtcbiAgaG9pc3RlZCA9IFtdO1xuICB2YXIgX2tleXMyID0gT2JqZWN0LmtleXMobnMpO1xuICBmb3IodmFyIF9pbmRleDIgPSAwOyBfaW5kZXgyIDwgX2tleXMyLmxlbmd0aDsgX2luZGV4MisrKSB7XG4gICAgdmFyIGtleSA9IF9rZXlzMltfaW5kZXgyXTtcbiAgICB2YXIgdmFsdWUgPSBuc1tfa2V5czJbX2luZGV4Ml1dO1xuICAgIGlmKHZhbHVlID09PSAnaG9pc3QnKSB7XG4gICAgICBob2lzdGVkLnB1c2goa2V5KTtcbiAgICB9XG4gIH1cbiAgaWYoaG9pc3RlZC5sZW5ndGgpIHtcbiAgICByZXR1cm4gJ3ZhciAnICsgaG9pc3RlZC5qb2luKCcsICcpICsgJzsnO1xuICB9XG4gIHJldHVybiAnJztcbn1cblxuYmFja2VuZCA9IHtcbiAgU1RBUlQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciwgaG9pc3RlZDtcbiAgICBzdHIgPSAnJztcbiAgICB2YXIgX2tleXMzID0gT2JqZWN0LmtleXMobm9kZS5jaGlsZHJlbik7XG4gICAgZm9yKHZhciBfaW5kZXgzID0gMDsgX2luZGV4MyA8IF9rZXlzMy5sZW5ndGg7IF9pbmRleDMrKykge1xuICAgICAgdmFyIGNoaWxkID0gbm9kZS5jaGlsZHJlbltfa2V5czNbX2luZGV4M11dO1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShjaGlsZCk7XG4gICAgfVxuICAgIGhvaXN0ZWQgPSBnZW5lcmF0ZUhvaXN0ZWRWYXIoKTtcbiAgICBpZihob2lzdGVkKSB7XG4gICAgICByZXR1cm4gZ2VuZXJhdGVIb2lzdGVkVmFyKCkgKyAnXFxuJyArIHN0cjtcbiAgICB9XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuICAsXG4gIGRlZGVudDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICBkZXB0aCA9IE1hdGgubWF4KDAsIGRlcHRoIC0gMSk7XG4gICAgcmV0dXJuICcnO1xuICB9XG4gICxcbiAgaW5kZW50OiBmdW5jdGlvbiAobm9kZSkge1xuICAgIGRlcHRoID0gZGVwdGggKyAxO1xuICAgIHJldHVybiAnXFxuJyArIHNwKCk7XG4gIH1cbiAgLFxuICBzYW1lZGVudDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgbCwgaSwgc3RyO1xuICAgIGwgPSBub2RlLnZhbHVlLnNwbGl0KCdcXG4nKS5sZW5ndGggLSAxO1xuICAgIGkgPSAwO1xuICAgIHN0ciA9ICcnO1xuICAgIHdoaWxlKGkgPCBsKXtcbiAgICAgIHN0ciArPSAnXFxuJyArIHNwKCk7XG4gICAgICBpKys7XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgLFxuICBET01fQVNTSUdOOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBuYW1lLCB2YXJuYW1lLCBzdHI7XG4gICAgbmFtZSA9IENOKCk7XG4gICAgdmFybmFtZSA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzFdKTtcbiAgICBzdHIgPSAndmFyICcgKyBwcmVmaXggKyAndG1wID0gJyArIHZhcm5hbWUgKyAnOyAnICsgcHJlZml4ICsgJ3RtcCBpbnN0YW5jZW9mIEFycmF5ID8gKCcgKyBuYW1lICsgJyA9ICcgKyBuYW1lICsgJy5jb25jYXQoJyArIHByZWZpeCArICd0bXApKSA6ICcgKyBuYW1lICsgJy5wdXNoKFN0cmluZygnICsgcHJlZml4ICsgJ3RtcCkpJztcbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgVEFHX1BBUkFNUzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICBpZihub2RlLmNoaWxkcmVuLmxlZnQpIHtcbiAgICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5sZWZ0KSArICcsICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5yaWdodCk7XG4gICAgfVxuICAgIFxuICAgIGlmKG5vZGUuY2hpbGRyZW4uZSkge1xuICAgICAgcmV0dXJuIG5vZGUuY2hpbGRyZW4ubi52YWx1ZSArICc6ICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG5vZGUuY2hpbGRyZW4ubi52YWx1ZSArICc6IHRydWUnO1xuICAgIH1cbiAgfVxuICAsXG4gIFRBRzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyLCBwYXJhbXMsIG5hbWUsIHN1YjtcbiAgICBzdHIgPSAnJztcbiAgICBwYXJhbXMgPSBcIntcIjtcbiAgICBuYW1lID0gbm9kZS5jaGlsZHJlbi50YWcudmFsdWUuc3Vic3RyaW5nKDEpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ucGFyYW1zKSB7XG4gICAgICBwYXJhbXMgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucGFyYW1zKTtcbiAgICB9XG4gICAgXG4gICAgcGFyYW1zICs9ICd9JztcbiAgICBzdWIgPSAnW10nO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uYmxvY2spIHtcbiAgICAgIHN1YiA9IHB1c2hDTigpO1xuICAgICAgc3RyICs9ICd2YXIgJyArIENOKCkgKyAnID0gW107JztcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5ibG9jayk7XG4gICAgICBwb3BDTigpO1xuICAgIH1cbiAgICBcbiAgICBzdHIgKz0gJ1xcbicgKyBzcCgpICsgQ04oKSArICcucHVzaChoKFwiJyArIG5hbWUgKyAnXCIsICcgKyBwYXJhbXMgKyAnLCAnICsgc3ViICsgJykpJztcbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgQ0xBU1M6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIG5hbWUsIGZ1bmNzLCBwYXJlbnQsIHN0ciwgY29uc3RydWN0b3IsIGZ1bmNfZGVmLCBmdW5jX25hbWUsIG5zLCBwYXJhbXMsIGJvZHksIGNvbnNfc3RyO1xuICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuLm5hbWUudmFsdWU7XG4gICAgZnVuY3MgPSBub2RlLmNoaWxkcmVuLm1ldGhvZHM7XG4gICAgcGFyZW50ID0gbm9kZS5jaGlsZHJlbi5wYXJlbnQ7XG4gICAgc3RyID0gJyc7XG4gICAgY29uc3RydWN0b3IgPSBudWxsO1xuICAgIHZhciBfa2V5czQgPSBPYmplY3Qua2V5cyhmdW5jcyk7XG4gICAgZm9yKHZhciBfaW5kZXg0ID0gMDsgX2luZGV4NCA8IF9rZXlzNC5sZW5ndGg7IF9pbmRleDQrKykge1xuICAgICAgdmFyIGZ1bmMgPSBmdW5jc1tfa2V5czRbX2luZGV4NF1dO1xuICAgICAgZnVuY19kZWYgPSBmdW5jLmNoaWxkcmVuO1xuICAgICAgZnVuY19uYW1lID0gZnVuY19kZWYuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICBpZihmdW5jX25hbWUgPT09ICdjb25zdHJ1Y3RvcicpIHtcbiAgICAgICAgY29uc3RydWN0b3IgPSBmdW5jX2RlZjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSAnXFxuJyArIHNwKCkgKyBuYW1lICsgJy5wcm90b3R5cGUuJyArIGZ1bmNfbmFtZSArICcgPSAnICsgZ2VuZXJhdGVDb2RlKGZ1bmNfZGVmKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBuc1tuYW1lXSA9ICdob2lzdCc7XG4gICAgbnMgPSBuZXdOcygpO1xuICAgIFxuICAgIHBhcmFtcyA9IGNvbnN0cnVjdG9yICYmIGNvbnN0cnVjdG9yLmNoaWxkcmVuLnBhcmFtcztcbiAgICBpZihwYXJhbXMpIHtcbiAgICAgIHBhcmFtcyA9IGdlbmVyYXRlQ29kZShwYXJhbXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJhbXMgPSAnJztcbiAgICB9XG4gICAgXG4gICAgYm9keSA9IGNvbnN0cnVjdG9yICYmIGNvbnN0cnVjdG9yLmNoaWxkcmVuLmJsb2NrO1xuICAgIGNvbnNfc3RyID0gJycgKyBuYW1lICsgJyA9IGZ1bmN0aW9uICcgKyBuYW1lICsgJygnICsgcGFyYW1zICsgJykgeyc7XG4gICAgY29uc19zdHIgKz0gJ1xcbicgKyBzcCgxKSArICdpZighKHRoaXMgaW5zdGFuY2VvZiAnICsgbmFtZSArICcpKXsgcmV0dXJuIG5ldyAnICsgbmFtZSArICcoJyArIE9iamVjdC5rZXlzKG5zKS5qb2luKCcsJykgKyAnKX0nO1xuICAgIHZhciBfa2V5czUgPSBPYmplY3Qua2V5cyhucyk7XG4gICAgZm9yKHZhciBfaW5kZXg1ID0gMDsgX2luZGV4NSA8IF9rZXlzNS5sZW5ndGg7IF9pbmRleDUrKykge1xuICAgICAgdmFyIGtleSA9IF9rZXlzNVtfaW5kZXg1XTtcbiAgICAgIHZhciB2YWx1ZSA9IG5zW19rZXlzNVtfaW5kZXg1XV07XG4gICAgICBpZih2YWx1ZSAhPT0gdHJ1ZSAmJiB2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnNfc3RyICs9ICdcXG4nICsgc3AoMSkgKyAnaWYoJyArIGtleSArICcgPT09IHVuZGVmaW5lZCkgeycgKyBrZXkgKyAnID0gJyArIGdlbmVyYXRlQ29kZSh2YWx1ZSkgKyAnfSc7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGJvZHkpIHtcbiAgICAgIGNvbnNfc3RyICs9IGdlbmVyYXRlQ29kZShib2R5KTtcbiAgICB9XG4gICAgY29uc19zdHIgKz0gc3AoKSArICdcXG59JztcbiAgICBcbiAgICBpZihwYXJlbnQpIHtcbiAgICAgIGNvbnNfc3RyICs9ICdcXG4nICsgc3AoKSArICcnICsgbmFtZSArICcucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSgnICsgcGFyZW50LnZhbHVlICsgJy5wcm90b3R5cGUpJztcbiAgICAgIGNvbnNfc3RyICs9ICdcXG4nICsgc3AoKSArICcnICsgbmFtZSArICcucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gJyArIG5hbWUgKyAnJztcbiAgICB9XG4gICAgXG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICByZXR1cm4gY29uc19zdHIgKyBzdHI7XG4gIH1cbiAgLFxuICBMQU1CREE6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIG5hbWUsIG5zLCBzdHIsIGNvZGU7XG4gICAgbmFtZSA9IFwiXCI7XG4gICAgbnMgPSBuZXdOcygpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uZm4pIHtcbiAgICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuLmZuLnZhbHVlO1xuICAgICAgbnNbbmFtZV0gPSB0cnVlO1xuICAgIH1cbiAgICBcbiAgICBzdHIgPSBcImZ1bmN0aW9uIFwiICsgbmFtZSArIFwiKFwiO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ucGFyYW1zKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucGFyYW1zLCBucyk7XG4gICAgfVxuICAgIFxuICAgIHN0ciArPSAnKSB7JztcbiAgICB2YXIgX2tleXM2ID0gT2JqZWN0LmtleXMobnMpO1xuICAgIGZvcih2YXIgX2luZGV4NiA9IDA7IF9pbmRleDYgPCBfa2V5czYubGVuZ3RoOyBfaW5kZXg2KyspIHtcbiAgICAgIHZhciBrZXkgPSBfa2V5czZbX2luZGV4Nl07XG4gICAgICB2YXIgdmFsdWUgPSBuc1tfa2V5czZbX2luZGV4Nl1dO1xuICAgICAgaWYodmFsdWUgIT09IHRydWUgJiYgdmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb2RlID0gZ2VuZXJhdGVDb2RlKHZhbHVlKTtcbiAgICAgICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyAnaWYoJyArIGtleSArICcgPT09IHVuZGVmaW5lZCkgeycgKyBrZXkgKyAnID0gJyArIGNvZGUgKyAnfSc7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmKG5vZGUuY2hpbGRyZW4uYmxvY2spIHtcbiAgICAgIHN0ciArPSAnIHJldHVybiAnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYmxvY2ssIG5zKTtcbiAgICB9XG4gICAgXG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICByZXR1cm4gc3RyICsgXCI7IH1cIjtcbiAgfVxuICAsXG4gIEZVTkNfREVGOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBuYW1lLCBucywgaXNfZG9tLCBzdHIsIGNvZGUsIGJvZHksIGhvaXN0ZWQ7XG4gICAgbmFtZSA9IFwiXCI7XG4gICAgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBpc19kb20gPSBub2RlLmNoaWxkcmVuLmZkLnZhbHVlID09PSAnZG9tJztcbiAgICBpZihub2RlLmNoaWxkcmVuLmZuKSB7XG4gICAgICBuYW1lID0gbm9kZS5jaGlsZHJlbi5mbi52YWx1ZTtcbiAgICAgIG5zW25hbWVdID0gdHJ1ZTtcbiAgICB9XG4gICAgXG4gICAgbnMgPSBuZXdOcygpO1xuICAgIHN0ciA9IFwiZnVuY3Rpb24gXCIgKyBuYW1lICsgXCIoXCI7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5wYXJhbXMpIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMpO1xuICAgIH1cbiAgICBcbiAgICBzdHIgKz0gJykgeyc7XG4gICAgdmFyIF9rZXlzNyA9IE9iamVjdC5rZXlzKG5zKTtcbiAgICBmb3IodmFyIF9pbmRleDcgPSAwOyBfaW5kZXg3IDwgX2tleXM3Lmxlbmd0aDsgX2luZGV4NysrKSB7XG4gICAgICB2YXIga2V5ID0gX2tleXM3W19pbmRleDddO1xuICAgICAgdmFyIHZhbHVlID0gbnNbX2tleXM3W19pbmRleDddXTtcbiAgICAgIGlmKHZhbHVlICE9PSB0cnVlICYmIHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29kZSA9IGdlbmVyYXRlQ29kZSh2YWx1ZSk7XG4gICAgICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgJ2lmKCcgKyBrZXkgKyAnID09PSB1bmRlZmluZWQpIHsnICsga2V5ICsgJyA9ICcgKyBjb2RlICsgJzt9JztcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgaWYoaXNfZG9tKSB7XG4gICAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArICd2YXIgJyArIENOKCkgKyAnID0gW107JztcbiAgICB9XG4gICAgXG4gICAgYm9keSA9ICcnO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uYmxvY2spIHtcbiAgICAgIGJvZHkgPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5ibG9jayk7XG4gICAgfVxuICAgIFxuICAgIFxuICAgIGhvaXN0ZWQgPSBnZW5lcmF0ZUhvaXN0ZWRWYXIoKTtcbiAgICBpZihob2lzdGVkKSB7XG4gICAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArIGhvaXN0ZWQ7XG4gICAgfVxuICAgIFxuICAgIHN0ciArPSBib2R5O1xuICAgIFxuICAgIG5hbWVzcGFjZXMucG9wKCk7XG4gICAgXG4gICAgaWYoaXNfZG9tKSB7XG4gICAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArICdyZXR1cm4gJyArIENOKCkgKyAnOyc7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzdHIgKyAnXFxuJyArIHNwKCkgKyAnfSc7XG4gIH1cbiAgLFxuICBGVU5DX0RFRl9QQVJBTVM6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciwgbnM7XG4gICAgc3RyID0gXCJcIjtcbiAgICBucyA9IGN1cnJlbnROcygpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW5bMF0udHlwZSA9PT0gJ25hbWUnKSB7XG4gICAgICBuc1tub2RlLmNoaWxkcmVuWzBdLnZhbHVlXSA9IHRydWU7XG4gICAgICBpZihub2RlLmNoaWxkcmVuWzFdICYmIG5vZGUuY2hpbGRyZW5bMV0udHlwZSA9PT0gJ2Fzc2lnbicpIHtcbiAgICAgICAgbnNbbm9kZS5jaGlsZHJlblswXS52YWx1ZV0gPSBub2RlLmNoaWxkcmVuWzJdO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICB2YXIgX2tleXM4ID0gT2JqZWN0LmtleXMobm9kZS5jaGlsZHJlbik7XG4gICAgZm9yKHZhciBfaW5kZXg4ID0gMDsgX2luZGV4OCA8IF9rZXlzOC5sZW5ndGg7IF9pbmRleDgrKykge1xuICAgICAgdmFyIG4gPSBub2RlLmNoaWxkcmVuW19rZXlzOFtfaW5kZXg4XV07XG4gICAgICBpZihuLnR5cGUgPT09ICduYW1lJyB8fCBuLnR5cGUgPT09ICdGVU5DX0RFRl9QQVJBTVMnIHx8IG4udHlwZSA9PT0gJ2NvbW1hJyB8fCBuLnR5cGUgPT09ICd3aW5kb3cnKSB7XG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobik7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgLFxuICBBU1NJR046IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciwgb3AsIGV4cGxpY2l0X2dsb2JhbCwgbnMsIGxlZnQsIHJpZ2h0X2NvZGUsIHVucGFja19uYW1lLCBpLCBuLCBjaDtcbiAgICBzdHIgPSBcIlwiO1xuICAgIG9wID0gbm9kZS5jaGlsZHJlbi5vcC52YWx1ZTtcbiAgICBleHBsaWNpdF9nbG9iYWwgPSBvcCA9PT0gJzo9JztcbiAgICBpZihleHBsaWNpdF9nbG9iYWwpIHtcbiAgICAgIG9wID0gJz0nO1xuICAgIH1cbiAgICBcbiAgICBucyA9IGN1cnJlbnROcygpO1xuICAgIGxlZnQgPSBub2RlLmNoaWxkcmVuLmxlZnQ7XG4gICAgcmlnaHRfY29kZSA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnJpZ2h0KTtcbiAgICBpZihsZWZ0LnR5cGUgPT09ICdTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFInKSB7XG4gICAgICB1bnBhY2tpbmcrKztcbiAgICAgIHVucGFja19uYW1lID0gJycgKyBwcmVmaXggKyAndW5wYWNrJyArIHVucGFja2luZyArICcnO1xuICAgICAgc3RyICs9ICd2YXIgJyArIHVucGFja19uYW1lICsgJyA9ICcgKyByaWdodF9jb2RlICsgJ1xcbicgKyBzcCgpO1xuICAgICAgaSA9IDA7XG4gICAgICB2YXIgX2tleXM5ID0gT2JqZWN0LmtleXMobGVmdC5jaGlsZHJlbik7XG4gICAgICBmb3IodmFyIF9pbmRleDkgPSAwOyBfaW5kZXg5IDwgX2tleXM5Lmxlbmd0aDsgX2luZGV4OSsrKSB7XG4gICAgICAgIHZhciBjaGlsZCA9IGxlZnQuY2hpbGRyZW5bX2tleXM5W19pbmRleDldXTtcbiAgICAgICAgbiA9IGNoaWxkLmNoaWxkcmVuWzBdO1xuICAgICAgICBpZihuLnR5cGUgPT09ICduYW1lJykge1xuICAgICAgICAgIGlmKGN1cnJlbnROc0hhcyhuLnZhbHVlKSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBuc1tuLnZhbHVlXSA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG4pICsgJyAnICsgb3AgKyAnICcgKyB1bnBhY2tfbmFtZSArICdbJyArIGkgKyAnXTtcXG4nICsgc3AoKTtcbiAgICAgICAgaSsrO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG4gICAgaWYobGVmdC5jaGlsZHJlblswXS50eXBlID09PSAnbmFtZScpIHtcbiAgICAgIGNoID0gbGVmdC5jaGlsZHJlblswXTtcbiAgICAgIGlmKCFjdXJyZW50TnNIYXMoY2gudmFsdWUpKSB7XG4gICAgICAgIGlmKCFleHBsaWNpdF9nbG9iYWwpIHtcbiAgICAgICAgICBuc1tjaC52YWx1ZV0gPSAnaG9pc3QnO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5sZWZ0KSArICcgJyArIG9wICsgJyAnICsgcmlnaHRfY29kZTtcbiAgfVxuICAsXG4gIFNUQVRFTUVOVDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyLCBlLCB0LCBvdGhlcjtcbiAgICBzdHIgPSAnJztcbiAgICB2YXIgX2tleXMxMCA9IE9iamVjdC5rZXlzKG5vZGUuY2hpbGRyZW4pO1xuICAgIGZvcih2YXIgX2luZGV4MTAgPSAwOyBfaW5kZXgxMCA8IF9rZXlzMTAubGVuZ3RoOyBfaW5kZXgxMCsrKSB7XG4gICAgICB2YXIgY2hpbGQgPSBub2RlLmNoaWxkcmVuW19rZXlzMTBbX2luZGV4MTBdXTtcbiAgICAgIGUgPSBjaGlsZC5jaGlsZHJlbiAmJiBjaGlsZC5jaGlsZHJlblswXTtcbiAgICAgIC8vIFRPRE86IHRoaXMgc2hvdWxkIGJlIHBvc3NpYmxlXG4gICAgICB0ID0gY2hpbGQudHlwZTtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoY2hpbGQpO1xuICAgICAgb3RoZXIgPSBlICYmIChlLnR5cGUgPT09ICdGVU5DX0RFRicgfHwgZS50eXBlID09PSAnTEFNQkRBJyk7XG4gICAgICBpZih0ID09PSAnRk9SJyB8fCB0ID09PSAnVFJZX0NBVENIJyB8fCB0ID09PSAnV0hJTEUnIHx8IHQgPT09ICdJRicgfHwgdCA9PT0gJ1NUQVRFTUVOVCcgfHwgdCA9PT0gJ3NhbWVkZW50JyB8fCBvdGhlcikge1xuICAgICAgICBcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSAnOyc7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgLFxuICBJRjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyLCBlbGlmO1xuICAgIHN0ciA9ICcnO1xuICAgIHN0ciA9ICdpZignICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZSkgKyAnKSB7JyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICAgIGVsaWYgPSBub2RlLmNoaWxkcmVuLmVsaWY7XG4gICAgaWYoZWxpZikge1xuICAgICAgaWYoQXJyYXkuaXNBcnJheShlbGlmKSkge1xuICAgICAgICB2YXIgX2tleXMxMSA9IE9iamVjdC5rZXlzKGVsaWYpO1xuICAgICAgICBmb3IodmFyIF9pbmRleDExID0gMDsgX2luZGV4MTEgPCBfa2V5czExLmxlbmd0aDsgX2luZGV4MTErKykge1xuICAgICAgICAgIHZhciB2YWx1ZSA9IGVsaWZbX2tleXMxMVtfaW5kZXgxMV1dO1xuICAgICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUodmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKGVsaWYpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZihub2RlLmNoaWxkcmVuLmVsKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZWwpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgSUZfRVhQUjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyO1xuICAgIHN0ciA9ICcnO1xuICAgIHN0ciA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnRlc3QpICsgJyA/ICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcgOiAnO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uZWwpIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciArPSAndW5kZWZpbmVkJztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuICAsXG4gIEVMU0VfRVhQUjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYik7XG4gIH1cbiAgLFxuICBXSElMRTogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJ3doaWxlKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcpeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgfVxuICAsXG4gIEZPUjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIga2V5SW5kZXhOYW1lLCBrZXlBcnJheU5hbWUsIGFycmF5TmFtZSwgdmFyTmFtZSwgaW5kZXhOYW1lLCBzdHI7XG4gICAga2V5SW5kZXhOYW1lID0gcHJlZml4ICsgXCJpbmRleFwiICsgZm9yTG9vcENvdW50O1xuICAgIGtleUFycmF5TmFtZSA9IHByZWZpeCArIFwia2V5c1wiICsgZm9yTG9vcENvdW50O1xuICAgIGFycmF5TmFtZSA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmEpO1xuICAgIHZhck5hbWUgPSBub2RlLmNoaWxkcmVuLnYudmFsdWU7XG4gICAgZm9yTG9vcENvdW50Kys7XG4gICAgaW5kZXhOYW1lID0gZmFsc2U7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5rKSB7XG4gICAgICBpbmRleE5hbWUgPSBub2RlLmNoaWxkcmVuLmsudmFsdWU7XG4gICAgfVxuICAgIFxuICAgIHN0ciA9ICd2YXIgJyArIGtleUFycmF5TmFtZSArICcgPSBPYmplY3Qua2V5cygnICsgYXJyYXlOYW1lICsgJyk7XFxuJztcbiAgICBzdHIgKz0gc3AoKSArICdmb3IodmFyICcgKyBrZXlJbmRleE5hbWUgKyAnID0gMDsgJyArIGtleUluZGV4TmFtZSArICcgPCAnICsga2V5QXJyYXlOYW1lICsgJy5sZW5ndGg7ICcgKyBrZXlJbmRleE5hbWUgKyAnKyspIHtcXG4nO1xuICAgIGlmKGluZGV4TmFtZSkge1xuICAgICAgc3RyICs9IHNwKDEpICsgJ3ZhciAnICsgaW5kZXhOYW1lICsgJyA9ICcgKyBrZXlBcnJheU5hbWUgKyAnWycgKyBrZXlJbmRleE5hbWUgKyAnXTtcXG4nO1xuICAgIH1cbiAgICBcbiAgICBzdHIgKz0gc3AoMSkgKyAndmFyICcgKyB2YXJOYW1lICsgJyA9ICcgKyBhcnJheU5hbWUgKyAnWycgKyBrZXlBcnJheU5hbWUgKyAnWycgKyBrZXlJbmRleE5hbWUgKyAnXV07JztcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYikgKyAnXFxuJyArIHNwKCkgKyAnfSc7XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuICAsXG4gIEVMU0VfSUY6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuICcgZWxzZSBpZignICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZSkgKyAnKSB7JyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICB9XG4gICxcbiAgRUxTRTogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyBlbHNlIHsnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYikgKyAnXFxuJyArIHNwKCkgKyAnfSc7XG4gIH1cbiAgLFxuICBUUllfQ0FUQ0g6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0cjtcbiAgICBzdHIgPSBcInRyeSB7XCI7XG4gICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIxKTtcbiAgICBzdHIgKz0gJ1xcbicgKyBzcCgpICsgXCJ9IGNhdGNoKFwiICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZXJyKSArIFwiKSB7XCI7XG4gICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIyKTtcbiAgICByZXR1cm4gc3RyICsgJ1xcbicgKyBzcCgpICsgXCJ9XCI7XG4gIH1cbiAgLFxuICBTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFI6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIGVsZW1lbnRzO1xuICAgIGVsZW1lbnRzID0gW107XG4gICAgdmFyIF9rZXlzMTIgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgICBmb3IodmFyIF9pbmRleDEyID0gMDsgX2luZGV4MTIgPCBfa2V5czEyLmxlbmd0aDsgX2luZGV4MTIrKykge1xuICAgICAgdmFyIGNoaWxkID0gbm9kZS5jaGlsZHJlbltfa2V5czEyW19pbmRleDEyXV07XG4gICAgICBlbGVtZW50cy5wdXNoKGdlbmVyYXRlQ29kZShjaGlsZCkpO1xuICAgIH1cbiAgICByZXR1cm4gJ1snICsgZWxlbWVudHMuam9pbihcIiwgXCIpICsgJ10nO1xuICB9XG4gICxcbiAgc3RyaW5nOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciB2LCBhc3Q7XG4gICAgdiA9IG5vZGUudmFsdWU7XG4gICAgdiA9IHYucmVwbGFjZSgvXFxuL2csIFwiXFxcXG5cIik7XG4gICAgYXN0ID0gc3RyR3JhbS5wYXJzZSh2KTtcbiAgICBpZighYXN0LmNvbXBsZXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYXN0LmhpbnQpO1xuICAgIH1cbiAgICByZXR1cm4gZ2VuZXJhdGVTdHJpbmdDb2RlKGFzdCwgdi5jaGFyQXQoMCkpO1xuICB9XG4gICxcbiAgY29tbWVudDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZS5yZXBsYWNlKC9eIy9nLCBcIi8vXCIpO1xuICB9XG4gICxcbiAgcGF6ejogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgLFxuICBub3Q6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuICchJztcbiAgfVxuICAsXG4gIGNvbXBhcmlzb246IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgaWYobm9kZS52YWx1ZSA9PT0gJz09Jykge1xuICAgICAgcmV0dXJuICc9PT0nO1xuICAgIH1cbiAgICBcbiAgICBpZihub2RlLnZhbHVlID09PSAnIT0nKSB7XG4gICAgICByZXR1cm4gJyE9PSc7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9XG59O1xuXG5mdW5jdGlvbiBnZW5lcmF0ZUNvZGUobm9kZSkge1xuICB2YXIgc3RyO1xuICBpZighbm9kZSkge1xuICAgIC8vIGRlYnVnZ2VyXG4gIH1cbiAgaWYoYmFja2VuZFtub2RlLnR5cGVdKSB7XG4gICAgcmV0dXJuIGJhY2tlbmRbbm9kZS50eXBlXShub2RlKTtcbiAgfVxuICBcbiAgaWYobm9kZS52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG5vZGUudmFsdWU7XG4gIH1cbiAgXG4gIHN0ciA9IFwiXCI7XG4gIGlmKCFub2RlLmNoaWxkcmVuKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG4gIFxuICB2YXIgX2tleXMxMyA9IE9iamVjdC5rZXlzKG5vZGUuY2hpbGRyZW4pO1xuICBmb3IodmFyIF9pbmRleDEzID0gMDsgX2luZGV4MTMgPCBfa2V5czEzLmxlbmd0aDsgX2luZGV4MTMrKykge1xuICAgIHZhciBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX2tleXMxM1tfaW5kZXgxM11dO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoY2hpbGQpO1xuICB9XG4gIFxuICByZXR1cm4gc3RyO1xufVxuXG5cbmZ1bmN0aW9uIGdlbmVyYXRlRXhwb3J0cyhrZXlzKSB7XG4gIHZhciBzdHI7XG4gIHN0ciA9ICdcXG5tb2R1bGUuZXhwb3J0cyA9IHsnO1xuICBrZXlzID0ga2V5cyB8fCBPYmplY3Qua2V5cyhjdXJyZW50TnMoKSk7XG4gIHZhciBfa2V5czE0ID0gT2JqZWN0LmtleXMoa2V5cyk7XG4gIGZvcih2YXIgX2luZGV4MTQgPSAwOyBfaW5kZXgxNCA8IF9rZXlzMTQubGVuZ3RoOyBfaW5kZXgxNCsrKSB7XG4gICAgdmFyIGtleSA9IGtleXNbX2tleXMxNFtfaW5kZXgxNF1dO1xuICAgIHN0ciArPSAnXFxuICAnICsga2V5ICsgJyA6ICcgKyBrZXkgKyAnLCc7XG4gIH1cbiAgcmV0dXJuIHN0ciArICdcXG59Jztcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVNb2R1bGUoaW5wdXQsb3B0cykge1xuICB2YXIgYXN0LCBvYmo7XG4gIHJlc2V0R2xvYmFsKCk7XG4gIGFzdCA9IGdyYW0ucGFyc2UoaW5wdXQgKyBcIlxcblwiKTtcbiAgaWYoIWFzdC5jb21wbGV0ZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihhc3QuaGludCk7XG4gIH1cbiAgXG4gIG9iaiA9IHthc3Q6IGFzdCwgY29kZTogZ2VuZXJhdGVDb2RlKGFzdCksIG5zOiBjdXJyZW50TnMoKX07XG4gIHJldHVybiBvYmo7XG59XG5cblxuZ3JhbSA9IGVwZWdqcy5jb21waWxlR3JhbW1hcihncmFtbWFyRGVmLCB0b2tlbkRlZik7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBncmFtbWFyOiBncmFtLFxuICBzdHJHcmFtbWFyOiBzdHJHcmFtLFxuICBncmFtbWFyRGVmOiBncmFtbWFyRGVmLFxuICBlcGVnanM6IGVwZWdqcyxcbiAgdG9rZW5EZWY6IHRva2VuRGVmLFxuICBnZW5lcmF0ZU1vZHVsZTogZ2VuZXJhdGVNb2R1bGUsXG4gIGdlbmVyYXRlQ29kZTogZ2VuZXJhdGVDb2RlLFxuICBnZW5lcmF0ZUV4cG9ydHM6IGdlbmVyYXRlRXhwb3J0c1xufTtcblxuXG4iXX0=
