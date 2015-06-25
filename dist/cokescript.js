!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.cokescript=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var epegjs, depth, forLoopCount, unpacking, namespaces, levelStack, tokenDef, strInterpolationTokenDef, strInterpolationGrammarDef, strGram, grammarDef, nc, backend, gram;
// CokeScript language by Batiste Bieler 2015
// Implemented using EPEG.JS

epegjs = require("epegjs");

depth = 0;
forLoopCount = 1;
unpacking = 0;
namespaces = [{}];
levelStack = [0];

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
    var name;
    name = CN();
    return name + '.push(String(' + generateCode(node.children[1]) + '))';
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
      unpack_name = '__unpack' + unpacking + '';
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
    keyIndexName = "_index" + forLoopCount;
    keyArrayName = "_keys" + forLoopCount;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb2tlc2NyaXB0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUQ1N0JBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBlcGVnanMsIGRlcHRoLCBmb3JMb29wQ291bnQsIHVucGFja2luZywgbmFtZXNwYWNlcywgbGV2ZWxTdGFjaywgdG9rZW5EZWYsIHN0ckludGVycG9sYXRpb25Ub2tlbkRlZiwgc3RySW50ZXJwb2xhdGlvbkdyYW1tYXJEZWYsIHN0ckdyYW0sIGdyYW1tYXJEZWYsIG5jLCBiYWNrZW5kLCBncmFtO1xuLy8gQ29rZVNjcmlwdCBsYW5ndWFnZSBieSBCYXRpc3RlIEJpZWxlciAyMDE1XG4vLyBJbXBsZW1lbnRlZCB1c2luZyBFUEVHLkpTXG5cbmVwZWdqcyA9IHJlcXVpcmUoXCJlcGVnanNcIik7XG5cbmRlcHRoID0gMDtcbmZvckxvb3BDb3VudCA9IDE7XG51bnBhY2tpbmcgPSAwO1xubmFtZXNwYWNlcyA9IFt7fV07XG5sZXZlbFN0YWNrID0gWzBdO1xuXG5mdW5jdGlvbiBjdXJyZW50TnMoKSB7XG4gIHJldHVybiBuYW1lc3BhY2VzW25hbWVzcGFjZXMubGVuZ3RoIC0gMV07XG59XG5cbmZ1bmN0aW9uIGN1cnJlbnROc0hhcyhwKSB7XG4gIHJldHVybiBuYW1lc3BhY2VzW25hbWVzcGFjZXMubGVuZ3RoIC0gMV0uaGFzT3duUHJvcGVydHkocCk7XG59XG5cbmZ1bmN0aW9uIG5ld05zKCkge1xuICBuYW1lc3BhY2VzLnB1c2goe30pO1xuICByZXR1cm4gbmFtZXNwYWNlc1tuYW1lc3BhY2VzLmxlbmd0aCAtIDFdO1xufVxuXG5mdW5jdGlvbiByZXNldEdsb2JhbCgpIHtcbiAgbmFtZXNwYWNlcyA9IFt7fV07XG4gIGZvckxvb3BDb3VudCA9IDE7XG4gIGxldmVsU3RhY2sgPSBbMF07XG4gIGRlcHRoID0gMDtcbiAgdW5wYWNraW5nID0gMDtcbn1cblxuLy8gdG9rZW4gYXJlIG1hdGNoZWQgaW4gb3JkZXIgb2YgZGVjbGFyYXRpb247XG4vLyBUT0RPOiBhZGQgZnVuY3Rpb25zXG5cbnRva2VuRGVmID0gW1xuICB7a2V5OiBcInN0cmluZ1wiLCBmdW5jOiBzdHJpbmdEZWZ9LFxuICB7a2V5OiBcImNvbW1lbnRcIiwgZnVuYzogY29tbWVudERlZn0sXG4gIHtrZXk6IFwiZnVuY3Rpb25fZGVmXCIsIGZ1bmM6IGRlZkRlZiwgdmVyYm9zZTogXCJkZWYgZGVmaW5pdGlvblwifSxcbiAge2tleTogXCJjbGFzc1wiLCByZWc6IC9eY2xhc3MgL30sXG4gIHtrZXk6IFwicmV0XCIsIHJlZzogL15yZXR1cm4vLCB2ZXJib3NlOiBcInJldHVyblwifSxcbiAge2tleTogXCJpZlwiLCByZWc6IC9eaWYgL30sXG4gIHtrZXk6IFwid2hpbGVcIiwgcmVnOiAvXndoaWxlIC99LFxuICB7a2V5OiBcInRyeVwiLCByZWc6IC9edHJ5L30sXG4gIHtrZXk6IFwiY2F0Y2hcIiwgcmVnOiAvXmNhdGNoL30sXG4gIHtrZXk6IFwidGhyb3dcIiwgcmVnOiAvXnRocm93IC99LFxuICB7a2V5OiBcInBhenpcIiwgcmVnOiAvXnBhc3MvfSxcbiAge2tleTogXCJuZXdcIiwgcmVnOiAvXm5ldyAvfSxcbiAge2tleTogXCJ0YWdcIiwgcmVnOiAvXjxbYS16QS1aXVswLTlhLXpBLVpdezAsMjl9L30sXG4gIHtrZXk6IFwiPlwiLCByZWc6IC9ePi99LFxuICB7a2V5OiBcImVsc2VpZlwiLCByZWc6IC9eZWxzZWlmIC99LFxuICB7a2V5OiBcImVsc2VcIiwgcmVnOiAvXmVsc2UvfSxcbiAge2tleTogXCJmb3JfbG9vcFwiLCByZWc6IC9eZm9yIC8sIHZlcmJvc2U6IFwiZm9yIGxvb3BcIn0sXG4gIHtrZXk6IFwiaW5cIiwgcmVnOiAvXmluIC99LFxuICB7a2V5OiBcIm5vdFwiLCByZWc6IC9ebm90IC8sIHZlcmJvc2U6IFwibm90XCJ9LFxuICB7a2V5OiBcIm5hbWVcIiwgcmVnOiAvXlthLXpBLVpfJF1bMC05YS16QS1aXyRdezAsMjl9L30sXG4gIHtrZXk6IFwicmVnZXhwXCIsIGZ1bmM6IHJlZ0V4cERlZiwgdmVyYm9zZTogXCJyZWd1bGFyIGVwcmVzc2lvblwifSxcbiAge2tleTogXCJtYXRoX29wZXJhdG9yc1wiLCByZWc6IC9eKFxcK1xcK3xcXC1cXC0pLywgdmVyYm9zZTogXCJtYXRoIG9wZXJhdG9yXCJ9LFxuICB7a2V5OiBcImJpbmFyeV9vcGVyYXRvcnNcIiwgcmVnOiAvXihcXCZcXCZ8XFx8XFx8fFxcJnxcXHx8PDx8XFw+XFw+KS8sIHZlcmJvc2U6IFwiYmluYXJ5IG9wZXJhdG9yXCJ9LFxuICB7a2V5OiBcImNvbXBhcmlzb25cIiwgcmVnOiAvXig8PXw+PXw8fD58IT18PT0pL30sXG4gIHtrZXk6IFwiYXNzaWduXCIsIHJlZzogL14oXFwrPXwtPXw9fDo9KS99LFxuICB7a2V5OiBcIm51bWJlclwiLCByZWc6IC9eWy1dP1swLTldK1xcLj9bMC05XSovfSxcbiAge2tleTogXCJjb21tYVwiLCByZWc6IC9eXFwsL30sXG4gIHtrZXk6IFwiZG90XCIsIHJlZzogL15cXC4vfSxcbiAge2tleTogXCJjb2xvblwiLCByZWc6IC9eXFw6LywgdmVyYm9zZTogXCI6XCJ9LFxuICB7a2V5OiBcIm9wZW5fcGFyXCIsIHJlZzogL15cXCgvLCB2ZXJib3NlOiBcIihcIn0sXG4gIHtrZXk6IFwiY2xvc2VfcGFyXCIsIHJlZzogL15cXCkvLCB2ZXJib3NlOiBcIilcIn0sXG4gIHtrZXk6IFwib3Blbl9icmFcIiwgcmVnOiAvXlxcWy8sIHZlcmJvc2U6IFwiW1wifSxcbiAge2tleTogXCJjbG9zZV9icmFcIiwgcmVnOiAvXlxcXS8sIHZlcmJvc2U6IFwiXVwifSxcbiAge2tleTogXCJvcGVuX2N1cmx5XCIsIHJlZzogL15cXHsvLCB2ZXJib3NlOiBcIntcIn0sXG4gIHtrZXk6IFwiY2xvc2VfY3VybHlcIiwgcmVnOiAvXlxcfS8sIHZlcmJvc2U6IFwifVwifSxcbiAge2tleTogXCJtYXRoXCIsIHJlZzogL15bLXxcXCt8XFwqfFxcL3wlXS99LFxuICB7a2V5OiBcInNhbWVkZW50XCIsIGZ1bmM6IGRlbnQoXCJzYW1lZGVudFwiKSwgdmVyYm9zZTogXCJzYW1lIGluZGVudGF0aW9uXCJ9LFxuICB7a2V5OiBcImRlZGVudFwiLCBmdW5jOiBkZW50KFwiZGVkZW50XCIpfSxcbiAge2tleTogXCJpbmRlbnRcIiwgZnVuYzogZGVudChcImluZGVudFwiKX0sXG4gIHtrZXk6IFwiV1wiLCByZWc6IC9eWyBdLywgdmVyYm9zZTogXCJzaW5nbGUgd2hpdGVzcGFjZVwifVxuXTtcblxuZnVuY3Rpb24gc3RhcnRTdHIoaW5wdXQsc3RyZWFtKSB7XG4gIHZhciBsYXN0O1xuICBsYXN0ID0gc3RyZWFtW3N0cmVhbS5sZW5ndGggLSAxXTtcbiAgaWYobGFzdCAmJiBsYXN0LnZhbHVlID09PSBcIlxcXFxcIikge1xuICAgIHJldHVybjtcbiAgfVxuICBpZihpbnB1dC5tYXRjaCgvXiN7LykpIHtcbiAgICByZXR1cm4gXCIje1wiO1xuICB9XG59XG5cbnN0ckludGVycG9sYXRpb25Ub2tlbkRlZiA9IFtcbiAge2tleTogXCJzdGFydFwiLCBmdW5jOiBzdGFydFN0cn0sXG4gIHtrZXk6IFwiZW5kXCIsIHJlZzogL159L30sXG4gIHtrZXk6IFwibmFtZVwiLCByZWc6IC9eW2EtekEtWl8kXVswLTlhLXpBLVpfXXswLDI5fS99LFxuICB7a2V5OiBcImRvdFwiLCByZWc6IC9eXFwuL30sXG4gIHtrZXk6IFwiY2hhclwiLCByZWc6IC9eLi99XG5dO1xuXG5zdHJJbnRlcnBvbGF0aW9uR3JhbW1hckRlZiA9IHtcbiAgU1RBUlQ6IHtydWxlczogW1wiRUwqIEVPRlwiXX0sXG4gIEVMOiB7cnVsZXM6IFtcIlZBUlwiLCBcImNoYXJcIiwgXCJuYW1lXCIsIFwic3RhcnRcIiwgXCJlbmRcIiwgXCJkb3RcIl19LFxuICBWQVI6IHtydWxlczogW1wic3RhcnQgTkFNRSBlbmRcIl19LFxuICBOQU1FOiB7cnVsZXM6IFtcIm5hbWUgZG90IE5BTUVcIiwgXCJuYW1lXCJdfVxufTtcblxuc3RyR3JhbSA9IGVwZWdqcy5jb21waWxlR3JhbW1hcihzdHJJbnRlcnBvbGF0aW9uR3JhbW1hckRlZiwgc3RySW50ZXJwb2xhdGlvblRva2VuRGVmKTtcblxuZnVuY3Rpb24gZ2VuZXJhdGVTdHJpbmdDb2RlKG5vZGUsYykge1xuICB2YXIgc3RyO1xuICBpZihub2RlLnR5cGUgPT09ICdWQVInKSB7XG4gICAgcmV0dXJuIGMgKyAnICsgJyArIGdlbmVyYXRlU3RyaW5nQ29kZShub2RlLmNoaWxkcmVuWzFdLCBjKSArICcgKyAnICsgYztcbiAgfVxuICBcbiAgaWYobm9kZS52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG5vZGUudmFsdWU7XG4gIH1cbiAgXG4gIHN0ciA9ICcnO1xuICBpZighbm9kZS5jaGlsZHJlbikge1xuICAgIHJldHVybiAnJztcbiAgfVxuICBcbiAgdmFyIF9rZXlzMSA9IE9iamVjdC5rZXlzKG5vZGUuY2hpbGRyZW4pO1xuICBmb3IodmFyIF9pbmRleDEgPSAwOyBfaW5kZXgxIDwgX2tleXMxLmxlbmd0aDsgX2luZGV4MSsrKSB7XG4gICAgdmFyIGNoaWxkID0gbm9kZS5jaGlsZHJlbltfa2V5czFbX2luZGV4MV1dO1xuICAgIHN0ciArPSBnZW5lcmF0ZVN0cmluZ0NvZGUoY2hpbGQsIGMpO1xuICB9XG4gIHJldHVybiBzdHI7XG59XG5cbmZ1bmN0aW9uIGN1cnJlbnRMZXZlbCgpIHtcbiAgcmV0dXJuIGxldmVsU3RhY2tbbGV2ZWxTdGFjay5sZW5ndGggLSAxXTtcbn1cblxuZnVuY3Rpb24gaW5kZW50VHlwZShsKSB7XG4gIGlmKGwgPiBjdXJyZW50TGV2ZWwoKSkge1xuICAgIHJldHVybiAnaW5kZW50JztcbiAgfVxuICBcbiAgaWYobCA8IGN1cnJlbnRMZXZlbCgpKSB7XG4gICAgcmV0dXJuICdkZWRlbnQnO1xuICB9XG4gIFxuICBpZihsID09PSBjdXJyZW50TGV2ZWwoKSkge1xuICAgIHJldHVybiAnc2FtZWRlbnQnO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRlbnQoZGVudFR5cGUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIF9kZW50KGlucHV0KSB7XG4gICAgdmFyIG0sIGxpbmVzLCBpbmRlbnQ7XG4gICAgLy8gZW1wdHkgbGluZSBpcyBhIHNhbWVkZW50XG4gICAgbSA9IGlucHV0Lm1hdGNoKC9eXFxuW1xcc10qLyk7XG4gICAgaWYobSkge1xuICAgICAgbGluZXMgPSBtWzBdLnNwbGl0KFwiXFxuXCIpO1xuICAgICAgaW5kZW50ID0gbGluZXNbbGluZXMubGVuZ3RoIC0gMV0ubGVuZ3RoO1xuICAgICAgaWYoaW5kZW50VHlwZShpbmRlbnQpID09PSBkZW50VHlwZSkge1xuICAgICAgICBpZihkZW50VHlwZSA9PT0gJ2RlZGVudCcpIHtcbiAgICAgICAgICBsZXZlbFN0YWNrLnBvcCgpO1xuICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYoZGVudFR5cGUgPT09ICdpbmRlbnQnKSB7XG4gICAgICAgICAgbGV2ZWxTdGFjay5wdXNoKGluZGVudCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiBtWzBdO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gc3RyaW5nRGVmKGlucHV0KSB7XG4gIHZhciBmaXJzdCwgaSwgY2g7XG4gIGZpcnN0ID0gaW5wdXQuY2hhckF0KDApO1xuICBpZihmaXJzdCA9PT0gJ1wiJyB8fCBmaXJzdCA9PT0gXCInXCIpIHtcbiAgICBpID0gMTtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpe1xuICAgICAgY2ggPSBpbnB1dC5jaGFyQXQoaSk7XG4gICAgICBpZihjaCA9PT0gJ1xcXFwnKSB7XG4gICAgICAgIGkrKztcbiAgICAgIH0gZWxzZSBpZihjaCA9PT0gZmlyc3QpIHtcbiAgICAgICAgcmV0dXJuIGlucHV0LnNsaWNlKDAsIGkgKyAxKTtcbiAgICAgIH1cbiAgICAgIGkrKztcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVnRXhwRGVmKGlucHV0KSB7XG4gIHZhciBpLCBjaDtcbiAgaWYoaW5wdXQuY2hhckF0KDApID09PSAnLycpIHtcbiAgICBpID0gMTtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpe1xuICAgICAgY2ggPSBpbnB1dC5jaGFyQXQoaSk7XG4gICAgICBpZihjaCA9PT0gJ1xcXFwnKSB7XG4gICAgICAgIGkrKztcbiAgICAgIH0gZWxzZSBpZihjaCA9PT0gJy8nKSB7XG4gICAgICAgIGkrKztcbiAgICAgICAgLy8gbW9kaWZpZXJzXG4gICAgICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSAmJiBcImlnbVwiLmluZGV4T2YoaW5wdXQuY2hhckF0KGkpKSAhPT0gLTEpe1xuICAgICAgICAgIGkrKztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGRlZkRlZihpbnB1dCkge1xuICBpZihpbnB1dC5tYXRjaCgvXmRlZltcXCh8IHxcXG5dLykpIHtcbiAgICByZXR1cm4gXCJkZWZcIjtcbiAgfVxuICBcbiAgaWYoaW5wdXQuaW5kZXhPZihcImRvbSBcIikgPT09IDApIHtcbiAgICByZXR1cm4gXCJkb21cIjtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb21tZW50RGVmKGlucHV0KSB7XG4gIHZhciBtLCBpLCBjaDtcbiAgbSA9IGlucHV0Lm1hdGNoKC9eIy8pO1xuICBpZihtKSB7XG4gICAgaSA9IG1bMF0ubGVuZ3RoO1xuICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSl7XG4gICAgICBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxuJykge1xuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHJlZmxlY3QocGFyYW1zKSB7IHJldHVybiBwYXJhbXM7IH1cblxuZ3JhbW1hckRlZiA9IHtcbiAgU1RBUlQ6IHtydWxlczogW1wiTElORSogRU9GXCJdfSxcbiAgRUxDOiB7cnVsZXM6IFtcIlcqIGNvbW1lbnRcIl0sIHZlcmJvc2U6IFwiY29tbWVudFwifSxcbiAgTElORToge3J1bGVzOiBbXCJTVEFURU1FTlQgRUxDPyBzYW1lZGVudCtcIiwgXCJTVEFURU1FTlQgRUxDPyAhZGVkZW50XCIsIFxuICAgIFwiRUxDPyBzYW1lZGVudFwiLCBcIkVMQyAhZGVkZW50XCJdLCB2ZXJib3NlOiBcIm5ldyBsaW5lXCJ9LFxuICBCTE9DSzoge3J1bGVzOiBbXCJpbmRlbnQgcGF6eiBkZWRlbnRcIiwgXCJpbmRlbnQgTElORSsgZGVkZW50XCJdfSxcbiAgU1RBVEVNRU5UOiB7cnVsZXM6IFtcIkFTU0lHTlwiLCBcIkVYUFJcIiwgXCJJRlwiLCBcIldISUxFXCIsIFwiRk9SXCIsIFwiUkVUVVJOXCIsIFxuICAgIFwiQ0xBU1NcIiwgXCJUQUdcIiwgXCJET01fQVNTSUdOXCIsIFwiVFJZX0NBVENIXCIsIFwiVEhST1dcIl19LFxuICBDTEFTU19NRVRIT0RTOiB7XG4gICAgcnVsZXM6IFtcInNhbWVkZW50KiBmOkZVTkNfREVGIHNhbWVkZW50KlwiXSxcbiAgICBob29rczogW2Z1bmN0aW9uIChwKSB7IHJldHVybiBwLmY7IH1dXG4gIH0sXG4gIENMQVNTOiB7XG4gICAgcnVsZXM6IFtcbiAgICAgIFwiY2xhc3MgbjpuYW1lIG9wZW5fcGFyIHA6bmFtZSBjbG9zZV9wYXIgaW5kZW50IG06Q0xBU1NfTUVUSE9EUysgZGVkZW50XCIsXG4gICAgICBcImNsYXNzIG46bmFtZSBpbmRlbnQgbTpDTEFTU19NRVRIT0RTKyBkZWRlbnRcIlxuICAgIF0sXG4gICAgaG9va3M6IFtcbiAgICAgIGZ1bmN0aW9uIChwKSB7IHJldHVybiB7bmFtZTogcC5uLCBtZXRob2RzOiBwLm0sIHBhcmVudDogcC5wfTsgfSxcbiAgICAgIGZ1bmN0aW9uIChwKSB7IHJldHVybiB7bmFtZTogcC5uLCBtZXRob2RzOiBwLm19OyB9XG4gICAgXVxuICB9LFxuICBGVU5DX0RFRl9QQVJBTVM6IHtydWxlczogW1xuICAgIFwicDE6RlVOQ19ERUZfUEFSQU1TIGNvbW1hIFcgcDI6RlVOQ19ERUZfUEFSQU1TXCIsXG4gICAgXCJwMTpuYW1lIGFzc2lnbiBlOkVYUFJcIixcbiAgICBcInAxOm5hbWVcIlxuICAgIF0sXG4gICAgdmVyYm9zZTogXCJkZWYgcGFyYW1ldGVyc1wiXG4gIH0sXG4gIExBTUJEQToge3J1bGVzOiBbXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIFcgYmxvY2s6RVhQUlwiLFxuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBvcGVuX3BhciBwYXJhbXM6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgVyBibG9jazpFWFBSXCIsXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgVyBibG9jazpFWFBSXCJcbiAgICBdLFxuICAgIGhvb2tzOiBbcmVmbGVjdCwgcmVmbGVjdCwgcmVmbGVjdF1cbiAgfSxcbiAgRlVOQ19ERUY6IHtydWxlczogW1xuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIG9wZW5fcGFyIHBhcmFtczpGVU5DX0RFRl9QQVJBTVM/IGNsb3NlX3BhciBibG9jazpCTE9DS1wiLFxuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBvcGVuX3BhciBwYXJhbXM6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgYmxvY2s6QkxPQ0tcIixcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGZuOm5hbWUgYmxvY2s6QkxPQ0tcIixcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBibG9jazpCTE9DS1wiXG4gICAgXSxcbiAgICBob29rczogW3JlZmxlY3QsIHJlZmxlY3QsIHJlZmxlY3QsIHJlZmxlY3RdLFxuICAgIHZlcmJvc2U6IFwiZGVmIGRlZmluaXRpb25cIlxuICB9LFxuICBFTFNFX0lGOiB7cnVsZXM6IFtcInNhbWVkZW50IGVsc2VpZiBlOkVYUFIgYjpCTE9DS1wiXSwgaG9va3M6IFtyZWZsZWN0XX0sXG4gIEVMU0U6IHtydWxlczogW1wic2FtZWRlbnQgZWxzZSBiOkJMT0NLXCJdLCBob29rczogW3JlZmxlY3RdfSxcbiAgSUY6IHtydWxlczogW1wiaWYgZTpFWFBSIGI6QkxPQ0sgZWxpZjpFTFNFX0lGKiBlbDpFTFNFP1wiXSwgaG9va3M6IFtyZWZsZWN0XX0sXG4gIEVMU0VfRVhQUjoge3J1bGVzOiBbXCJXIGVsc2UgVyBiOkVYUFJcIl0sIGhvb2tzOiBbcmVmbGVjdF19LFxuICBJRl9FWFBSOiB7cnVsZXM6IFtcImU6RVhQUiBXIGlmIHRlc3Q6RVhQUiBlbDpFTFNFX0VYUFI/XCJdLCBob29rczogW3JlZmxlY3RdfSxcbiAgV0hJTEU6IHtydWxlczogW1wid2hpbGUgZTpFWFBSIGI6QkxPQ0tcIl0sIGhvb2tzOiBbcmVmbGVjdF19LFxuICBNQVRIOiB7cnVsZXM6IFtcImUxOkVYUFIgVyBvcDptYXRoIFcgZTI6RVhQUlwiXX0sXG4gIFBBVEg6IHtydWxlczogW1wiUEFUSCBkb3QgbmFtZVwiLCBcIlBBVEggb3Blbl9icmEgbnVtYmVyIGNsb3NlX2JyYVwiLCBcIm5hbWVcIl19LFxuICBBU1NJR046IHtydWxlczogW1xuICAgIFwibGVmdDpFWFBSIFcgb3A6YXNzaWduIFcgcmlnaHQ6RVhQUlwiLFxuICAgIFwibGVmdDpTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFIgVyBvcDphc3NpZ24gVyByaWdodDpTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFJcIixcbiAgICBcImxlZnQ6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSIFcgb3A6YXNzaWduIFcgcmlnaHQ6RVhQUlwiXG4gIF0sIGhvb2tzOiBbcmVmbGVjdCwgcmVmbGVjdCwgcmVmbGVjdF19LFxuICBXX09SX1NBTUVERU5UOiB7cnVsZXM6IFtcIldcIiwgXCJzYW1lZGVudFwiXSwgdmVyYm9zZTogXCJzYW1lZGVudCBvciB3aGl0ZXNwYWNlXCJ9LFxuICBXX1NBTUVERU5UX0lOREVOVDoge3J1bGVzOiBbXCJXXCIsIFwic2FtZWRlbnRcIiwgXCJpbmRlbnRcIl0sIHZlcmJvc2U6IFwiaW5kZW50IG9yIHNhbWVkZW50IG9yIHdoaXRlc3BhY2VcIn0sXG4gIEFOWV9TUEFDRToge3J1bGVzOiBbXCJXXCIsIFwic2FtZWRlbnRcIiwgXCJpbmRlbnRcIiwgXCJkZWRlbnRcIiwgXCJjb21tZW50XCJdLCB2ZXJib3NlOiBcImFueSBzcGFjZVwifSxcbiAgRlVOQ19DQUxMX1BBUkFNUzoge3J1bGVzOiBbXCJFWFBSIGNvbW1hIEFOWV9TUEFDRSsgRlVOQ19DQUxMX1BBUkFNUyBBTllfU1BBQ0UqXCIsIFwiRVhQUiBBTllfU1BBQ0UqXCJdfSxcbiAgRlVOQ19DQUxMOiB7cnVsZXM6IFtcbiAgICBcIm9wZW5fcGFyIEZVTkNfQ0FMTF9QQVJBTVM/IGNsb3NlX3BhclwiXG4gIF19LFxuICBcbiAgVFlQRToge3J1bGVzOiBbXCJuYW1lIGNvbG9uXCJdfSxcbiAgXG4gIEZPUjoge3J1bGVzOiBbXG4gICAgXCJmb3JfbG9vcCBrOm5hbWUgY29tbWEgVyB2Om5hbWUgVyBpbiBhOkVYUFIgYjpCTE9DS1wiLFxuICAgIFwiZm9yX2xvb3AgdjpuYW1lIFcgaW4gYTpFWFBSIGI6QkxPQ0tcIl0sXG4gICAgaG9va3M6IFtyZWZsZWN0LCByZWZsZWN0XVxuICB9LFxuICBcbiAgU1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSOiB7cnVsZXM6IFtcbiAgICBcImUxOkVYUFIgY29tbWEgVyBlMjpTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFJcIixcbiAgICBcImUxOkVYUFIgY29tbWEgVyBlMjpFWFBSXCJcbiAgXSxcbiAgaG9va3M6IFtcbiAgICBmdW5jdGlvbiAocCkgeyByZXR1cm4gW3AuZTFdLmNvbmNhdChwLmUyLmNoaWxkcmVuKTsgfSwgZnVuY3Rpb24gKHApIHsgcmV0dXJuIFtwLmUxLCBwLmUyXTsgfVxuICBdIFxuICB9LFxuICBcbiAgQ09NTUFfU0VQQVJBVEVEX0VYUFI6IHtydWxlczogW1xuICAgIFwiRVhQUiBjb21tYSBBTllfU1BBQ0UrIENPTU1BX1NFUEFSQVRFRF9FWFBSIEFOWV9TUEFDRSpcIixcbiAgICBcIkVYUFIgQU5ZX1NQQUNFKlwiXG4gIF19LFxuICBcbiAgQVJSQVk6IHtydWxlczogW1xuICAgIFwib3Blbl9icmEgQU5ZX1NQQUNFKiBjOkNPTU1BX1NFUEFSQVRFRF9FWFBSPyBBTllfU1BBQ0UqIGNsb3NlX2JyYVwiXG4gIF19LFxuICBcbiAgTUVNQkVSUzoge3J1bGVzOiBbXG4gICAgXCJuYW1lIGNvbG9uIFcgRVhQUiBzYW1lZGVudD8gY29tbWEgQU5ZX1NQQUNFKyBNRU1CRVJTIEFOWV9TUEFDRSpcIixcbiAgICBcIm5hbWUgY29sb24gVyBFWFBSIEFOWV9TUEFDRSpcIlxuICBdfSxcbiAgXG4gIE9CSkVDVDoge3J1bGVzOiBbXG4gICAgXCJvcGVuX2N1cmx5IGluZGVudD8gTUVNQkVSUz8gY2xvc2VfY3VybHlcIlxuICBdfSxcbiAgXG4gIFRBR19QQVJBTVM6IHtydWxlczogW1xuICAgIFwibGVmdDpUQUdfUEFSQU1TIFcgcmlnaHQ6VEFHX1BBUkFNU1wiLFxuICAgIFwibjpuYW1lIGFzc2lnbiBlOkVYUFJcIixcbiAgICBcIm46bmFtZVwiXG4gICAgXSxcbiAgICBob29rczogW3JlZmxlY3QsIHJlZmxlY3QsIHJlZmxlY3RdLFxuICAgIHZlcmJvc2U6IFwidGFnIHBhcmFtZXRlcnNcIlxuICB9LFxuICBcbiAgVEFHOiB7cnVsZXM6IFtcbiAgICBcInRhZzp0YWcgVz8gcGFyYW1zOlRBR19QQVJBTVM/IGVuZDo+PyBibG9jazpCTE9DSz9cIlxuICBdLFxuICBob29rczogW3JlZmxlY3RdXG4gIH0sXG4gIFxuICBET01fQVNTSUdOOiB7cnVsZXM6IFtcbiAgICBcImFzc2lnbiBFWFBSXCJcbiAgXX0sXG4gIFxuICBUUllfQ0FUQ0g6IHtydWxlczogW1xuICAgIFwidHJ5IGIxOkJMT0NLIHNhbWVkZW50PyBjYXRjaCBvcGVuX3BhciBlcnI6bmFtZT8gY2xvc2VfcGFyIGIyOkJMT0NLXCJcbiAgICBdLFxuICAgIGhvb2tzOiBbcmVmbGVjdF1cbiAgfSxcbiAgXG4gIFRIUk9XOiB7cnVsZXM6IFtcbiAgICBcInRocm93IEVYUFJcIlxuICBdfSxcbiAgXG4gIFJFVFVSTjoge3J1bGVzOiBbXCJyZXQgVyBTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFJcIiwgXCJyZXQgVyBFWFBSXCIsIFwicmV0XCJdfSxcbiAgUklHSFRfRVhQUjoge3J1bGVzOiBbXG4gICAgXCJtYXRoX29wZXJhdG9yc1wiLFxuICAgIFwiVyBiaW5hcnlfb3BlcmF0b3JzIFcgRVhQUlwiLFxuICAgIFwiVyBjb21wYXJpc29uIFcgRVhQUlwiLFxuICAgIFwiVyA+IFcgRVhQUlwiLFxuICAgIFwiZG90IEVYUFJcIixcbiAgICBcIm9wZW5fYnJhIEVYUFIgY2xvc2VfYnJhXCIsXG4gICAgXCJGVU5DX0NBTExcIlxuICAgIF0sXG4gICAgdmVyYm9zZTogXCJleHByZXNzaW9uXCJcbiAgfSxcbiAgXG4gIEVYUFI6IHtydWxlczogW1xuICAgIFwiSUZfRVhQUlwiLFxuICAgIFwiTUFUSFwiLFxuICAgIFwiT0JKRUNUXCIsXG4gICAgXCJGVU5DX0RFRlwiLFxuICAgIFwiRVhQUiBSSUdIVF9FWFBSXCIsXG4gICAgXCJuYW1lXCIsXG4gICAgXCJudW1iZXJcIixcbiAgICBcIkxBTUJEQVwiLFxuICAgIFwic3RyaW5nXCIsXG4gICAgXCJyZWdleHBcIixcbiAgICBcIm9wZW5fcGFyIEVYUFIgY2xvc2VfcGFyXCIsXG4gICAgXCJuZXcgRVhQUlwiLFxuICAgIFwibm90IEVYUFJcIixcbiAgICBcIkFSUkFZXCJcbiAgICBdLFxuICAgIHZlcmJvc2U6IFwiZXhwcmVzc2lvblwiXG4gIH1cbn07XG5cbmZ1bmN0aW9uIHNwYWNlcihuKSB7XG4gIHZhciBvdXQsIGk7XG4gIG91dCA9IFwiXCI7XG4gIGkgPSAwO1xuICB3aGlsZShpIDwgbil7XG4gICAgb3V0ICs9IFwiIFwiO1xuICAgIGkrKztcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiBzcChtb2QpIHtcbiAgaWYobW9kKSB7XG4gICAgcmV0dXJuIHNwYWNlcigyICogKGRlcHRoICsgbW9kKSk7XG4gIH1cbiAgcmV0dXJuIHNwYWNlcigyICogZGVwdGgpO1xufVxuXG5uYyA9IDE7XG4vLyBjaGlsZHJlbiBuYW1lXG5mdW5jdGlvbiBDTigpIHtcbiAgcmV0dXJuICdfX2MnICsgbmM7XG59XG5cbmZ1bmN0aW9uIHB1c2hDTigpIHtcbiAgbmMrKztcbiAgcmV0dXJuICdfX2MnICsgbmM7XG59XG5cbmZ1bmN0aW9uIHBvcENOKCkge1xuICBuYy0tO1xuICByZXR1cm4gJ19fYycgKyBuYztcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVIb2lzdGVkVmFyKCkge1xuICB2YXIgbnMsIGhvaXN0ZWQ7XG4gIG5zID0gY3VycmVudE5zKCk7XG4gIGhvaXN0ZWQgPSBbXTtcbiAgdmFyIF9rZXlzMiA9IE9iamVjdC5rZXlzKG5zKTtcbiAgZm9yKHZhciBfaW5kZXgyID0gMDsgX2luZGV4MiA8IF9rZXlzMi5sZW5ndGg7IF9pbmRleDIrKykge1xuICAgIHZhciBrZXkgPSBfa2V5czJbX2luZGV4Ml07XG4gICAgdmFyIHZhbHVlID0gbnNbX2tleXMyW19pbmRleDJdXTtcbiAgICBpZih2YWx1ZSA9PT0gJ2hvaXN0Jykge1xuICAgICAgaG9pc3RlZC5wdXNoKGtleSk7XG4gICAgfVxuICB9XG4gIGlmKGhvaXN0ZWQubGVuZ3RoKSB7XG4gICAgcmV0dXJuICd2YXIgJyArIGhvaXN0ZWQuam9pbignLCAnKSArICc7JztcbiAgfVxuICByZXR1cm4gJyc7XG59XG5cbmJhY2tlbmQgPSB7XG4gIFNUQVJUOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHIsIGhvaXN0ZWQ7XG4gICAgc3RyID0gJyc7XG4gICAgdmFyIF9rZXlzMyA9IE9iamVjdC5rZXlzKG5vZGUuY2hpbGRyZW4pO1xuICAgIGZvcih2YXIgX2luZGV4MyA9IDA7IF9pbmRleDMgPCBfa2V5czMubGVuZ3RoOyBfaW5kZXgzKyspIHtcbiAgICAgIHZhciBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX2tleXMzW19pbmRleDNdXTtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoY2hpbGQpO1xuICAgIH1cbiAgICBob2lzdGVkID0gZ2VuZXJhdGVIb2lzdGVkVmFyKCk7XG4gICAgaWYoaG9pc3RlZCkge1xuICAgICAgcmV0dXJuIGdlbmVyYXRlSG9pc3RlZFZhcigpICsgJ1xcbicgKyBzdHI7XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgLFxuICBkZWRlbnQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgZGVwdGggPSBNYXRoLm1heCgwLCBkZXB0aCAtIDEpO1xuICAgIHJldHVybiAnJztcbiAgfVxuICAsXG4gIGluZGVudDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICBkZXB0aCA9IGRlcHRoICsgMTtcbiAgICByZXR1cm4gJ1xcbicgKyBzcCgpO1xuICB9XG4gICxcbiAgc2FtZWRlbnQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIGwsIGksIHN0cjtcbiAgICBsID0gbm9kZS52YWx1ZS5zcGxpdCgnXFxuJykubGVuZ3RoIC0gMTtcbiAgICBpID0gMDtcbiAgICBzdHIgPSAnJztcbiAgICB3aGlsZShpIDwgbCl7XG4gICAgICBzdHIgKz0gJ1xcbicgKyBzcCgpO1xuICAgICAgaSsrO1xuICAgIH1cbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgRE9NX0FTU0lHTjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgbmFtZTtcbiAgICBuYW1lID0gQ04oKTtcbiAgICByZXR1cm4gbmFtZSArICcucHVzaChTdHJpbmcoJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzFdKSArICcpKSc7XG4gIH1cbiAgLFxuICBUQUdfUEFSQU1TOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ubGVmdCkge1xuICAgICAgcmV0dXJuIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmxlZnQpICsgJywgJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnJpZ2h0KTtcbiAgICB9XG4gICAgXG4gICAgaWYobm9kZS5jaGlsZHJlbi5lKSB7XG4gICAgICByZXR1cm4gbm9kZS5jaGlsZHJlbi5uLnZhbHVlICsgJzogJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbm9kZS5jaGlsZHJlbi5uLnZhbHVlICsgJzogdHJ1ZSc7XG4gICAgfVxuICB9XG4gICxcbiAgVEFHOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHIsIHBhcmFtcywgbmFtZSwgc3ViO1xuICAgIHN0ciA9ICcnO1xuICAgIHBhcmFtcyA9IFwie1wiO1xuICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuLnRhZy52YWx1ZS5zdWJzdHJpbmcoMSk7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5wYXJhbXMpIHtcbiAgICAgIHBhcmFtcyArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMpO1xuICAgIH1cbiAgICBcbiAgICBwYXJhbXMgKz0gJ30nO1xuICAgIHN1YiA9ICdbXSc7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgc3ViID0gcHVzaENOKCk7XG4gICAgICBzdHIgKz0gJ3ZhciAnICsgQ04oKSArICcgPSBbXTsnO1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrKTtcbiAgICAgIHBvcENOKCk7XG4gICAgfVxuICAgIFxuICAgIHN0ciArPSAnXFxuJyArIHNwKCkgKyBDTigpICsgJy5wdXNoKGgoXCInICsgbmFtZSArICdcIiwgJyArIHBhcmFtcyArICcsICcgKyBzdWIgKyAnKSknO1xuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgLFxuICBDTEFTUzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgbmFtZSwgZnVuY3MsIHBhcmVudCwgc3RyLCBjb25zdHJ1Y3RvciwgZnVuY19kZWYsIGZ1bmNfbmFtZSwgbnMsIHBhcmFtcywgYm9keSwgY29uc19zdHI7XG4gICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4ubmFtZS52YWx1ZTtcbiAgICBmdW5jcyA9IG5vZGUuY2hpbGRyZW4ubWV0aG9kcztcbiAgICBwYXJlbnQgPSBub2RlLmNoaWxkcmVuLnBhcmVudDtcbiAgICBzdHIgPSAnJztcbiAgICBjb25zdHJ1Y3RvciA9IG51bGw7XG4gICAgdmFyIF9rZXlzNCA9IE9iamVjdC5rZXlzKGZ1bmNzKTtcbiAgICBmb3IodmFyIF9pbmRleDQgPSAwOyBfaW5kZXg0IDwgX2tleXM0Lmxlbmd0aDsgX2luZGV4NCsrKSB7XG4gICAgICB2YXIgZnVuYyA9IGZ1bmNzW19rZXlzNFtfaW5kZXg0XV07XG4gICAgICBmdW5jX2RlZiA9IGZ1bmMuY2hpbGRyZW47XG4gICAgICBmdW5jX25hbWUgPSBmdW5jX2RlZi5jaGlsZHJlbi5mbi52YWx1ZTtcbiAgICAgIGlmKGZ1bmNfbmFtZSA9PT0gJ2NvbnN0cnVjdG9yJykge1xuICAgICAgICBjb25zdHJ1Y3RvciA9IGZ1bmNfZGVmO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyICs9ICdcXG4nICsgc3AoKSArIG5hbWUgKyAnLnByb3RvdHlwZS4nICsgZnVuY19uYW1lICsgJyA9ICcgKyBnZW5lcmF0ZUNvZGUoZnVuY19kZWYpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBucyA9IGN1cnJlbnROcygpO1xuICAgIG5zW25hbWVdID0gJ2hvaXN0JztcbiAgICBucyA9IG5ld05zKCk7XG4gICAgXG4gICAgcGFyYW1zID0gY29uc3RydWN0b3IgJiYgY29uc3RydWN0b3IuY2hpbGRyZW4ucGFyYW1zO1xuICAgIGlmKHBhcmFtcykge1xuICAgICAgcGFyYW1zID0gZ2VuZXJhdGVDb2RlKHBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcmFtcyA9ICcnO1xuICAgIH1cbiAgICBcbiAgICBib2R5ID0gY29uc3RydWN0b3IgJiYgY29uc3RydWN0b3IuY2hpbGRyZW4uYmxvY2s7XG4gICAgY29uc19zdHIgPSAnJyArIG5hbWUgKyAnID0gZnVuY3Rpb24gJyArIG5hbWUgKyAnKCcgKyBwYXJhbXMgKyAnKSB7JztcbiAgICBjb25zX3N0ciArPSAnXFxuJyArIHNwKDEpICsgJ2lmKCEodGhpcyBpbnN0YW5jZW9mICcgKyBuYW1lICsgJykpeyByZXR1cm4gbmV3ICcgKyBuYW1lICsgJygnICsgT2JqZWN0LmtleXMobnMpLmpvaW4oJywnKSArICcpfSc7XG4gICAgdmFyIF9rZXlzNSA9IE9iamVjdC5rZXlzKG5zKTtcbiAgICBmb3IodmFyIF9pbmRleDUgPSAwOyBfaW5kZXg1IDwgX2tleXM1Lmxlbmd0aDsgX2luZGV4NSsrKSB7XG4gICAgICB2YXIga2V5ID0gX2tleXM1W19pbmRleDVdO1xuICAgICAgdmFyIHZhbHVlID0gbnNbX2tleXM1W19pbmRleDVdXTtcbiAgICAgIGlmKHZhbHVlICE9PSB0cnVlICYmIHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc19zdHIgKz0gJ1xcbicgKyBzcCgxKSArICdpZignICsga2V5ICsgJyA9PT0gdW5kZWZpbmVkKSB7JyArIGtleSArICcgPSAnICsgZ2VuZXJhdGVDb2RlKHZhbHVlKSArICd9JztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYoYm9keSkge1xuICAgICAgY29uc19zdHIgKz0gZ2VuZXJhdGVDb2RlKGJvZHkpO1xuICAgIH1cbiAgICBjb25zX3N0ciArPSBzcCgpICsgJ1xcbn0nO1xuICAgIFxuICAgIGlmKHBhcmVudCkge1xuICAgICAgY29uc19zdHIgKz0gJ1xcbicgKyBzcCgpICsgJycgKyBuYW1lICsgJy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCcgKyBwYXJlbnQudmFsdWUgKyAnLnByb3RvdHlwZSknO1xuICAgICAgY29uc19zdHIgKz0gJ1xcbicgKyBzcCgpICsgJycgKyBuYW1lICsgJy5wcm90b3R5cGUuY29uc3RydWN0b3IgPSAnICsgbmFtZSArICcnO1xuICAgIH1cbiAgICBcbiAgICBuYW1lc3BhY2VzLnBvcCgpO1xuICAgIHJldHVybiBjb25zX3N0ciArIHN0cjtcbiAgfVxuICAsXG4gIExBTUJEQTogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgbmFtZSwgbnMsIHN0ciwgY29kZTtcbiAgICBuYW1lID0gXCJcIjtcbiAgICBucyA9IG5ld05zKCk7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5mbikge1xuICAgICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICBuc1tuYW1lXSA9IHRydWU7XG4gICAgfVxuICAgIFxuICAgIHN0ciA9IFwiZnVuY3Rpb24gXCIgKyBuYW1lICsgXCIoXCI7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5wYXJhbXMpIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMsIG5zKTtcbiAgICB9XG4gICAgXG4gICAgc3RyICs9ICcpIHsnO1xuICAgIHZhciBfa2V5czYgPSBPYmplY3Qua2V5cyhucyk7XG4gICAgZm9yKHZhciBfaW5kZXg2ID0gMDsgX2luZGV4NiA8IF9rZXlzNi5sZW5ndGg7IF9pbmRleDYrKykge1xuICAgICAgdmFyIGtleSA9IF9rZXlzNltfaW5kZXg2XTtcbiAgICAgIHZhciB2YWx1ZSA9IG5zW19rZXlzNltfaW5kZXg2XV07XG4gICAgICBpZih2YWx1ZSAhPT0gdHJ1ZSAmJiB2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvZGUgPSBnZW5lcmF0ZUNvZGUodmFsdWUpO1xuICAgICAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArICdpZignICsga2V5ICsgJyA9PT0gdW5kZWZpbmVkKSB7JyArIGtleSArICcgPSAnICsgY29kZSArICd9JztcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgc3RyICs9ICcgcmV0dXJuICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5ibG9jaywgbnMpO1xuICAgIH1cbiAgICBcbiAgICBuYW1lc3BhY2VzLnBvcCgpO1xuICAgIHJldHVybiBzdHIgKyBcIjsgfVwiO1xuICB9XG4gICxcbiAgRlVOQ19ERUY6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIG5hbWUsIG5zLCBpc19kb20sIHN0ciwgY29kZSwgYm9keSwgaG9pc3RlZDtcbiAgICBuYW1lID0gXCJcIjtcbiAgICBucyA9IGN1cnJlbnROcygpO1xuICAgIGlzX2RvbSA9IG5vZGUuY2hpbGRyZW4uZmQudmFsdWUgPT09ICdkb20nO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uZm4pIHtcbiAgICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuLmZuLnZhbHVlO1xuICAgICAgbnNbbmFtZV0gPSB0cnVlO1xuICAgIH1cbiAgICBcbiAgICBucyA9IG5ld05zKCk7XG4gICAgc3RyID0gXCJmdW5jdGlvbiBcIiArIG5hbWUgKyBcIihcIjtcbiAgICBpZihub2RlLmNoaWxkcmVuLnBhcmFtcykge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnBhcmFtcyk7XG4gICAgfVxuICAgIFxuICAgIHN0ciArPSAnKSB7JztcbiAgICB2YXIgX2tleXM3ID0gT2JqZWN0LmtleXMobnMpO1xuICAgIGZvcih2YXIgX2luZGV4NyA9IDA7IF9pbmRleDcgPCBfa2V5czcubGVuZ3RoOyBfaW5kZXg3KyspIHtcbiAgICAgIHZhciBrZXkgPSBfa2V5czdbX2luZGV4N107XG4gICAgICB2YXIgdmFsdWUgPSBuc1tfa2V5czdbX2luZGV4N11dO1xuICAgICAgaWYodmFsdWUgIT09IHRydWUgJiYgdmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb2RlID0gZ2VuZXJhdGVDb2RlKHZhbHVlKTtcbiAgICAgICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyAnaWYoJyArIGtleSArICcgPT09IHVuZGVmaW5lZCkgeycgKyBrZXkgKyAnID0gJyArIGNvZGUgKyAnO30nO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZihpc19kb20pIHtcbiAgICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgJ3ZhciAnICsgQ04oKSArICcgPSBbXTsnO1xuICAgIH1cbiAgICBcbiAgICBib2R5ID0gJyc7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgYm9keSA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrKTtcbiAgICB9XG4gICAgXG4gICAgXG4gICAgaG9pc3RlZCA9IGdlbmVyYXRlSG9pc3RlZFZhcigpO1xuICAgIGlmKGhvaXN0ZWQpIHtcbiAgICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgaG9pc3RlZDtcbiAgICB9XG4gICAgXG4gICAgc3RyICs9IGJvZHk7XG4gICAgXG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICBcbiAgICBpZihpc19kb20pIHtcbiAgICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgJ3JldHVybiAnICsgQ04oKSArICc7JztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHN0ciArICdcXG4nICsgc3AoKSArICd9JztcbiAgfVxuICAsXG4gIEZVTkNfREVGX1BBUkFNUzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyLCBucztcbiAgICBzdHIgPSBcIlwiO1xuICAgIG5zID0gY3VycmVudE5zKCk7XG4gICAgaWYobm9kZS5jaGlsZHJlblswXS50eXBlID09PSAnbmFtZScpIHtcbiAgICAgIG5zW25vZGUuY2hpbGRyZW5bMF0udmFsdWVdID0gdHJ1ZTtcbiAgICAgIGlmKG5vZGUuY2hpbGRyZW5bMV0gJiYgbm9kZS5jaGlsZHJlblsxXS50eXBlID09PSAnYXNzaWduJykge1xuICAgICAgICBuc1tub2RlLmNoaWxkcmVuWzBdLnZhbHVlXSA9IG5vZGUuY2hpbGRyZW5bMl07XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHZhciBfa2V5czggPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgICBmb3IodmFyIF9pbmRleDggPSAwOyBfaW5kZXg4IDwgX2tleXM4Lmxlbmd0aDsgX2luZGV4OCsrKSB7XG4gICAgICB2YXIgbiA9IG5vZGUuY2hpbGRyZW5bX2tleXM4W19pbmRleDhdXTtcbiAgICAgIGlmKG4udHlwZSA9PT0gJ25hbWUnIHx8IG4udHlwZSA9PT0gJ0ZVTkNfREVGX1BBUkFNUycgfHwgbi50eXBlID09PSAnY29tbWEnIHx8IG4udHlwZSA9PT0gJ3dpbmRvdycpIHtcbiAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShuKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuICAsXG4gIEFTU0lHTjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyLCBvcCwgZXhwbGljaXRfZ2xvYmFsLCBucywgbGVmdCwgcmlnaHRfY29kZSwgdW5wYWNrX25hbWUsIGksIG4sIGNoO1xuICAgIHN0ciA9IFwiXCI7XG4gICAgb3AgPSBub2RlLmNoaWxkcmVuLm9wLnZhbHVlO1xuICAgIGV4cGxpY2l0X2dsb2JhbCA9IG9wID09PSAnOj0nO1xuICAgIGlmKGV4cGxpY2l0X2dsb2JhbCkge1xuICAgICAgb3AgPSAnPSc7XG4gICAgfVxuICAgIFxuICAgIG5zID0gY3VycmVudE5zKCk7XG4gICAgbGVmdCA9IG5vZGUuY2hpbGRyZW4ubGVmdDtcbiAgICByaWdodF9jb2RlID0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucmlnaHQpO1xuICAgIGlmKGxlZnQudHlwZSA9PT0gJ1NUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUicpIHtcbiAgICAgIHVucGFja2luZysrO1xuICAgICAgdW5wYWNrX25hbWUgPSAnX191bnBhY2snICsgdW5wYWNraW5nICsgJyc7XG4gICAgICBzdHIgKz0gJ3ZhciAnICsgdW5wYWNrX25hbWUgKyAnID0gJyArIHJpZ2h0X2NvZGUgKyAnXFxuJyArIHNwKCk7XG4gICAgICBpID0gMDtcbiAgICAgIHZhciBfa2V5czkgPSBPYmplY3Qua2V5cyhsZWZ0LmNoaWxkcmVuKTtcbiAgICAgIGZvcih2YXIgX2luZGV4OSA9IDA7IF9pbmRleDkgPCBfa2V5czkubGVuZ3RoOyBfaW5kZXg5KyspIHtcbiAgICAgICAgdmFyIGNoaWxkID0gbGVmdC5jaGlsZHJlbltfa2V5czlbX2luZGV4OV1dO1xuICAgICAgICBuID0gY2hpbGQuY2hpbGRyZW5bMF07XG4gICAgICAgIGlmKG4udHlwZSA9PT0gJ25hbWUnKSB7XG4gICAgICAgICAgaWYoY3VycmVudE5zSGFzKG4udmFsdWUpID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIG5zW24udmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobikgKyAnICcgKyBvcCArICcgJyArIHVucGFja19uYW1lICsgJ1snICsgaSArICddO1xcbicgKyBzcCgpO1xuICAgICAgICBpKys7XG4gICAgICB9XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgICBpZihsZWZ0LmNoaWxkcmVuWzBdLnR5cGUgPT09ICduYW1lJykge1xuICAgICAgY2ggPSBsZWZ0LmNoaWxkcmVuWzBdO1xuICAgICAgaWYoIWN1cnJlbnROc0hhcyhjaC52YWx1ZSkpIHtcbiAgICAgICAgaWYoIWV4cGxpY2l0X2dsb2JhbCkge1xuICAgICAgICAgIG5zW2NoLnZhbHVlXSA9ICdob2lzdCc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmxlZnQpICsgJyAnICsgb3AgKyAnICcgKyByaWdodF9jb2RlO1xuICB9XG4gICxcbiAgU1RBVEVNRU5UOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHIsIGUsIHQsIG90aGVyO1xuICAgIHN0ciA9ICcnO1xuICAgIHZhciBfa2V5czEwID0gT2JqZWN0LmtleXMobm9kZS5jaGlsZHJlbik7XG4gICAgZm9yKHZhciBfaW5kZXgxMCA9IDA7IF9pbmRleDEwIDwgX2tleXMxMC5sZW5ndGg7IF9pbmRleDEwKyspIHtcbiAgICAgIHZhciBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX2tleXMxMFtfaW5kZXgxMF1dO1xuICAgICAgZSA9IGNoaWxkLmNoaWxkcmVuICYmIGNoaWxkLmNoaWxkcmVuWzBdO1xuICAgICAgLy8gVE9ETzogdGhpcyBzaG91bGQgYmUgcG9zc2libGVcbiAgICAgIHQgPSBjaGlsZC50eXBlO1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShjaGlsZCk7XG4gICAgICBvdGhlciA9IGUgJiYgKGUudHlwZSA9PT0gJ0ZVTkNfREVGJyB8fCBlLnR5cGUgPT09ICdMQU1CREEnKTtcbiAgICAgIGlmKHQgPT09ICdGT1InIHx8IHQgPT09ICdUUllfQ0FUQ0gnIHx8IHQgPT09ICdXSElMRScgfHwgdCA9PT0gJ0lGJyB8fCB0ID09PSAnU1RBVEVNRU5UJyB8fCB0ID09PSAnc2FtZWRlbnQnIHx8IG90aGVyKSB7XG4gICAgICAgIFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyICs9ICc7JztcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuICAsXG4gIElGOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHIsIGVsaWY7XG4gICAgc3RyID0gJyc7XG4gICAgc3RyID0gJ2lmKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcpIHsnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYikgKyAnXFxuJyArIHNwKCkgKyAnfSc7XG4gICAgZWxpZiA9IG5vZGUuY2hpbGRyZW4uZWxpZjtcbiAgICBpZihlbGlmKSB7XG4gICAgICBpZihBcnJheS5pc0FycmF5KGVsaWYpKSB7XG4gICAgICAgIHZhciBfa2V5czExID0gT2JqZWN0LmtleXMoZWxpZik7XG4gICAgICAgIGZvcih2YXIgX2luZGV4MTEgPSAwOyBfaW5kZXgxMSA8IF9rZXlzMTEubGVuZ3RoOyBfaW5kZXgxMSsrKSB7XG4gICAgICAgICAgdmFyIHZhbHVlID0gZWxpZltfa2V5czExW19pbmRleDExXV07XG4gICAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZSh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoZWxpZik7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmKG5vZGUuY2hpbGRyZW4uZWwpIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lbCk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgLFxuICBJRl9FWFBSOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHI7XG4gICAgc3RyID0gJyc7XG4gICAgc3RyID0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4udGVzdCkgKyAnID8gJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJyA6ICc7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5lbCkge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmVsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyICs9ICd1bmRlZmluZWQnO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgRUxTRV9FWFBSOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKTtcbiAgfVxuICAsXG4gIFdISUxFOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnd2hpbGUoJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJyl7JyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICB9XG4gICxcbiAgRk9SOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBrZXlJbmRleE5hbWUsIGtleUFycmF5TmFtZSwgYXJyYXlOYW1lLCB2YXJOYW1lLCBpbmRleE5hbWUsIHN0cjtcbiAgICBrZXlJbmRleE5hbWUgPSBcIl9pbmRleFwiICsgZm9yTG9vcENvdW50O1xuICAgIGtleUFycmF5TmFtZSA9IFwiX2tleXNcIiArIGZvckxvb3BDb3VudDtcbiAgICBhcnJheU5hbWUgPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5hKTtcbiAgICB2YXJOYW1lID0gbm9kZS5jaGlsZHJlbi52LnZhbHVlO1xuICAgIGZvckxvb3BDb3VudCsrO1xuICAgIGluZGV4TmFtZSA9IGZhbHNlO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uaykge1xuICAgICAgaW5kZXhOYW1lID0gbm9kZS5jaGlsZHJlbi5rLnZhbHVlO1xuICAgIH1cbiAgICBcbiAgICBzdHIgPSAndmFyICcgKyBrZXlBcnJheU5hbWUgKyAnID0gT2JqZWN0LmtleXMoJyArIGFycmF5TmFtZSArICcpO1xcbic7XG4gICAgc3RyICs9IHNwKCkgKyAnZm9yKHZhciAnICsga2V5SW5kZXhOYW1lICsgJyA9IDA7ICcgKyBrZXlJbmRleE5hbWUgKyAnIDwgJyArIGtleUFycmF5TmFtZSArICcubGVuZ3RoOyAnICsga2V5SW5kZXhOYW1lICsgJysrKSB7XFxuJztcbiAgICBpZihpbmRleE5hbWUpIHtcbiAgICAgIHN0ciArPSBzcCgxKSArICd2YXIgJyArIGluZGV4TmFtZSArICcgPSAnICsga2V5QXJyYXlOYW1lICsgJ1snICsga2V5SW5kZXhOYW1lICsgJ107XFxuJztcbiAgICB9XG4gICAgXG4gICAgc3RyICs9IHNwKDEpICsgJ3ZhciAnICsgdmFyTmFtZSArICcgPSAnICsgYXJyYXlOYW1lICsgJ1snICsga2V5QXJyYXlOYW1lICsgJ1snICsga2V5SW5kZXhOYW1lICsgJ11dOyc7XG4gICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgLFxuICBFTFNFX0lGOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnIGVsc2UgaWYoJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJykgeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgfVxuICAsXG4gIEVMU0U6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuICcgZWxzZSB7JyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICB9XG4gICxcbiAgVFJZX0NBVENIOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHI7XG4gICAgc3RyID0gXCJ0cnkge1wiO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iMSk7XG4gICAgc3RyICs9ICdcXG4nICsgc3AoKSArIFwifSBjYXRjaChcIiArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmVycikgKyBcIikge1wiO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iMik7XG4gICAgcmV0dXJuIHN0ciArICdcXG4nICsgc3AoKSArIFwifVwiO1xuICB9XG4gICxcbiAgU1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBlbGVtZW50cztcbiAgICBlbGVtZW50cyA9IFtdO1xuICAgIHZhciBfa2V5czEyID0gT2JqZWN0LmtleXMobm9kZS5jaGlsZHJlbik7XG4gICAgZm9yKHZhciBfaW5kZXgxMiA9IDA7IF9pbmRleDEyIDwgX2tleXMxMi5sZW5ndGg7IF9pbmRleDEyKyspIHtcbiAgICAgIHZhciBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX2tleXMxMltfaW5kZXgxMl1dO1xuICAgICAgZWxlbWVudHMucHVzaChnZW5lcmF0ZUNvZGUoY2hpbGQpKTtcbiAgICB9XG4gICAgcmV0dXJuICdbJyArIGVsZW1lbnRzLmpvaW4oXCIsIFwiKSArICddJztcbiAgfVxuICAsXG4gIHN0cmluZzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgdiwgYXN0O1xuICAgIHYgPSBub2RlLnZhbHVlO1xuICAgIHYgPSB2LnJlcGxhY2UoL1xcbi9nLCBcIlxcXFxuXCIpO1xuICAgIGFzdCA9IHN0ckdyYW0ucGFyc2Uodik7XG4gICAgaWYoIWFzdC5jb21wbGV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGFzdC5oaW50KTtcbiAgICB9XG4gICAgcmV0dXJuIGdlbmVyYXRlU3RyaW5nQ29kZShhc3QsIHYuY2hhckF0KDApKTtcbiAgfVxuICAsXG4gIGNvbW1lbnQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuIG5vZGUudmFsdWUucmVwbGFjZSgvXiMvZywgXCIvL1wiKTtcbiAgfVxuICAsXG4gIHBheno6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG4gICxcbiAgbm90OiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnISc7XG4gIH1cbiAgLFxuICBjb21wYXJpc29uOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIGlmKG5vZGUudmFsdWUgPT09ICc9PScpIHtcbiAgICAgIHJldHVybiAnPT09JztcbiAgICB9XG4gICAgXG4gICAgaWYobm9kZS52YWx1ZSA9PT0gJyE9Jykge1xuICAgICAgcmV0dXJuICchPT0nO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgfVxufTtcblxuZnVuY3Rpb24gZ2VuZXJhdGVDb2RlKG5vZGUpIHtcbiAgdmFyIHN0cjtcbiAgaWYoIW5vZGUpIHtcbiAgICAvLyBkZWJ1Z2dlclxuICB9XG4gIGlmKGJhY2tlbmRbbm9kZS50eXBlXSkge1xuICAgIHJldHVybiBiYWNrZW5kW25vZGUudHlwZV0obm9kZSk7XG4gIH1cbiAgXG4gIGlmKG5vZGUudmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9XG4gIFxuICBzdHIgPSBcIlwiO1xuICBpZighbm9kZS5jaGlsZHJlbikge1xuICAgIHJldHVybiAnJztcbiAgfVxuICBcbiAgdmFyIF9rZXlzMTMgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgZm9yKHZhciBfaW5kZXgxMyA9IDA7IF9pbmRleDEzIDwgX2tleXMxMy5sZW5ndGg7IF9pbmRleDEzKyspIHtcbiAgICB2YXIgY2hpbGQgPSBub2RlLmNoaWxkcmVuW19rZXlzMTNbX2luZGV4MTNdXTtcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKGNoaWxkKTtcbiAgfVxuICBcbiAgcmV0dXJuIHN0cjtcbn1cblxuXG5mdW5jdGlvbiBnZW5lcmF0ZUV4cG9ydHMoa2V5cykge1xuICB2YXIgc3RyO1xuICBzdHIgPSAnXFxubW9kdWxlLmV4cG9ydHMgPSB7JztcbiAga2V5cyA9IGtleXMgfHwgT2JqZWN0LmtleXMoY3VycmVudE5zKCkpO1xuICB2YXIgX2tleXMxNCA9IE9iamVjdC5rZXlzKGtleXMpO1xuICBmb3IodmFyIF9pbmRleDE0ID0gMDsgX2luZGV4MTQgPCBfa2V5czE0Lmxlbmd0aDsgX2luZGV4MTQrKykge1xuICAgIHZhciBrZXkgPSBrZXlzW19rZXlzMTRbX2luZGV4MTRdXTtcbiAgICBzdHIgKz0gJ1xcbiAgJyArIGtleSArICcgOiAnICsga2V5ICsgJywnO1xuICB9XG4gIHJldHVybiBzdHIgKyAnXFxufSc7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlTW9kdWxlKGlucHV0LG9wdHMpIHtcbiAgdmFyIGFzdCwgb2JqO1xuICByZXNldEdsb2JhbCgpO1xuICBhc3QgPSBncmFtLnBhcnNlKGlucHV0ICsgXCJcXG5cIik7XG4gIGlmKCFhc3QuY29tcGxldGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYXN0LmhpbnQpO1xuICB9XG4gIFxuICBvYmogPSB7YXN0OiBhc3QsIGNvZGU6IGdlbmVyYXRlQ29kZShhc3QpLCBuczogY3VycmVudE5zKCl9O1xuICByZXR1cm4gb2JqO1xufVxuXG5ncmFtID0gZXBlZ2pzLmNvbXBpbGVHcmFtbWFyKGdyYW1tYXJEZWYsIHRva2VuRGVmKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGdyYW1tYXI6IGdyYW0sXG4gIHN0ckdyYW1tYXI6IHN0ckdyYW0sXG4gIGdyYW1tYXJEZWY6IGdyYW1tYXJEZWYsXG4gIGVwZWdqczogZXBlZ2pzLFxuICB0b2tlbkRlZjogdG9rZW5EZWYsXG4gIGdlbmVyYXRlTW9kdWxlOiBnZW5lcmF0ZU1vZHVsZSxcbiAgZ2VuZXJhdGVDb2RlOiBnZW5lcmF0ZUNvZGUsXG4gIGdlbmVyYXRlRXhwb3J0czogZ2VuZXJhdGVFeHBvcnRzXG59O1xuXG5cbiJdfQ==
