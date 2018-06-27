!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.cokescript=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var epegjs, virtual, h, depth, forLoopCount, unpacking, namespaces, levelStack, prefix, tokenDef, strInterpolationTokenDef, strInterpolationGrammarDef, strGram, grammarDef, nc, backend, gram;
// CokeScript language by Batiste Bieler 2015
// Implemented using EPEG.JS, v0.0.8

epegjs = require("epegjs");
virtual = require("virtual-dom");
h = virtual.create;

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
  {key: "name", reg: /^[a-zA-Z_$]([0-9a-zA-Z_$\-]{0,28}[0-9a-zA-Z_$])?/},
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
  START: {rules: ["EL* EOF"]}, EL: {rules: ["VAR", "char", "name", "start", "end", "dot"]}, VAR: {rules: ["start NAME end"]}, NAME: {rules: ["name dot NAME", "name"]}
};

strGram = epegjs.compileGrammar(strInterpolationGrammarDef, strInterpolationTokenDef);

function generateStringCode(node,c) {
  var str, __index1, __keys1, child;
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
  
  __keys1 = Object.keys(node.children);
  for(__index1 = 0; __index1 < __keys1.length; __index1++) {
    child = node.children[__keys1[__index1]];
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
  START: {rules: ["LINE* EOF"]}, ELC: {rules: ["W* comment"], verbose: "comment"}, LINE: {rules: ["STATEMENT ELC? samedent+", "STATEMENT ELC? !dedent", 
    "ELC? samedent", "ELC !dedent"], verbose: "new line"}, BLOCK: {rules: ["indent pazz dedent", "indent LINE+ dedent"]}, STATEMENT: {rules: ["ASSIGN", "EXPR", "IF", "WHILE", "FOR", "RETURN", 
    "CLASS", "TAG", "DOM_ASSIGN", "TRY_CATCH", "THROW"]}, CLASS_METHODS: {
    rules: ["samedent* f:FUNC_DEF samedent*"], hooks: function (p) { return p.f; }
  }, CLASS: {
    rules: [
      "class n:name open_par p:name close_par indent m:CLASS_METHODS+ dedent",
      "class n:name indent m:CLASS_METHODS+ dedent"
    ], hooks: [
      function (p) { return {name: p.n, methods: p.m, parent: p.p}; },
      function (p) { return {name: p.n, methods: p.m}; }
    ]
  }, FUNC_DEF_PARAMS: {rules: [
    "p1:FUNC_DEF_PARAMS comma W p2:FUNC_DEF_PARAMS",
    "p1:name assign e:EXPR",
    "p1:name"
    ], verbose: "def parameters"
  }, LAMBDA_BODY: {rules: ["ASSIGN", "EXPR"]}, LAMBDA: {rules: [
    "fd:function_def open_par params:FUNC_DEF_PARAMS? close_par W block:LAMBDA_BODY",
    "fd:function_def W fn:name open_par params:FUNC_DEF_PARAMS? close_par W block:LAMBDA_BODY",
    "fd:function_def W block:LAMBDA_BODY"
    ], hooks: reflect
  }, FUNC_DEF: {rules: [
    "fd:function_def open_par params:FUNC_DEF_PARAMS? close_par block:BLOCK",
    "fd:function_def W fn:name open_par params:FUNC_DEF_PARAMS? close_par block:BLOCK",
    "fd:function_def W fn:name block:BLOCK",
    "fd:function_def block:BLOCK"
    ], hooks: reflect, verbose: "def definition"
  }, ELSE_IF: {rules: ["samedent elseif e:EXPR b:BLOCK"], hooks: reflect}, ELSE: {rules: ["samedent else b:BLOCK"], hooks: reflect}, IF: {rules: ["if e:EXPR b:BLOCK elif:ELSE_IF* el:ELSE?"], hooks: reflect}, ELSE_EXPR: {rules: ["W else W b:EXPR"], hooks: reflect}, IF_EXPR: {rules: ["e:EXPR W if test:EXPR el:ELSE_EXPR?"], hooks: reflect}, WHILE: {rules: ["while e:EXPR b:BLOCK"], hooks: reflect}, MATH: {rules: ["e1:EXPR W op:math W e2:EXPR"]}, PATH: {rules: ["PATH dot name", "PATH open_bra number close_bra", "name"]}, ASSIGN: {rules: [
    "left:OBJECT W op:assign W right:EXPR",
    "left:EXPR W op:assign W right:EXPR",
    "left:STRICT_COMMA_SEPARATED_EXPR W op:assign W right:STRICT_COMMA_SEPARATED_EXPR",
    "left:STRICT_COMMA_SEPARATED_EXPR W op:assign W right:EXPR"
  ], hooks: reflect}, W_OR_SAMEDENT: {rules: ["W", "samedent"], verbose: "samedent or whitespace"}, W_SAMEDENT_INDENT: {rules: ["W", "samedent", "indent"], verbose: "indent or samedent or whitespace"}, ANY_SPACE: {rules: ["W", "samedent", "indent", "dedent", "comment"], verbose: "any space"}, FUNC_CALL_PARAMS: {rules: ["EXPR comma ANY_SPACE+ FUNC_CALL_PARAMS ANY_SPACE*", "EXPR ANY_SPACE*"]}, FUNC_CALL: {rules: [
    "open_par FUNC_CALL_PARAMS? close_par"
  ]}, TYPE: {rules: ["name colon"]}, FOR: {rules: [
    "for_loop k:name comma W v:name W in a:EXPR b:BLOCK",
    "for_loop v:name W in a:EXPR b:BLOCK"], hooks: reflect
  }, STRICT_COMMA_SEPARATED_EXPR: {rules: [
    "e1:EXPR comma W e2:STRICT_COMMA_SEPARATED_EXPR",
    "e1:EXPR comma W e2:EXPR"
  ], hooks: [
    function (p) { return [p.e1].concat(p.e2.children); }, function (p) { return [p.e1, p.e2]; }
  ] 
  }, COMMA_SEPARATED_EXPR: {rules: [
    "EXPR comma ANY_SPACE+ COMMA_SEPARATED_EXPR ANY_SPACE*",
    "EXPR ANY_SPACE*"
  ]}, ARRAY: {rules: [
    "open_bra ANY_SPACE* c:COMMA_SEPARATED_EXPR? ANY_SPACE* close_bra"
  ]}, MEMBERS: {rules: [
    "name:name colon W value:EXPR same:samedent? comma any:ANY_SPACE+ m:MEMBERS space:ANY_SPACE*",
    "name:name colon W value:EXPR space:ANY_SPACE*"
  ], hooks: [
    function (p) { return [p].concat(p.m.children); }, function (p) { return [p]; }
  ]
  }, OBJECT: {rules: [
    "open_curly indent? MEMBERS? close_curly"
  ]}, TAG_PARAMS: {rules: [
    "left:TAG_PARAMS W right:TAG_PARAMS",
    "n:name assign e:EXPR",
    "n:name"
    ], hooks: reflect, verbose: "tag parameters"
  }, TAG: {rules: [
    "tag:tag W? params:TAG_PARAMS? end:>? block:BLOCK?"
  ], hooks: reflect
  }, DOM_ASSIGN: {rules: [
    "assign EXPR"
  ]}, TRY_CATCH: {rules: [
    "try b1:BLOCK samedent? catch open_par err:name? close_par b2:BLOCK"
    ], hooks: reflect
  }, THROW: {rules: [
    "throw EXPR"
  ]}, RETURN: {rules: ["ret W STRICT_COMMA_SEPARATED_EXPR", "ret W EXPR", "ret"]}, RIGHT_EXPR: {rules: [
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
    ], verbose: "expression"
  }, EXPR: {rules: [
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
    ], verbose: "expression"
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
  var ns, hoisted, __index2, __keys2, key, value;
  ns = currentNs();
  hoisted = [];
  __keys2 = Object.keys(ns);
  for(__index2 = 0; __index2 < __keys2.length; __index2++) {
    key = __keys2[__index2];
    value = ns[__keys2[__index2]];
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
    var str, __index3, __keys3, child, hoisted;
    str = '';
    __keys3 = Object.keys(node.children);
    for(__index3 = 0; __index3 < __keys3.length; __index3++) {
      child = node.children[__keys3[__index3]];
      str += generateCode(child);
    }
    hoisted = generateHoistedVar();
    if(hoisted) {
      return generateHoistedVar() + '\n' + str;
    }
    return str;
  }, 
  dedent: function (node) {
    depth = Math.max(0, depth - 1);
    return '';
  }, 
  indent: function (node) {
    depth = depth + 1;
    return '\n' + sp();
  }, 
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
  }, 
  DOM_ASSIGN: function (node) {
    var name, varname, str;
    name = CN();
    varname = generateCode(node.children[1]);
    hoistVar(CN());
    hoistVar('' + prefix + 'tmp');
    str = '' + prefix + 'tmp = ' + varname + '; ' + prefix + 'tmp instanceof Array ? (' + name + ' = ' + name + '.concat(' + prefix + 'tmp)) : ' + name + '.push(String(' + prefix + 'tmp))';
    return str;
  }, 
  TAG_PARAMS: function (node) {
    var name;
    if(node.children.left) {
      return generateCode(node.children.left) + ', ' + generateCode(node.children.right);
    }
    
    name = node.children.n.value;
    
    if(node.children.e) {
      return '"' + name + '": ' + generateCode(node.children.e);
    } else {
      return '"' + name + '": true';
    }
  }, 
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
    
    str += '\n' + sp() + CN() + '.push(cokescript.h("' + name + '", ' + params + ', ' + sub + '))';
    return str;
  }, 
  CLASS: function (node) {
    var name, funcs, parent, str, constructor, __index4, __keys4, func, func_def, func_name, ns, params, body, cons_str, __index5, __keys5, key, value;
    name = node.children.name.value;
    funcs = node.children.methods;
    parent = node.children.parent;
    str = '';
    constructor = null;
    __keys4 = Object.keys(funcs);
    for(__index4 = 0; __index4 < __keys4.length; __index4++) {
      func = funcs[__keys4[__index4]];
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
    __keys5 = Object.keys(ns);
    for(__index5 = 0; __index5 < __keys5.length; __index5++) {
      key = __keys5[__index5];
      value = ns[__keys5[__index5]];
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
  }, 
  LAMBDA: function (node) {
    var name, ns, str, __index6, __keys6, key, value, code;
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
    __keys6 = Object.keys(ns);
    for(__index6 = 0; __index6 < __keys6.length; __index6++) {
      key = __keys6[__index6];
      value = ns[__keys6[__index6]];
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
  }, 
  FUNC_DEF: function (node) {
    var name, ns, is_dom, str, __index7, __keys7, key, value, code, body, hoisted;
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
    __keys7 = Object.keys(ns);
    for(__index7 = 0; __index7 < __keys7.length; __index7++) {
      key = __keys7[__index7];
      value = ns[__keys7[__index7]];
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
  }, 
  FUNC_DEF_PARAMS: function (node) {
    var str, ns, __index8, __keys8, n;
    str = "";
    ns = currentNs();
    if(node.children[0].type === 'name') {
      ns[node.children[0].value] = true;
      if(node.children[1] && node.children[1].type === 'assign') {
        ns[node.children[0].value] = node.children[2];
      }
    }
    
    __keys8 = Object.keys(node.children);
    for(__index8 = 0; __index8 < __keys8.length; __index8++) {
      n = node.children[__keys8[__index8]];
      if(n.type === 'name' || n.type === 'FUNC_DEF_PARAMS' || n.type === 'comma' || n.type === 'window') {
        str += generateCode(n);
      }
    }
    
    return str;
  }, 
  ASSIGN: function (node) {
    var str, op, explicit_global, ns, left, right_code, unpack_name, i, __index9, __keys9, child, n, members, __index10, __keys10, member, name, value, __index11, __keys11, s, __index12, __keys12, ch;
    str = "";
    op = node.children.op.value;
    explicit_global = op === ':=';
    if(explicit_global) {
      op = '=';
    }
    
    ns = currentNs();
    left = node.children.left;
    right_code = generateCode(node.children.right);
    
    // assignement unpacking
    if(left.type === 'STRICT_COMMA_SEPARATED_EXPR') {
      unpacking++;
      unpack_name = '' + prefix + 'unpack' + unpacking + '';
      str += 'var ' + unpack_name + ' = ' + right_code + ';\n' + sp();
      i = 0;
      __keys9 = Object.keys(left.children);
      for(__index9 = 0; __index9 < __keys9.length; __index9++) {
        child = left.children[__keys9[__index9]];
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
    
    // assignement mapping
    if(left.type === 'OBJECT') {
      unpacking++;
      unpack_name = '' + prefix + 'unpack' + unpacking + '';
      str += 'var ' + unpack_name + ' = ' + right_code + ';\n' + sp();
      i = 0;
      members = left.children[1].children;
      __keys10 = Object.keys(members);
      for(__index10 = 0; __index10 < __keys10.length; __index10++) {
        member = members[__keys10[__index10]];
        name = generateCode(member.name);
        value = generateCode(member.value);
        if(member.samedent) {
          generateCode(member.samedent);
        }
        if(member.any) {
          __keys11 = Object.keys(member.any);
          for(__index11 = 0; __index11 < __keys11.length; __index11++) {
            s = member.any[__keys11[__index11]];
            generateCode(s);
          }
        }
        if(member.space) {
          __keys12 = Object.keys(member.space);
          for(__index12 = 0; __index12 < __keys12.length; __index12++) {
            s = member.space[__keys12[__index12]];
            generateCode(s);
          }
        }
        str += "" + value + "." + name + " = " + unpack_name + "." + name + "";
        if(i < members.length - 1) {
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
  }, 
  STATEMENT: function (node) {
    var str, __index13, __keys13, child, e, t, other;
    str = '';
    __keys13 = Object.keys(node.children);
    for(__index13 = 0; __index13 < __keys13.length; __index13++) {
      child = node.children[__keys13[__index13]];
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
  }, 
  IF: function (node) {
    var str, elif, __index14, __keys14, value;
    str = '';
    str = 'if(' + generateCode(node.children.e) + ') {' + generateCode(node.children.b) + '\n' + sp() + '}';
    elif = node.children.elif;
    if(elif) {
      if(Array.isArray(elif)) {
        __keys14 = Object.keys(elif);
        for(__index14 = 0; __index14 < __keys14.length; __index14++) {
          value = elif[__keys14[__index14]];
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
  }, 
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
  }, 
  ELSE_EXPR: function (node) {
    return generateCode(node.children.b);
  }, 
  WHILE: function (node) {
    return 'while(' + generateCode(node.children.e) + '){' + generateCode(node.children.b) + '\n' + sp() + '}';
  }, 
  FOR: function (node) {
    var keyIndexName, keyArrayName, arrayName, varName, indexName, str;
    keyIndexName = prefix + "index" + forLoopCount;
    keyArrayName = prefix + "keys" + forLoopCount;
    hoistVar(keyIndexName);
    hoistVar(keyArrayName);
    
    arrayName = generateCode(node.children.a);
    varName = node.children.v.value;
    forLoopCount++;
    indexName = false;
    if(node.children.k) {
      indexName = node.children.k.value;
    }
    
    if(indexName) {
      hoistVar(indexName);
    }
    hoistVar(varName);
    
    str = '' + keyArrayName + ' = Object.keys(' + arrayName + ');\n';
    str += sp() + 'for(' + keyIndexName + ' = 0; ' + keyIndexName + ' < ' + keyArrayName + '.length; ' + keyIndexName + '++) {\n';
    if(indexName) {
      str += sp(1) + '' + indexName + ' = ' + keyArrayName + '[' + keyIndexName + '];\n';
    }
    
    str += sp(1) + '' + varName + ' = ' + arrayName + '[' + keyArrayName + '[' + keyIndexName + ']];';
    str += generateCode(node.children.b) + '\n' + sp() + '}';
    return str;
  }, 
  ELSE_IF: function (node) {
    return ' else if(' + generateCode(node.children.e) + ') {' + generateCode(node.children.b) + '\n' + sp() + '}';
  }, 
  ELSE: function (node) {
    return ' else {' + generateCode(node.children.b) + '\n' + sp() + '}';
  }, 
  TRY_CATCH: function (node) {
    var str;
    str = "try {";
    str += generateCode(node.children.b1);
    str += '\n' + sp() + "} catch(" + generateCode(node.children.err) + ") {";
    str += generateCode(node.children.b2);
    return str + '\n' + sp() + "}";
  }, 
  STRICT_COMMA_SEPARATED_EXPR: function (node) {
    var elements, __index15, __keys15, child;
    elements = [];
    __keys15 = Object.keys(node.children);
    for(__index15 = 0; __index15 < __keys15.length; __index15++) {
      child = node.children[__keys15[__index15]];
      elements.push(generateCode(child));
    }
    return '[' + elements.join(", ") + ']';
  }, 
  MEMBERS: function (node) {
    var str, i, __index16, __keys16, member, __index17, __keys17, s, __index18, __keys18;
    str = "";
    i = 0;
    __keys16 = Object.keys(node.children);
    for(__index16 = 0; __index16 < __keys16.length; __index16++) {
      member = node.children[__keys16[__index16]];
      str += generateCode(member.name) + ': ' + generateCode(member.value);
      if(i < node.children.length - 1) {
        str += ', ';
      }
      if(member.same) {
        str += generateCode(member.same);
      }
      if(member.any) {
        __keys17 = Object.keys(member.any);
        for(__index17 = 0; __index17 < __keys17.length; __index17++) {
          s = member.any[__keys17[__index17]];
          generateCode(s);
        }
      }
      if(member.space) {
        __keys18 = Object.keys(member.space);
        for(__index18 = 0; __index18 < __keys18.length; __index18++) {
          s = member.space[__keys18[__index18]];
          str += generateCode(s);
        }
      }
      i++;
    }
    return str;
  }, 
  string: function (node) {
    var v, ast;
    v = node.value;
    v = v.replace(/\n/g, "\\n");
    ast = strGram.parse(v);
    if(!ast.complete) {
      throw new Error(ast.hint);
    }
    return generateStringCode(ast, v.charAt(0));
  }, 
  comment: function (node) {
    return node.value.replace(/^#/g, "//");
  }, 
  name: function (node) {
    return node.value.replace('-', '_');
  }, 
  pazz: function (node) {
    return '';
  }, 
  not: function (node) {
    return '!';
  }, 
  and: function (node) {
    return '&& ';
  }, 
  or: function (node) {
    return '|| ';
  }, 
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
  var str, __index19, __keys19, child;
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
  
  __keys19 = Object.keys(node.children);
  for(__index19 = 0; __index19 < __keys19.length; __index19++) {
    child = node.children[__keys19[__index19]];
    str += generateCode(child);
  }
  
  return str;
}


function generateExports(keys) {
  var str, __index20, __keys20, key;
  str = '\nmodule.exports = {';
  keys = keys || Object.keys(currentNs());
  __keys20 = Object.keys(keys);
  for(__index20 = 0; __index20 < __keys20.length; __index20++) {
    key = keys[__keys20[__index20]];
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

function createVNode(name,attrs,children) {
  var props, attributes, __index21, __keys21, key, value;
  // this could be done at compile time
  if(attrs.constructor === Array) {
    return virtual.h(name, attrs, children);
  }
  props = {};
  attributes = {};
  __keys21 = Object.keys(attrs);
  for(__index21 = 0; __index21 < __keys21.length; __index21++) {
    key = __keys21[__index21];
    value = attrs[__keys21[__index21]];
    if(key.match(/^(checked|value|selected)$/)) {
      props[key] = value;
    } else {
      attributes[key] = value;
    }
  }
  props.attributes = attributes;
  return virtual.h(name, props, children);
}

module.exports = {
  v: virtual, h: createVNode, create: virtual.create, diff: virtual.diff, patch: virtual.patch, grammar: gram, strGrammar: strGram, grammarDef: grammarDef, epegjs: epegjs, tokenDef: tokenDef, generateModule: generateModule, generateCode: generateCode, generateExports: generateExports
};


},{"epegjs":4,"virtual-dom":13}],2:[function(require,module,exports){

},{}],3:[function(require,module,exports){
/*!
 * Cross-Browser Split 1.1.1
 * Copyright 2007-2012 Steven Levithan <stevenlevithan.com>
 * Available under the MIT License
 * ECMAScript compliant, uniform cross-browser split method
 */

/**
 * Splits a string into an array of strings using a regex or string separator. Matches of the
 * separator are not included in the result array. However, if `separator` is a regex that contains
 * capturing groups, backreferences are spliced into the result each time `separator` is matched.
 * Fixes browser bugs compared to the native `String.prototype.split` and can be used reliably
 * cross-browser.
 * @param {String} str String to split.
 * @param {RegExp|String} separator Regex or string to use for separating the string.
 * @param {Number} [limit] Maximum number of items to include in the result array.
 * @returns {Array} Array of substrings.
 * @example
 *
 * // Basic use
 * split('a b c d', ' ');
 * // -> ['a', 'b', 'c', 'd']
 *
 * // With limit
 * split('a b c d', ' ', 2);
 * // -> ['a', 'b']
 *
 * // Backreferences in result array
 * split('..word1 word2..', /([a-z]+)(\d+)/i);
 * // -> ['..', 'word', '1', ' ', 'word', '2', '..']
 */
module.exports = (function split(undef) {

  var nativeSplit = String.prototype.split,
    compliantExecNpcg = /()??/.exec("")[1] === undef,
    // NPCG: nonparticipating capturing group
    self;

  self = function(str, separator, limit) {
    // If `separator` is not a regex, use `nativeSplit`
    if (Object.prototype.toString.call(separator) !== "[object RegExp]") {
      return nativeSplit.call(str, separator, limit);
    }
    var output = [],
      flags = (separator.ignoreCase ? "i" : "") + (separator.multiline ? "m" : "") + (separator.extended ? "x" : "") + // Proposed for ES6
      (separator.sticky ? "y" : ""),
      // Firefox 3+
      lastLastIndex = 0,
      // Make `global` and avoid `lastIndex` issues by working with a copy
      separator = new RegExp(separator.source, flags + "g"),
      separator2, match, lastIndex, lastLength;
    str += ""; // Type-convert
    if (!compliantExecNpcg) {
      // Doesn't need flags gy, but they don't hurt
      separator2 = new RegExp("^" + separator.source + "$(?!\\s)", flags);
    }
    /* Values for `limit`, per the spec:
     * If undefined: 4294967295 // Math.pow(2, 32) - 1
     * If 0, Infinity, or NaN: 0
     * If positive number: limit = Math.floor(limit); if (limit > 4294967295) limit -= 4294967296;
     * If negative number: 4294967296 - Math.floor(Math.abs(limit))
     * If other: Type-convert, then use the above rules
     */
    limit = limit === undef ? -1 >>> 0 : // Math.pow(2, 32) - 1
    limit >>> 0; // ToUint32(limit)
    while (match = separator.exec(str)) {
      // `separator.lastIndex` is not reliable cross-browser
      lastIndex = match.index + match[0].length;
      if (lastIndex > lastLastIndex) {
        output.push(str.slice(lastLastIndex, match.index));
        // Fix browsers whose `exec` methods don't consistently return `undefined` for
        // nonparticipating capturing groups
        if (!compliantExecNpcg && match.length > 1) {
          match[0].replace(separator2, function() {
            for (var i = 1; i < arguments.length - 2; i++) {
              if (arguments[i] === undef) {
                match[i] = undef;
              }
            }
          });
        }
        if (match.length > 1 && match.index < str.length) {
          Array.prototype.push.apply(output, match.slice(1));
        }
        lastLength = match[0].length;
        lastLastIndex = lastIndex;
        if (output.length >= limit) {
          break;
        }
      }
      if (separator.lastIndex === match.index) {
        separator.lastIndex++; // Avoid an infinite loop
      }
    }
    if (lastLastIndex === str.length) {
      if (lastLength || !separator.test("")) {
        output.push("");
      }
    } else {
      output.push(str.slice(lastLastIndex));
    }
    return output.length > limit ? output.slice(0, limit) : output;
  };

  return self;
})();

},{}],4:[function(require,module,exports){
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
      } else if(token.str){
        match = input.indexOf(token.str);
        if(match === 0) {
          candidate = token.str;
          break;
        }
      } else {
        throw new Error("Tokenizer error: Invalid token " + key + " without a reg, str or func property");
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
        line: 1,
        column: 1,
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9lcGVnanMvZGlzdC9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL2VwZWdqcy9kaXN0L0VQRUcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKlxuICBKYXZhU2NyaXB0IGltcGxlbWVudGF0aW9uIG9mIGEgUGFja3JhdCBQYXJzZXJzIHdpdGggbGVmdCBSZWN1cnNpb24gU3VwcG9ydFxuICBodHRwOi8vd3d3LnZwcmkub3JnL3BkZi90cjIwMDcwMDJfcGFja3JhdC5wZGZcblxuICBObyBJbmRpcmVjdCBMZWZ0IFJlY3Vyc2lvbiB5ZXQgOi0oXG5cbiAgQmF0aXN0ZSBCaWVsZXIgMjAxNFxuKi9cblwidXNlIHN0cmljdFwiO1xuXG5mdW5jdGlvbiB0b2tlbml6ZShpbnB1dCwgZ3JhbSkge1xuICB2YXIga2V5cyA9IGdyYW0udG9rZW5LZXlzO1xuICB2YXIgdG9rZW5zID0gZ3JhbS50b2tlbk1hcDtcbiAgdmFyIHN0cmVhbSA9IFtdO1xuICB2YXIgbGVuID0gaW5wdXQubGVuZ3RoLCBjYW5kaWRhdGUsIGksIGtleSwgY29weSA9IGlucHV0LCBsYXN0VG9rZW4gPSBudWxsO1xuICB2YXIgcG9pbnRlciA9IDA7XG4gIHZhciBsaW5lID0gMDtcbiAgdmFyIGNvbHVtbiA9IDA7XG5cbiAgd2hpbGUocG9pbnRlciA8IGxlbikge1xuICAgIGNhbmRpZGF0ZSA9IG51bGw7XG4gICAgZm9yKGk9MDsgaTxrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBrZXkgPSBrZXlzW2ldO1xuICAgICAgdmFyIHRva2VuID0gdG9rZW5zW2tleV0sIG1hdGNoO1xuICAgICAgaWYodG9rZW4uZnVuYykge1xuICAgICAgICBtYXRjaCA9IHRva2VuLmZ1bmMoaW5wdXQsIHN0cmVhbSk7XG4gICAgICAgIGlmKG1hdGNoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBjYW5kaWRhdGUgPSBtYXRjaDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmKHRva2VuLnJlZyl7XG4gICAgICAgIG1hdGNoID0gaW5wdXQubWF0Y2godG9rZW4ucmVnKTtcbiAgICAgICAgaWYobWF0Y2ggIT09IG51bGwpIHtcbiAgICAgICAgICBjYW5kaWRhdGUgPSBtYXRjaFswXTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmKHRva2VuLnN0cil7XG4gICAgICAgIG1hdGNoID0gaW5wdXQuaW5kZXhPZih0b2tlbi5zdHIpO1xuICAgICAgICBpZihtYXRjaCA9PT0gMCkge1xuICAgICAgICAgIGNhbmRpZGF0ZSA9IHRva2VuLnN0cjtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVG9rZW5pemVyIGVycm9yOiBJbnZhbGlkIHRva2VuIFwiICsga2V5ICsgXCIgd2l0aG91dCBhIHJlZywgc3RyIG9yIGZ1bmMgcHJvcGVydHlcIik7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGNhbmRpZGF0ZSAhPT0gbnVsbCkge1xuICAgICAgbGFzdFRva2VuID0ge3R5cGU6a2V5LCB2YWx1ZTpjYW5kaWRhdGUsIHBvaW50ZXI6cG9pbnRlciwgbGluZTpsaW5lKzEsIGNvbHVtbjpjb2x1bW4rMX07XG4gICAgICBzdHJlYW0ucHVzaChsYXN0VG9rZW4pO1xuICAgICAgdmFyIGxpbmVfYnJlYWtzX2NvdW50ID0gY291bnRMaW5lQnJlYWsoY2FuZGlkYXRlKTtcbiAgICAgIGxpbmUgKz0gbGluZV9icmVha3NfY291bnQ7XG4gICAgICBpZihsaW5lX2JyZWFrc19jb3VudCA+IDApIHtcbiAgICAgICAgY29sdW1uID0gMDtcbiAgICAgIH1cbiAgICAgIGNvbHVtbiArPSBjb3VudENvbHVtbihjYW5kaWRhdGUpO1xuICAgICAgcG9pbnRlciArPSBjYW5kaWRhdGUubGVuZ3RoO1xuICAgICAgaW5wdXQgPSBpbnB1dC5zdWJzdHIoY2FuZGlkYXRlLmxlbmd0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmKHN0cmVhbS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVG9rZW5pemVyIGVycm9yOiB0b3RhbCBtYXRjaCBmYWlsdXJlXCIpO1xuICAgICAgfVxuICAgICAgaWYobGFzdFRva2VuKVxuICAgICAgICBsYXN0VG9rZW4ucG9pbnRlciArPSBsYXN0VG9rZW4udmFsdWUubGVuZ3RoO1xuICAgICAgdmFyIG1zZyA9IGVycm9yTXNnKGNvcHksIHN0cmVhbVtzdHJlYW0ubGVuZ3RoIC0gMV0sIFwiVG9rZW5pemVyIGVycm9yXCIsIFwiTm8gbWF0Y2hpbmcgdG9rZW4gZm91bmRcIik7XG4gICAgICBpZihsYXN0VG9rZW4pXG4gICAgICAgIG1zZyArPSBcIlxcblwiICsgXCJCZWZvcmUgdG9rZW4gb2YgdHlwZSBcIiArIGxhc3RUb2tlbi50eXBlICsgXCI6IFwiICsgbGFzdFRva2VuLnZhbHVlO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZyk7XG4gICAgfVxuICB9XG4gIHN0cmVhbS5wdXNoKHt0eXBlOidFT0YnLCB2YWx1ZTpcIlwifSk7XG4gIHJldHVybiBzdHJlYW07XG59XG5cbmZ1bmN0aW9uIGNvdW50TGluZUJyZWFrKHN0cikge1xuICB2YXIgbSA9IHN0ci5zcGxpdCgvXFxuL2cpO1xuICByZXR1cm4gbS5sZW5ndGggLSAxO1xufVxuXG5mdW5jdGlvbiBjb3VudENvbHVtbihzdHIpIHtcbiAgdmFyIG0gPSBzdHIuc3BsaXQoL1xcbi9nKTtcbiAgcmV0dXJuIG1bbS5sZW5ndGgtMV0ubGVuZ3RoO1xufVxuXG5mdW5jdGlvbiBjb3B5VG9rZW4oc3Rva2VuLCBydG9rZW4pIHtcbiAgdmFyIHQgPSB7XG4gICAgdHlwZTpzdG9rZW4udHlwZSxcbiAgICB2YWx1ZTpzdG9rZW4udmFsdWUsXG4gICAgcmVwZWF0OnJ0b2tlbi5yZXBlYXQsXG4gICAgbGluZTpzdG9rZW4ubGluZSxcbiAgICBjb2x1bW46c3Rva2VuLmNvbHVtblxuICB9O1xuICBpZihydG9rZW4ubmFtZSkge1xuICAgIHQubmFtZSA9IHJ0b2tlbi5uYW1lO1xuICB9XG4gIHJldHVybiB0O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVQYXJhbXModG9rZW5zKSB7XG4gIHZhciBwYXJhbXMgPSB7fTtcbiAgdmFyIGogPSAwO1xuICB0b2tlbnMubWFwKGZ1bmN0aW9uKGkpIHtcbiAgICBpZihpLm5hbWUpIHtcbiAgICAgIGlmKGkucmVwZWF0ID09ICcqJyB8fCBpLnJlcGVhdCA9PSAnKycpIHtcbiAgICAgICAgaWYoIXBhcmFtc1tpLm5hbWVdKSB7XG4gICAgICAgICAgcGFyYW1zW2kubmFtZV0gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBwYXJhbXNbaS5uYW1lXS5wdXNoKGkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGFyYW1zW2kubmFtZV0gPSBpO1xuICAgICAgfVxuICAgIH1cbiAgICBwYXJhbXNbJyQnK2pdID0gaTtcbiAgICBqKys7XG4gIH0pO1xuICByZXR1cm4gcGFyYW1zO1xufVxuXG5mdW5jdGlvbiBncm93TFIoZ3JhbW1hciwgcnVsZSwgc3RyZWFtLCBwb3MsIG1lbW8pIHtcbiAgdmFyIHNwLCByZXN1bHQsIHByb2dyZXNzID0gZmFsc2U7XG4gIHZhciBob29rID0gZ3JhbW1hcltydWxlLmtleV0uaG9va3NbcnVsZS5pbmRleF07XG5cbiAgd2hpbGUodHJ1ZSkge1xuICAgIHNwID0gcG9zO1xuXG4gICAgcmVzdWx0ID0gZXZhbFJ1bGVCb2R5KGdyYW1tYXIsIHJ1bGUsIHN0cmVhbSwgc3ApO1xuXG4gICAgLy8gZW5zdXJlIHNvbWUgcHJvZ3Jlc3MgaXMgbWFkZVxuICAgIGlmKHJlc3VsdCA9PT0gZmFsc2UgfHwgcmVzdWx0LnNwIDw9IG1lbW8uc3ApIHtcbiAgICAgIHJldHVybiBwcm9ncmVzcztcbiAgICB9XG5cbiAgICByZXN1bHQuaG9vayA9IGhvb2s7XG5cbiAgICAvLyBpdCdzIHZlcnkgaW1wb3J0YW50IHRvIHVwZGF0ZSB0aGUgbWVtb2l6ZWQgdmFsdWVcbiAgICAvLyB0aGlzIGlzIGFjdHVhbGx5IGdyb3dpbmcgdGhlIHNlZWQgaW4gdGhlIG1lbW9pemF0aW9uXG4gICAgbWVtby5jaGlsZHJlbiA9IHJlc3VsdC5jaGlsZHJlbjtcbiAgICBtZW1vLnNwID0gcmVzdWx0LnNwO1xuICAgIG1lbW8ubGluZSA9IHJlc3VsdC5saW5lO1xuICAgIG1lbW8uY29sdW1uID0gcmVzdWx0LmNvbHVtbjtcbiAgICBtZW1vLnN0YXJ0ID0gcmVzdWx0LnN0YXJ0O1xuICAgIG1lbW8uaG9va2VkID0gcmVzdWx0Lmhvb2tlZDtcbiAgICBtZW1vLmhvb2sgPSByZXN1bHQuaG9vaztcbiAgICBwcm9ncmVzcyA9IHJlc3VsdDtcbiAgfVxuICByZXR1cm4gcHJvZ3Jlc3M7XG59XG5cbmZ1bmN0aW9uIG1lbW9FdmFsKGdyYW1tYXIsIHJ1bGUsIHN0cmVhbSwgcG9pbnRlcikge1xuXG4gIHZhciBrZXkgPSBydWxlLmtleSsnOycrcG9pbnRlcisnOycrcnVsZS5pbmRleDtcblxuICAvLyBhdm9pZCBpbmZpbml0ZSByZWN1cnNpb25cbiAgLy8gVGhpcyBpcyBmYXN0ZXIgdGhhbiBmaWx0ZXJcbiAgdmFyIGkgPSBzdGFjay5sZW5ndGggLSAxO1xuICB3aGlsZShpID49IDApIHtcbiAgICBpZihzdGFja1tpXVswXSA9PSBrZXkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaSA9IGktMTtcbiAgfVxuXG4gIHZhciBtZW1vX2VudHJ5ID0gbWVtb2l6YXRpb25bcnVsZS5rZXkrJzsnK3BvaW50ZXJdO1xuICBpZihtZW1vX2VudHJ5ICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbWVtb19lbnRyeTtcbiAgfVxuXG4gIHN0YWNrLnB1c2goW2tleSwgcnVsZV0pO1xuICB2YXIgcmVzdWx0ID0gZXZhbFJ1bGVCb2R5KGdyYW1tYXIsIHJ1bGUsIHN0cmVhbSwgcG9pbnRlcik7XG4gIHN0YWNrLnBvcCgpO1xuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGNhbkZhaWwodG9rZW4sIG5vZGUpIHtcbiAgaWYodG9rZW4ucmVwZWF0ID09PSAnKicgfHwgdG9rZW4ucmVwZWF0ID09PSAnPycpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBpZih0b2tlbi5yZXBlYXQgPT09ICcrJyAmJiBub2RlLmNoaWxkcmVuLmxlbmd0aCAmJiBub2RlLmNoaWxkcmVuW25vZGUuY2hpbGRyZW4ubGVuZ3RoIC0gMV0udHlwZSA9PSB0b2tlbi50eXBlKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBjYW5SZXBlYXQodG9rZW4pIHtcbiAgcmV0dXJuIHRva2VuLnJlcGVhdCA9PT0gJyonIHx8IHRva2VuLnJlcGVhdCA9PT0gJysnO1xufVxuXG5mdW5jdGlvbiBldmFsUnVsZUJvZHkoZ3JhbW1hciwgcnVsZSwgc3RyZWFtLCBwb2ludGVyKSB7XG5cbiAgdmFyIHNwID0gcG9pbnRlcjsgLy8gc3RyZWFtIHBvaW50ZXJcbiAgdmFyIHJwID0gMDsgICAgICAgLy8gcnVsZSBwb2ludGVyXG4gIHZhciBqLCByZXN1bHQ7XG5cbiAgdmFyIHJ0b2tlbiA9IHJ1bGUudG9rZW5zW3JwXTtcbiAgdmFyIHN0b2tlbiA9IHN0cmVhbVtzcF07XG5cbiAgdmFyIGN1cnJlbnROb2RlID0ge1xuICAgIHR5cGU6IHJ1bGUua2V5LCBcbiAgICBjaGlsZHJlbjpbXSwgXG4gICAgc3RhcnQ6cG9pbnRlciwgXG4gICAgbmFtZTpydWxlLm5hbWUsIFxuICAgIGxpbmU6c3Rva2VuLmxpbmUsIFxuICAgIGNvbHVtbjpzdG9rZW4uY29sdW1uXG4gIH07XG5cbiAgd2hpbGUocnRva2VuICYmIHN0b2tlbikge1xuXG4gICAgLy8gQ2FzZSBvbmU6IHdlIGhhdmUgYSBydWxlIHdlIG5lZWQgdG8gZGV2ZWxvcFxuICAgIGlmKGdyYW1tYXJbcnRva2VuLnR5cGVdKSB7XG5cbiAgICAgIHZhciBleHBhbmRfcnVsZXMgPSBncmFtbWFyW3J0b2tlbi50eXBlXS5ydWxlcztcbiAgICAgIHZhciBob29rcyA9IGdyYW1tYXJbcnRva2VuLnR5cGVdLmhvb2tzO1xuICAgICAgcmVzdWx0ID0gZmFsc2U7XG5cbiAgICAgIHZhciBtID0gbWVtb2l6YXRpb25bcnRva2VuLnR5cGUrJzsnK3NwXTtcbiAgICAgIGlmKG0pIHtcbiAgICAgICAgcmVzdWx0ID0gbTtcbiAgICAgIH1cblxuICAgICAgaWYoIXJlc3VsdCkge1xuICAgICAgICBmb3Ioaj0wOyBqPGV4cGFuZF9ydWxlcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgIHZhciByID0gZXhwYW5kX3J1bGVzW2pdLCBob29rID0gaG9va3Nbal07XG5cbiAgICAgICAgICByZXN1bHQgPSBtZW1vRXZhbChncmFtbWFyLCByLCBzdHJlYW0sIHNwKTtcblxuICAgICAgICAgIGlmKHJlc3VsdCkge1xuXG4gICAgICAgICAgICByZXN1bHQuaG9vayA9IGhvb2s7XG5cbiAgICAgICAgICAgIG1lbW9pemF0aW9uW3Iua2V5Kyc7JytzcF0gPSByZXN1bHQ7XG5cbiAgICAgICAgICAgIGlmKHJ0b2tlbi5yZXBlYXQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgIHZhciBuX3Jlc3VsdCA9IGdyb3dMUihncmFtbWFyLCBydWxlLCBzdHJlYW0sIHNwLCByZXN1bHQpO1xuICAgICAgICAgICAgICBpZihuX3Jlc3VsdCAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbl9yZXN1bHQ7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZihyZXN1bHQpIHtcbiAgICAgICAgc3AgPSByZXN1bHQuc3A7XG4gICAgICAgIGN1cnJlbnROb2RlLmNoaWxkcmVuLnB1c2goe1xuICAgICAgICAgICAgdHlwZTogcnRva2VuLnR5cGUsXG4gICAgICAgICAgICBjaGlsZHJlbjogcmVzdWx0LmNoaWxkcmVuLFxuICAgICAgICAgICAgc3A6cmVzdWx0LnNwLFxuICAgICAgICAgICAgbGluZTogcmVzdWx0LmxpbmUsXG4gICAgICAgICAgICBjb2x1bW46IHJlc3VsdC5jb2x1bW4sXG4gICAgICAgICAgICBob29rOiByZXN1bHQuaG9vayxcbiAgICAgICAgICAgIG5hbWU6IHJ0b2tlbi5uYW1lLFxuICAgICAgICAgICAgcmVwZWF0OiBydG9rZW4ucmVwZWF0XG4gICAgICAgICAgfSk7XG4gICAgICAgIGlmKCFjYW5SZXBlYXQocnRva2VuKSkge1xuICAgICAgICAgIHJwKys7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmKCFjYW5GYWlsKHJ0b2tlbiwgY3VycmVudE5vZGUpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJwKys7XG4gICAgICB9XG5cbiAgICAvLyBDYXNlIHR3bzogd2UgaGF2ZSBhIHByb3BlciB0b2tlblxuICAgIH0gZWxzZSB7XG4gICAgICBpZihzdG9rZW4udHlwZSA9PT0gcnRva2VuLnR5cGUpIHtcbiAgICAgICAgLy9jdXJyZW50Tm9kZS5jaGlsZHJlbi5wdXNoKGNvcHlUb2tlbihzdG9rZW4sIHJ0b2tlbikpO1xuICAgICAgICBpZighcnRva2VuLm5vbkNhcHR1cmluZykge1xuICAgICAgICAgIGN1cnJlbnROb2RlLmNoaWxkcmVuLnB1c2goY29weVRva2VuKHN0b2tlbiwgcnRva2VuKSk7XG4gICAgICAgICAgc3ArKztcbiAgICAgICAgfVxuICAgICAgICBpZighY2FuUmVwZWF0KHJ0b2tlbikpIHtcbiAgICAgICAgICBycCsrO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZighY2FuRmFpbChydG9rZW4sIGN1cnJlbnROb2RlKSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBycCsrO1xuICAgICAgfVxuXG4gICAgfVxuXG4gICAgLy8gaW5mb3JtYXRpb24gdXNlZCBmb3IgZGVidWdnaW5nIHB1cnBvc2VcbiAgICBpZihiZXN0X3AgPT09IHNwKSB7XG4gICAgICBiZXN0X3BhcnNlLmNhbmRpZGF0ZXMucHVzaChbcnVsZSwgcnVsZS50b2tlbnNbcnBdXSk7XG4gICAgfVxuICAgIGlmKGJlc3RfcCA8IHNwKSB7XG4gICAgICBiZXN0X3BhcnNlID0ge3NwOnNwLCBjYW5kaWRhdGVzOltbcnVsZSwgcnVsZS50b2tlbnNbcnBdXV19O1xuICAgICAgYmVzdF9wID0gc3A7XG4gICAgfVxuXG4gICAgLy8gZmV0Y2ggbmV4dCBydWxlIGFuZCBzdHJlYW0gdG9rZW5cbiAgICBydG9rZW4gPSBydWxlLnRva2Vuc1tycF07XG4gICAgc3Rva2VuID0gc3RyZWFtW3NwXTtcblxuICAgIC8vIHJ1bGUgc2F0aXNmaWVkXG4gICAgaWYocnRva2VuID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGN1cnJlbnROb2RlLnNwID0gc3A7XG4gICAgICBjdXJyZW50Tm9kZS5ycCA9IHJwO1xuICAgICAgcmV0dXJuIGN1cnJlbnROb2RlO1xuICAgIH1cblxuICAgIC8vIG5vIG1vcmUgdG9rZW5zXG4gICAgaWYoc3Rva2VuID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmKGNhbkZhaWwocnRva2VuLCBjdXJyZW50Tm9kZSkpIHtcbiAgICAgICAgLy8gVGhpcyBkb2VzIG5vdCBoYXBwZW4gb2Z0ZW4gYmVjYXVzZSBvZiBFT0YsXG4gICAgICAgIC8vIEFzIGl0IHN0YW5kcyB0aGUgbGFzdCB0b2tlbiBhcyBhbHdheXMgdG8gYmUgRU9GXG4gICAgICAgIGN1cnJlbnROb2RlLnNwID0gc3A7XG4gICAgICAgIGN1cnJlbnROb2RlLnJwID0gcnA7XG4gICAgICAgIHJldHVybiBjdXJyZW50Tm9kZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgfSAvLyBlbmQgcnVsZSBib2R5IGxvb3BcblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIHNwbGl0VHJpbShsLCBzcGxpdCkge1xuICByZXR1cm4gbC5zcGxpdChzcGxpdCkubWFwKGZ1bmN0aW9uKGkpeyByZXR1cm4gaS50cmltKCk7IH0pO1xufVxuXG5mdW5jdGlvbiBncmFtbWFyVG9rZW4odG9rZW4pIHtcbiAgdmFyIG5vbkNhcHR1cmluZyA9IHRva2VuLmNoYXJBdCgwKSA9PT0gJyEnO1xuICBpZihub25DYXB0dXJpbmcpIHtcbiAgICB0b2tlbiA9IHRva2VuLnN1YnN0cigxKTtcbiAgfVxuICB2YXIgcmVwZWF0ID0gdG9rZW4uY2hhckF0KHRva2VuLmxlbmd0aCAtIDEpO1xuICBpZihyZXBlYXQgPT09ICcqJyB8fCByZXBlYXQgPT09ICc/JyB8fCByZXBlYXQgPT09ICcrJykge1xuICAgIHRva2VuID0gdG9rZW4uc3Vic3RyKDAsIHRva2VuLmxlbmd0aCAtIDEpO1xuICB9IGVsc2Uge1xuICAgIHJlcGVhdCA9IGZhbHNlO1xuICB9XG4gIHZhciBuYW1lZCA9IHRva2VuLnNwbGl0KFwiOlwiKSwgdDtcbiAgaWYobmFtZWQubGVuZ3RoID09PSAyKSB7XG4gICAgdCA9IHtcbiAgICAgICd0eXBlJzogbmFtZWRbMV0sXG4gICAgICAnbmFtZScgOm5hbWVkWzBdXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICB0ID0geyd0eXBlJzogdG9rZW4gfTtcbiAgfVxuICB0LnJlcGVhdCA9IHJlcGVhdDtcbiAgaWYoKHJlcGVhdCA9PT0gJyonIHx8IHJlcGVhdCA9PT0gJysnKSAmJiBub25DYXB0dXJpbmcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbXBvc3NpYmxlIHRvIGhhdmUgbm9uIGNhcHR1cmluZyB0b2tlbiB0aGF0IHJlcGVhdHNcIik7XG4gIH1cbiAgaWYobm9uQ2FwdHVyaW5nKSB7XG4gICAgdC5ub25DYXB0dXJpbmcgPSBub25DYXB0dXJpbmc7XG4gIH1cbiAgcmV0dXJuIHQ7XG59XG5cbmZ1bmN0aW9uIGNvbXBpbGVHcmFtbWFyKGdyYW1tYXIsIHRva2VuRGVmKSB7XG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMoZ3JhbW1hciksIGksIGosIGs7XG4gIHZhciBncmFtID0ge30sIG9wdGlvbmFsLCBub25DYXB0dXJpbmc7XG5cbiAgZ3JhbS50b2tlbkRlZiA9IHRva2VuRGVmO1xuICBncmFtLnRva2VuS2V5cyA9IFtdO1xuICBncmFtLnRva2VuTWFwID0ge307XG4gIHRva2VuRGVmLm1hcChmdW5jdGlvbih0KSB7XG4gICAgZ3JhbS50b2tlbk1hcFt0LmtleV0gPSB0O1xuICAgIGdyYW0udG9rZW5LZXlzLnB1c2godC5rZXkpO1xuICB9KTtcblxuICB2YXIgYWxsVmFsaWRLZXlzID0ga2V5cy5jb25jYXQoZ3JhbS50b2tlbktleXMpO1xuXG4gIGZvcihpPTA7IGk8a2V5cy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBsaW5lID0gZ3JhbW1hcltrZXlzW2ldXTtcbiAgICB2YXIga2V5ID0ga2V5c1tpXTtcbiAgICB2YXIgcnVsZXMgPSBsaW5lLnJ1bGVzO1xuICAgIHZhciBob29rcyA9IFtdO1xuXG4gICAgdmFyIHNwbGl0dGVkX3J1bGVzID0gW107XG5cbiAgICBmb3Ioaj0wOyBqPHJ1bGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICB2YXIgdG9rZW5zID0gc3BsaXRUcmltKHJ1bGVzW2pdLCAnICcpO1xuICAgICAgb3B0aW9uYWwgPSAwO1xuICAgICAgZm9yKGs9MDsgazx0b2tlbnMubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgdmFyIHRva2VuID0gdG9rZW5zW2tdID0gZ3JhbW1hclRva2VuKHRva2Vuc1trXSk7XG4gICAgICAgIGlmKGFsbFZhbGlkS2V5cy5pbmRleE9mKHRva2VuLnR5cGUpID09PSAtMSAmJiB0b2tlbi50eXBlICE9PSAnRU9GJykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgdG9rZW4gdHlwZSB1c2VkIGluIHRoZSBncmFtbWFyIHJ1bGUgXCIra2V5K1wiOiBcIiArIHRva2VuLnR5cGUgKyAnLCB2YWxpZCB0b2tlbnMgYXJlOiAnK2FsbFZhbGlkS2V5cy5qb2luKCcsICcpKTtcbiAgICAgICAgfVxuICAgICAgICBpZih0b2tlbi5yZXBlYXQgPT09ICcqJykge1xuICAgICAgICAgIG9wdGlvbmFsICs9IDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYodG9rZW4ubm9uQ2FwdHVyaW5nKSB7XG4gICAgICAgICAgaWYodG9rZW5zW3Rva2Vucy5sZW5ndGggLSAxXSAhPSB0b2tlbnNba10pIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkEgbm9uIGNhcHR1cmluZyB0b2tlbiBjYW4gb25seSBiZSB0aGUgbGFzdCBvbmUgaW4gdGhlIHJ1bGU6IFwiICsgdG9rZW4udHlwZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZihvcHRpb25hbCA9PT0gdG9rZW5zLmxlbmd0aCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJSdWxlIFwiICsgcnVsZXNbal0gKyBcIiBvbmx5IGhhcyBvcHRpb25hbCBncmVlZHkgdG9rZW5zLlwiKTtcbiAgICAgIH1cbiAgICAgIHNwbGl0dGVkX3J1bGVzLnB1c2goe2tleToga2V5LCBpbmRleDpqLCB0b2tlbnM6dG9rZW5zfSk7XG4gICAgICBpZih0eXBlb2YgbGluZS5ob29rcyA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIGhvb2tzLnB1c2gobGluZS5ob29rcyk7XG4gICAgICB9IGVsc2UgaWYobGluZS5ob29rcykge1xuICAgICAgICBpZihsaW5lLmhvb2tzW2pdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbmNvcnJlY3QgbnVtYmVyIG9mIGhvb2tzIGFyIHJ1bGUgXCIgKyBrZXlzW2ldKTsgXG4gICAgICAgIH1cbiAgICAgICAgaG9va3MucHVzaChsaW5lLmhvb2tzW2pdKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZ3JhbVtrZXldID0ge3J1bGVzOiBzcGxpdHRlZF9ydWxlcywgaG9va3M6IGhvb2tzIHx8IFtdLCB2ZXJib3NlOmxpbmUudmVyYm9zZX07XG4gIH1cbiAgZ3JhbS5wYXJzZSA9IGZ1bmN0aW9uKHN0cmVhbSkge1xuICAgIHJldHVybiBwYXJzZShzdHJlYW0sIGdyYW0pO1xuICB9O1xuICByZXR1cm4gZ3JhbTtcbn1cblxuZnVuY3Rpb24gc3BhY2VyKG4pIHtcbiAgdmFyIG91dCA9IFwiXCI7XG4gIGZvcih2YXIgaT0wOyBpPG47IGkrKykge1xuICAgIG91dCArPSBcIiBcIjtcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiBlcnJvck1zZyhpbnB1dCwgdG9rZW4sIGVycm9yVHlwZSwgbSkge1xuXG4gIHZhciBjaGFybiA9IHRva2VuLnBvaW50ZXIgfHwgMDtcbiAgdmFyIGxpbmVzID0gaW5wdXQuc3BsaXQoXCJcXG5cIiksIGksIGNoYXJDb3VudGVyID0gMCwgY2hhck9uTGluZSA9IDA7XG5cbiAgZm9yKGk9MDsgaTxsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgIGNoYXJDb3VudGVyICs9IGxpbmVzW2ldLmxlbmd0aCArIDE7XG4gICAgaWYoY2hhckNvdW50ZXIgPj0gY2hhcm4pIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjaGFyT25MaW5lICs9IGxpbmVzW2ldLmxlbmd0aCArIDE7XG4gIH1cblxuICB2YXIgbG4gPSBNYXRoLm1heCgwLCBpKTsgLy8gbGluZSBudW1iZXJcbiAgdmFyIG1zZyA9IGVycm9yVHlwZSArIFwiIGF0IGxpbmUgXCIrKGxuKzEpK1wiIGNoYXIgXCIrIChjaGFybiAtIGNoYXJPbkxpbmUpICtcIjogXCI7XG4gIHZhciBpbmRpY2F0b3IgPSBcIlxcblwiICsgc3BhY2VyKChjaGFybiAtIGNoYXJPbkxpbmUpICsgKChsbikgKyAnOiAnKS5sZW5ndGgpO1xuXG4gIGlmKGxpbmVzW2xuLTFdICE9PSB1bmRlZmluZWQpIHtcbiAgICBtc2cgPSBtc2cgKyBcIlxcblwiICsgKGxuKSArICc6ICcgKyBsaW5lc1tsbi0xXTtcbiAgfVxuICBtc2cgPSBtc2cgKyBcIlxcblwiICsgKGxuKzEpICsgJzogJyArIGxpbmVzW2xuXSArIGluZGljYXRvcjtcbiAgbXNnID0gbXNnICsgXCJeLS0gXCIgKyBtO1xuXG4gIGlmKGxpbmVzW2xuKzFdICE9PSB1bmRlZmluZWQpIHtcbiAgICBtc2cgPSBtc2cgKyBcIlxcblwiICsgKGxuKzIpICsgJzogJyArIGxpbmVzW2xuKzFdO1xuICB9XG5cbiAgcmV0dXJuIG1zZztcbn1cblxuZnVuY3Rpb24gdmVyYm9zZU5hbWUoZ3JhbW1hciwgdHlwZSkge1xuICB2YXIgdG9rZW5kZWYgPSBncmFtbWFyLnRva2VuTWFwW3R5cGVdO1xuICBpZih0b2tlbmRlZiAmJiB0b2tlbmRlZi52ZXJib3NlKSB7XG4gICAgcmV0dXJuIHRva2VuZGVmLnZlcmJvc2U7XG4gIH1cbiAgaWYoZ3JhbW1hclt0eXBlXSAmJiBncmFtbWFyW3R5cGVdLnZlcmJvc2UpIHtcbiAgICByZXR1cm4gZ3JhbW1hclt0eXBlXS52ZXJib3NlO1xuICB9XG4gIHJldHVybiB0eXBlO1xufVxuXG5mdW5jdGlvbiBoaW50KGlucHV0LCBzdHJlYW0sIGJlc3RfcGFyc2UsIGdyYW1tYXIpIHtcbiAgaWYoIWJlc3RfcGFyc2UgfHwgIWJlc3RfcGFyc2UuY2FuZGlkYXRlc1swXSkge1xuICAgIHJldHVybiBcIkNvbXBsZXRlIGZhaWx1cmUgdG8gcGFyc2VcIjtcbiAgfVxuICB2YXIgcnVsZSA9IGJlc3RfcGFyc2UuY2FuZGlkYXRlc1swXVswXTtcblxuICB2YXIgYXJyYXkgPSBbXTtcbiAgYmVzdF9wYXJzZS5jYW5kaWRhdGVzLm1hcChmdW5jdGlvbihyKSB7XG4gICAgaWYoIXJbMV0pIHsgcmV0dXJuOyB9XG4gICAgdmFyIG5hbWUgPSB2ZXJib3NlTmFtZShncmFtbWFyLCByWzFdLnR5cGUpO1xuICAgIGlmKGFycmF5LmluZGV4T2YobmFtZSkgPT09IC0xKSB7XG4gICAgICBhcnJheS5wdXNoKG5hbWUpO1xuICAgIH1cbiAgfSk7XG4gIHZhciBjYW5kaWRhdGVzID0gYXJyYXkuam9pbignIG9yICcpO1xuXG4gIHZhciBtc2cgPSBlcnJvck1zZyhpbnB1dCwgc3RyZWFtW2Jlc3RfcGFyc2Uuc3BdLCBcIlBhcnNlciBlcnJvclwiLCBcIlJ1bGUgXCIgKyB2ZXJib3NlTmFtZShncmFtbWFyLCBydWxlLmtleSkpO1xuICBtc2cgPSBtc2cgKyBcIlxcbkV4cGVjdCBcIiArIGNhbmRpZGF0ZXM7XG4gIHZhciBsYXN0VG9rZW4gPSBzdHJlYW1bYmVzdF9wYXJzZS5zcF0gfHwge3R5cGU6XCJFT0ZcIn07XG4gIG1zZyA9IG1zZyArIFwiXFxuQnV0IGdvdCBcIiArIHZlcmJvc2VOYW1lKGdyYW1tYXIsIGxhc3RUb2tlbi50eXBlKSArIFwiIGluc3RlYWRcIjtcblxuICByZXR1cm4gbXNnO1xufVxuXG4vLyB0aG9zZSBhcmUgbW9kdWxlIGdsb2JhbHNcbnZhciBzdGFjayA9IFtdO1xudmFyIG1lbW9pemF0aW9uID0ge307XG52YXIgYmVzdF9wYXJzZSA9IG51bGw7XG52YXIgYmVzdF9wID0gMDtcblxuZnVuY3Rpb24gaG9va1RyZWUobm9kZSkge1xuICBpZighbm9kZS5jaGlsZHJlbikge1xuICAgIHJldHVybjtcbiAgfVxuICBmb3IodmFyIGk9MDsgaTxub2RlLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgaG9va1RyZWUobm9kZS5jaGlsZHJlbltpXSk7XG4gIH1cbiAgaWYobm9kZS5ob29rKSB7XG4gICAgbm9kZS5jaGlsZHJlbiA9IG5vZGUuaG9vayhjcmVhdGVQYXJhbXMobm9kZS5jaGlsZHJlbikpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHBhcnNlKGlucHV0LCBncmFtbWFyKSB7XG4gIHZhciBiZXN0UmVzdWx0ID0ge3R5cGU6J1NUQVJUJywgc3A6MCwgY29tcGxldGU6ZmFsc2V9LCBpLCByZXN1bHQsIHN0cmVhbTtcbiAgLy9pZih0eXBlb2YgaW5wdXQgPT09ICdzdHJpbmcnKSB7XG4gIHN0cmVhbSA9IHRva2VuaXplKGlucHV0LCBncmFtbWFyKTtcbiAgLy99XG4gIGJlc3RfcGFyc2UgPSB7c3A6MCwgY2FuZGlkYXRlczpbXX07XG4gIGJlc3RfcCA9IDA7XG4gIGZvcihpPTA7IGk8Z3JhbW1hci5TVEFSVC5ydWxlcy5sZW5ndGg7IGkrKykge1xuICAgIHN0YWNrID0gW107XG4gICAgbWVtb2l6YXRpb24gPSB7fTtcbiAgICByZXN1bHQgPSBtZW1vRXZhbChncmFtbWFyLCBncmFtbWFyLlNUQVJULnJ1bGVzW2ldLCBzdHJlYW0sIDApO1xuICAgIGlmKHJlc3VsdCAmJiByZXN1bHQuc3AgPiBiZXN0UmVzdWx0LnNwKSB7XG4gICAgICBiZXN0UmVzdWx0ID0ge1xuICAgICAgICB0eXBlOidTVEFSVCcsXG4gICAgICAgIGNoaWxkcmVuOnJlc3VsdC5jaGlsZHJlbixcbiAgICAgICAgc3A6IHJlc3VsdC5zcCxcbiAgICAgICAgbGluZTogMSxcbiAgICAgICAgY29sdW1uOiAxLFxuICAgICAgICBjb21wbGV0ZTpyZXN1bHQuc3AgPT09IHN0cmVhbS5sZW5ndGgsXG4gICAgICAgIGlucHV0TGVuZ3RoOnN0cmVhbS5sZW5ndGgsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuICBiZXN0UmVzdWx0LmJlc3RQYXJzZSA9IGJlc3RfcGFyc2U7XG4gIGhvb2tUcmVlKGJlc3RSZXN1bHQpO1xuICBpZihiZXN0X3BhcnNlICYmICFiZXN0UmVzdWx0LmNvbXBsZXRlKSB7XG4gICAgYmVzdFJlc3VsdC5oaW50ID0gaGludChpbnB1dCwgc3RyZWFtLCBiZXN0X3BhcnNlLCBncmFtbWFyKTtcbiAgfVxuICByZXR1cm4gYmVzdFJlc3VsdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHBhcnNlOiBwYXJzZSxcbiAgc3RhY2s6IHN0YWNrLFxuICBjb21waWxlR3JhbW1hcjogY29tcGlsZUdyYW1tYXIsXG4gIHRva2VuaXplOiB0b2tlbml6ZSxcbiAgbWVtb2l6YXRpb246IG1lbW9pemF0aW9uXG59O1xuIl19
},{}],5:[function(require,module,exports){
'use strict';

var OneVersionConstraint = require('individual/one-version');

var MY_VERSION = '7';
OneVersionConstraint('ev-store', MY_VERSION);

var hashKey = '__EV_STORE_KEY@' + MY_VERSION;

module.exports = EvStore;

function EvStore(elem) {
    var hash = elem[hashKey];

    if (!hash) {
        hash = elem[hashKey] = {};
    }

    return hash;
}

},{"individual/one-version":8}],6:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

var doccy;

if (typeof document !== 'undefined') {
    doccy = document;
} else {
    doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }
}

module.exports = doccy;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9nbG9iYWwvZG9jdW1lbnQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsidmFyIHRvcExldmVsID0gdHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgPyBnbG9iYWwgOlxuICAgIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDoge31cbnZhciBtaW5Eb2MgPSByZXF1aXJlKCdtaW4tZG9jdW1lbnQnKTtcblxudmFyIGRvY2N5O1xuXG5pZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgIGRvY2N5ID0gZG9jdW1lbnQ7XG59IGVsc2Uge1xuICAgIGRvY2N5ID0gdG9wTGV2ZWxbJ19fR0xPQkFMX0RPQ1VNRU5UX0NBQ0hFQDQnXTtcblxuICAgIGlmICghZG9jY3kpIHtcbiAgICAgICAgZG9jY3kgPSB0b3BMZXZlbFsnX19HTE9CQUxfRE9DVU1FTlRfQ0FDSEVANCddID0gbWluRG9jO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBkb2NjeTtcbiJdfQ==
},{"min-document":2}],7:[function(require,module,exports){
(function (global){
'use strict';

/*global window, global*/

var root = typeof window !== 'undefined' ?
    window : typeof global !== 'undefined' ?
    global : {};

module.exports = Individual;

function Individual(key, value) {
    if (key in root) {
        return root[key];
    }

    root[key] = value;

    return value;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9pbmRpdmlkdWFsL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbi8qZ2xvYmFsIHdpbmRvdywgZ2xvYmFsKi9cblxudmFyIHJvb3QgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/XG4gICAgd2luZG93IDogdHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgP1xuICAgIGdsb2JhbCA6IHt9O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEluZGl2aWR1YWw7XG5cbmZ1bmN0aW9uIEluZGl2aWR1YWwoa2V5LCB2YWx1ZSkge1xuICAgIGlmIChrZXkgaW4gcm9vdCkge1xuICAgICAgICByZXR1cm4gcm9vdFtrZXldO1xuICAgIH1cblxuICAgIHJvb3Rba2V5XSA9IHZhbHVlO1xuXG4gICAgcmV0dXJuIHZhbHVlO1xufVxuIl19
},{}],8:[function(require,module,exports){
'use strict';

var Individual = require('./index.js');

module.exports = OneVersion;

function OneVersion(moduleName, version, defaultValue) {
    var key = '__INDIVIDUAL_ONE_VERSION_' + moduleName;
    var enforceKey = key + '_ENFORCE_SINGLETON';

    var versionValue = Individual(enforceKey, version);

    if (versionValue !== version) {
        throw new Error('Can only have one copy of ' +
            moduleName + '.\n' +
            'You already have version ' + versionValue +
            ' installed.\n' +
            'This means you cannot install version ' + version);
    }

    return Individual(key, defaultValue);
}

},{"./index.js":7}],9:[function(require,module,exports){
"use strict";

module.exports = function isObject(x) {
	return typeof x === "object" && x !== null;
};

},{}],10:[function(require,module,exports){
var createElement = require("./vdom/create-element.js")

module.exports = createElement

},{"./vdom/create-element.js":16}],11:[function(require,module,exports){
var diff = require("./vtree/diff.js")

module.exports = diff

},{"./vtree/diff.js":36}],12:[function(require,module,exports){
var h = require("./virtual-hyperscript/index.js")

module.exports = h

},{"./virtual-hyperscript/index.js":23}],13:[function(require,module,exports){
var diff = require("./diff.js")
var patch = require("./patch.js")
var h = require("./h.js")
var create = require("./create-element.js")

module.exports = {
    diff: diff,
    patch: patch,
    h: h,
    create: create
}

},{"./create-element.js":10,"./diff.js":11,"./h.js":12,"./patch.js":14}],14:[function(require,module,exports){
var patch = require("./vdom/patch.js")

module.exports = patch

},{"./vdom/patch.js":19}],15:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook.js")

module.exports = applyProperties

function applyProperties(node, props, previous) {
    for (var propName in props) {
        var propValue = props[propName]

        if (propValue === undefined) {
            removeProperty(node, propName, propValue, previous);
        } else if (isHook(propValue)) {
            removeProperty(node, propName, propValue, previous)
            if (propValue.hook) {
                propValue.hook(node,
                    propName,
                    previous ? previous[propName] : undefined)
            }
        } else {
            if (isObject(propValue)) {
                patchObject(node, props, previous, propName, propValue);
            } else {
                node[propName] = propValue
            }
        }
    }
}

function removeProperty(node, propName, propValue, previous) {
    if (previous) {
        var previousValue = previous[propName]

        if (!isHook(previousValue)) {
            if (propName === "attributes") {
                for (var attrName in previousValue) {
                    node.removeAttribute(attrName)
                }
            } else if (propName === "style") {
                for (var i in previousValue) {
                    node.style[i] = ""
                }
            } else if (typeof previousValue === "string") {
                node[propName] = ""
            } else {
                node[propName] = null
            }
        } else if (previousValue.unhook) {
            previousValue.unhook(node, propName, propValue)
        }
    }
}

function patchObject(node, props, previous, propName, propValue) {
    var previousValue = previous ? previous[propName] : undefined

    // Set attributes
    if (propName === "attributes") {
        for (var attrName in propValue) {
            var attrValue = propValue[attrName]

            if (attrValue === undefined) {
                node.removeAttribute(attrName)
            } else {
                node.setAttribute(attrName, attrValue)
            }
        }

        return
    }

    if(previousValue && isObject(previousValue) &&
        getPrototype(previousValue) !== getPrototype(propValue)) {
        node[propName] = propValue
        return
    }

    if (!isObject(node[propName])) {
        node[propName] = {}
    }

    var replacer = propName === "style" ? "" : undefined

    for (var k in propValue) {
        var value = propValue[k]
        node[propName][k] = (value === undefined) ? replacer : value
    }
}

function getPrototype(value) {
    if (Object.getPrototypeOf) {
        return Object.getPrototypeOf(value)
    } else if (value.__proto__) {
        return value.__proto__
    } else if (value.constructor) {
        return value.constructor.prototype
    }
}

},{"../vnode/is-vhook.js":27,"is-object":9}],16:[function(require,module,exports){
var document = require("global/document")

var applyProperties = require("./apply-properties")

var isVNode = require("../vnode/is-vnode.js")
var isVText = require("../vnode/is-vtext.js")
var isWidget = require("../vnode/is-widget.js")
var handleThunk = require("../vnode/handle-thunk.js")

module.exports = createElement

function createElement(vnode, opts) {
    var doc = opts ? opts.document || document : document
    var warn = opts ? opts.warn : null

    vnode = handleThunk(vnode).a

    if (isWidget(vnode)) {
        return vnode.init()
    } else if (isVText(vnode)) {
        return doc.createTextNode(vnode.text)
    } else if (!isVNode(vnode)) {
        if (warn) {
            warn("Item is not a valid virtual dom node", vnode)
        }
        return null
    }

    var node = (vnode.namespace === null) ?
        doc.createElement(vnode.tagName) :
        doc.createElementNS(vnode.namespace, vnode.tagName)

    var props = vnode.properties
    applyProperties(node, props)

    var children = vnode.children

    for (var i = 0; i < children.length; i++) {
        var childNode = createElement(children[i], opts)
        if (childNode) {
            node.appendChild(childNode)
        }
    }

    return node
}

},{"../vnode/handle-thunk.js":25,"../vnode/is-vnode.js":28,"../vnode/is-vtext.js":29,"../vnode/is-widget.js":30,"./apply-properties":15,"global/document":6}],17:[function(require,module,exports){
// Maps a virtual DOM tree onto a real DOM tree in an efficient manner.
// We don't want to read all of the DOM nodes in the tree so we use
// the in-order tree indexing to eliminate recursion down certain branches.
// We only recurse into a DOM node if we know that it contains a child of
// interest.

var noChild = {}

module.exports = domIndex

function domIndex(rootNode, tree, indices, nodes) {
    if (!indices || indices.length === 0) {
        return {}
    } else {
        indices.sort(ascending)
        return recurse(rootNode, tree, indices, nodes, 0)
    }
}

function recurse(rootNode, tree, indices, nodes, rootIndex) {
    nodes = nodes || {}


    if (rootNode) {
        if (indexInRange(indices, rootIndex, rootIndex)) {
            nodes[rootIndex] = rootNode
        }

        var vChildren = tree.children

        if (vChildren) {

            var childNodes = rootNode.childNodes

            for (var i = 0; i < tree.children.length; i++) {
                rootIndex += 1

                var vChild = vChildren[i] || noChild
                var nextIndex = rootIndex + (vChild.count || 0)

                // skip recursion down the tree if there are no nodes down here
                if (indexInRange(indices, rootIndex, nextIndex)) {
                    recurse(childNodes[i], vChild, indices, nodes, rootIndex)
                }

                rootIndex = nextIndex
            }
        }
    }

    return nodes
}

// Binary search for an index in the interval [left, right]
function indexInRange(indices, left, right) {
    if (indices.length === 0) {
        return false
    }

    var minIndex = 0
    var maxIndex = indices.length - 1
    var currentIndex
    var currentItem

    while (minIndex <= maxIndex) {
        currentIndex = ((maxIndex + minIndex) / 2) >> 0
        currentItem = indices[currentIndex]

        if (minIndex === maxIndex) {
            return currentItem >= left && currentItem <= right
        } else if (currentItem < left) {
            minIndex = currentIndex + 1
        } else  if (currentItem > right) {
            maxIndex = currentIndex - 1
        } else {
            return true
        }
    }

    return false;
}

function ascending(a, b) {
    return a > b ? 1 : -1
}

},{}],18:[function(require,module,exports){
var applyProperties = require("./apply-properties")

var isWidget = require("../vnode/is-widget.js")
var VPatch = require("../vnode/vpatch.js")

var render = require("./create-element")
var updateWidget = require("./update-widget")

module.exports = applyPatch

function applyPatch(vpatch, domNode, renderOptions) {
    var type = vpatch.type
    var vNode = vpatch.vNode
    var patch = vpatch.patch

    switch (type) {
        case VPatch.REMOVE:
            return removeNode(domNode, vNode)
        case VPatch.INSERT:
            return insertNode(domNode, patch, renderOptions)
        case VPatch.VTEXT:
            return stringPatch(domNode, vNode, patch, renderOptions)
        case VPatch.WIDGET:
            return widgetPatch(domNode, vNode, patch, renderOptions)
        case VPatch.VNODE:
            return vNodePatch(domNode, vNode, patch, renderOptions)
        case VPatch.ORDER:
            reorderChildren(domNode, patch)
            return domNode
        case VPatch.PROPS:
            applyProperties(domNode, patch, vNode.properties)
            return domNode
        case VPatch.THUNK:
            return replaceRoot(domNode,
                renderOptions.patch(domNode, patch, renderOptions))
        default:
            return domNode
    }
}

function removeNode(domNode, vNode) {
    var parentNode = domNode.parentNode

    if (parentNode) {
        parentNode.removeChild(domNode)
    }

    destroyWidget(domNode, vNode);

    return null
}

function insertNode(parentNode, vNode, renderOptions) {
    var newNode = render(vNode, renderOptions)

    if (parentNode) {
        parentNode.appendChild(newNode)
    }

    return parentNode
}

function stringPatch(domNode, leftVNode, vText, renderOptions) {
    var newNode

    if (domNode.nodeType === 3) {
        domNode.replaceData(0, domNode.length, vText.text)
        newNode = domNode
    } else {
        var parentNode = domNode.parentNode
        newNode = render(vText, renderOptions)

        if (parentNode) {
            parentNode.replaceChild(newNode, domNode)
        }
    }

    return newNode
}

function widgetPatch(domNode, leftVNode, widget, renderOptions) {
    var updating = updateWidget(leftVNode, widget)
    var newNode

    if (updating) {
        newNode = widget.update(leftVNode, domNode) || domNode
    } else {
        newNode = render(widget, renderOptions)
    }

    var parentNode = domNode.parentNode

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    if (!updating) {
        destroyWidget(domNode, leftVNode)
    }

    return newNode
}

function vNodePatch(domNode, leftVNode, vNode, renderOptions) {
    var parentNode = domNode.parentNode
    var newNode = render(vNode, renderOptions)

    if (parentNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    return newNode
}

function destroyWidget(domNode, w) {
    if (typeof w.destroy === "function" && isWidget(w)) {
        w.destroy(domNode)
    }
}

function reorderChildren(domNode, bIndex) {
    var children = []
    var childNodes = domNode.childNodes
    var len = childNodes.length
    var i
    var reverseIndex = bIndex.reverse

    for (i = 0; i < len; i++) {
        children.push(domNode.childNodes[i])
    }

    var insertOffset = 0
    var move
    var node
    var insertNode
    var chainLength
    var insertedLength
    var nextSibling
    for (i = 0; i < len;) {
        move = bIndex[i]
        chainLength = 1
        if (move !== undefined && move !== i) {
            // try to bring forward as long of a chain as possible
            while (bIndex[i + chainLength] === move + chainLength) {
                chainLength++;
            }

            // the element currently at this index will be moved later so increase the insert offset
            if (reverseIndex[i] > i + chainLength) {
                insertOffset++
            }

            node = children[move]
            insertNode = childNodes[i + insertOffset] || null
            insertedLength = 0
            while (node !== insertNode && insertedLength++ < chainLength) {
                domNode.insertBefore(node, insertNode);
                node = children[move + insertedLength];
            }

            // the moved element came from the front of the array so reduce the insert offset
            if (move + chainLength < i) {
                insertOffset--
            }
        }

        // element at this index is scheduled to be removed so increase insert offset
        if (i in bIndex.removes) {
            insertOffset++
        }

        i += chainLength
    }
}

function replaceRoot(oldRoot, newRoot) {
    if (oldRoot && newRoot && oldRoot !== newRoot && oldRoot.parentNode) {
        console.log(oldRoot)
        oldRoot.parentNode.replaceChild(newRoot, oldRoot)
    }

    return newRoot;
}

},{"../vnode/is-widget.js":30,"../vnode/vpatch.js":33,"./apply-properties":15,"./create-element":16,"./update-widget":20}],19:[function(require,module,exports){
var document = require("global/document")
var isArray = require("x-is-array")

var domIndex = require("./dom-index")
var patchOp = require("./patch-op")
module.exports = patch

function patch(rootNode, patches) {
    return patchRecursive(rootNode, patches)
}

function patchRecursive(rootNode, patches, renderOptions) {
    var indices = patchIndices(patches)

    if (indices.length === 0) {
        return rootNode
    }

    var index = domIndex(rootNode, patches.a, indices)
    var ownerDocument = rootNode.ownerDocument

    if (!renderOptions) {
        renderOptions = { patch: patchRecursive }
        if (ownerDocument !== document) {
            renderOptions.document = ownerDocument
        }
    }

    for (var i = 0; i < indices.length; i++) {
        var nodeIndex = indices[i]
        rootNode = applyPatch(rootNode,
            index[nodeIndex],
            patches[nodeIndex],
            renderOptions)
    }

    return rootNode
}

function applyPatch(rootNode, domNode, patchList, renderOptions) {
    if (!domNode) {
        return rootNode
    }

    var newNode

    if (isArray(patchList)) {
        for (var i = 0; i < patchList.length; i++) {
            newNode = patchOp(patchList[i], domNode, renderOptions)

            if (domNode === rootNode) {
                rootNode = newNode
            }
        }
    } else {
        newNode = patchOp(patchList, domNode, renderOptions)

        if (domNode === rootNode) {
            rootNode = newNode
        }
    }

    return rootNode
}

function patchIndices(patches) {
    var indices = []

    for (var key in patches) {
        if (key !== "a") {
            indices.push(Number(key))
        }
    }

    return indices
}

},{"./dom-index":17,"./patch-op":18,"global/document":6,"x-is-array":37}],20:[function(require,module,exports){
var isWidget = require("../vnode/is-widget.js")

module.exports = updateWidget

function updateWidget(a, b) {
    if (isWidget(a) && isWidget(b)) {
        if ("name" in a && "name" in b) {
            return a.id === b.id
        } else {
            return a.init === b.init
        }
    }

    return false
}

},{"../vnode/is-widget.js":30}],21:[function(require,module,exports){
'use strict';

var EvStore = require('ev-store');

module.exports = EvHook;

function EvHook(value) {
    if (!(this instanceof EvHook)) {
        return new EvHook(value);
    }

    this.value = value;
}

EvHook.prototype.hook = function (node, propertyName) {
    var es = EvStore(node);
    var propName = propertyName.substr(3);

    es[propName] = this.value;
};

EvHook.prototype.unhook = function(node, propertyName) {
    var es = EvStore(node);
    var propName = propertyName.substr(3);

    es[propName] = undefined;
};

},{"ev-store":5}],22:[function(require,module,exports){
'use strict';

module.exports = SoftSetHook;

function SoftSetHook(value) {
    if (!(this instanceof SoftSetHook)) {
        return new SoftSetHook(value);
    }

    this.value = value;
}

SoftSetHook.prototype.hook = function (node, propertyName) {
    if (node[propertyName] !== this.value) {
        node[propertyName] = this.value;
    }
};

},{}],23:[function(require,module,exports){
'use strict';

var isArray = require('x-is-array');

var VNode = require('../vnode/vnode.js');
var VText = require('../vnode/vtext.js');
var isVNode = require('../vnode/is-vnode');
var isVText = require('../vnode/is-vtext');
var isWidget = require('../vnode/is-widget');
var isHook = require('../vnode/is-vhook');
var isVThunk = require('../vnode/is-thunk');

var parseTag = require('./parse-tag.js');
var softSetHook = require('./hooks/soft-set-hook.js');
var evHook = require('./hooks/ev-hook.js');

module.exports = h;

function h(tagName, properties, children) {
    var childNodes = [];
    var tag, props, key, namespace;

    if (!children && isChildren(properties)) {
        children = properties;
        props = {};
    }

    props = props || properties || {};
    tag = parseTag(tagName, props);

    // support keys
    if (props.hasOwnProperty('key')) {
        key = props.key;
        props.key = undefined;
    }

    // support namespace
    if (props.hasOwnProperty('namespace')) {
        namespace = props.namespace;
        props.namespace = undefined;
    }

    // fix cursor bug
    if (tag === 'INPUT' &&
        !namespace &&
        props.hasOwnProperty('value') &&
        props.value !== undefined &&
        !isHook(props.value)
    ) {
        props.value = softSetHook(props.value);
    }

    transformProperties(props);

    if (children !== undefined && children !== null) {
        addChild(children, childNodes, tag, props);
    }


    return new VNode(tag, props, childNodes, key, namespace);
}

function addChild(c, childNodes, tag, props) {
    if (typeof c === 'string') {
        childNodes.push(new VText(c));
    } else if (isChild(c)) {
        childNodes.push(c);
    } else if (isArray(c)) {
        for (var i = 0; i < c.length; i++) {
            addChild(c[i], childNodes, tag, props);
        }
    } else if (c === null || c === undefined) {
        return;
    } else {
        throw UnexpectedVirtualElement({
            foreignObject: c,
            parentVnode: {
                tagName: tag,
                properties: props
            }
        });
    }
}

function transformProperties(props) {
    for (var propName in props) {
        if (props.hasOwnProperty(propName)) {
            var value = props[propName];

            if (isHook(value)) {
                continue;
            }

            if (propName.substr(0, 3) === 'ev-') {
                // add ev-foo support
                props[propName] = evHook(value);
            }
        }
    }
}

function isChild(x) {
    return isVNode(x) || isVText(x) || isWidget(x) || isVThunk(x);
}

function isChildren(x) {
    return typeof x === 'string' || isArray(x) || isChild(x);
}

function UnexpectedVirtualElement(data) {
    var err = new Error();

    err.type = 'virtual-hyperscript.unexpected.virtual-element';
    err.message = 'Unexpected virtual child passed to h().\n' +
        'Expected a VNode / Vthunk / VWidget / string but:\n' +
        'got:\n' +
        errorString(data.foreignObject) +
        '.\n' +
        'The parent vnode is:\n' +
        errorString(data.parentVnode)
        '\n' +
        'Suggested fix: change your `h(..., [ ... ])` callsite.';
    err.foreignObject = data.foreignObject;
    err.parentVnode = data.parentVnode;

    return err;
}

function errorString(obj) {
    try {
        return JSON.stringify(obj, null, '    ');
    } catch (e) {
        return String(obj);
    }
}

},{"../vnode/is-thunk":26,"../vnode/is-vhook":27,"../vnode/is-vnode":28,"../vnode/is-vtext":29,"../vnode/is-widget":30,"../vnode/vnode.js":32,"../vnode/vtext.js":34,"./hooks/ev-hook.js":21,"./hooks/soft-set-hook.js":22,"./parse-tag.js":24,"x-is-array":37}],24:[function(require,module,exports){
'use strict';

var split = require('browser-split');

var classIdSplit = /([\.#]?[a-zA-Z0-9_:-]+)/;
var notClassId = /^\.|#/;

module.exports = parseTag;

function parseTag(tag, props) {
    if (!tag) {
        return 'DIV';
    }

    var noId = !(props.hasOwnProperty('id'));

    var tagParts = split(tag, classIdSplit);
    var tagName = null;

    if (notClassId.test(tagParts[1])) {
        tagName = 'DIV';
    }

    var classes, part, type, i;

    for (i = 0; i < tagParts.length; i++) {
        part = tagParts[i];

        if (!part) {
            continue;
        }

        type = part.charAt(0);

        if (!tagName) {
            tagName = part;
        } else if (type === '.') {
            classes = classes || [];
            classes.push(part.substring(1, part.length));
        } else if (type === '#' && noId) {
            props.id = part.substring(1, part.length);
        }
    }

    if (classes) {
        if (props.className) {
            classes.push(props.className);
        }

        props.className = classes.join(' ');
    }

    return props.namespace ? tagName : tagName.toUpperCase();
}

},{"browser-split":3}],25:[function(require,module,exports){
var isVNode = require("./is-vnode")
var isVText = require("./is-vtext")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")

module.exports = handleThunk

function handleThunk(a, b) {
    var renderedA = a
    var renderedB = b

    if (isThunk(b)) {
        renderedB = renderThunk(b, a)
    }

    if (isThunk(a)) {
        renderedA = renderThunk(a, null)
    }

    return {
        a: renderedA,
        b: renderedB
    }
}

function renderThunk(thunk, previous) {
    var renderedThunk = thunk.vnode

    if (!renderedThunk) {
        renderedThunk = thunk.vnode = thunk.render(previous)
    }

    if (!(isVNode(renderedThunk) ||
            isVText(renderedThunk) ||
            isWidget(renderedThunk))) {
        throw new Error("thunk did not return a valid node");
    }

    return renderedThunk
}

},{"./is-thunk":26,"./is-vnode":28,"./is-vtext":29,"./is-widget":30}],26:[function(require,module,exports){
module.exports = isThunk

function isThunk(t) {
    return t && t.type === "Thunk"
}

},{}],27:[function(require,module,exports){
module.exports = isHook

function isHook(hook) {
    return hook &&
      (typeof hook.hook === "function" && !hook.hasOwnProperty("hook") ||
       typeof hook.unhook === "function" && !hook.hasOwnProperty("unhook"))
}

},{}],28:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualNode

function isVirtualNode(x) {
    return x && x.type === "VirtualNode" && x.version === version
}

},{"./version":31}],29:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualText

function isVirtualText(x) {
    return x && x.type === "VirtualText" && x.version === version
}

},{"./version":31}],30:[function(require,module,exports){
module.exports = isWidget

function isWidget(w) {
    return w && w.type === "Widget"
}

},{}],31:[function(require,module,exports){
module.exports = "1"

},{}],32:[function(require,module,exports){
var version = require("./version")
var isVNode = require("./is-vnode")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")
var isVHook = require("./is-vhook")

module.exports = VirtualNode

var noProperties = {}
var noChildren = []

function VirtualNode(tagName, properties, children, key, namespace) {
    this.tagName = tagName
    this.properties = properties || noProperties
    this.children = children || noChildren
    this.key = key != null ? String(key) : undefined
    this.namespace = (typeof namespace === "string") ? namespace : null

    var count = (children && children.length) || 0
    var descendants = 0
    var hasWidgets = false
    var hasThunks = false
    var descendantHooks = false
    var hooks

    for (var propName in properties) {
        if (properties.hasOwnProperty(propName)) {
            var property = properties[propName]
            if (isVHook(property) && property.unhook) {
                if (!hooks) {
                    hooks = {}
                }

                hooks[propName] = property
            }
        }
    }

    for (var i = 0; i < count; i++) {
        var child = children[i]
        if (isVNode(child)) {
            descendants += child.count || 0

            if (!hasWidgets && child.hasWidgets) {
                hasWidgets = true
            }

            if (!hasThunks && child.hasThunks) {
                hasThunks = true
            }

            if (!descendantHooks && (child.hooks || child.descendantHooks)) {
                descendantHooks = true
            }
        } else if (!hasWidgets && isWidget(child)) {
            if (typeof child.destroy === "function") {
                hasWidgets = true
            }
        } else if (!hasThunks && isThunk(child)) {
            hasThunks = true;
        }
    }

    this.count = count + descendants
    this.hasWidgets = hasWidgets
    this.hasThunks = hasThunks
    this.hooks = hooks
    this.descendantHooks = descendantHooks
}

VirtualNode.prototype.version = version
VirtualNode.prototype.type = "VirtualNode"

},{"./is-thunk":26,"./is-vhook":27,"./is-vnode":28,"./is-widget":30,"./version":31}],33:[function(require,module,exports){
var version = require("./version")

VirtualPatch.NONE = 0
VirtualPatch.VTEXT = 1
VirtualPatch.VNODE = 2
VirtualPatch.WIDGET = 3
VirtualPatch.PROPS = 4
VirtualPatch.ORDER = 5
VirtualPatch.INSERT = 6
VirtualPatch.REMOVE = 7
VirtualPatch.THUNK = 8

module.exports = VirtualPatch

function VirtualPatch(type, vNode, patch) {
    this.type = Number(type)
    this.vNode = vNode
    this.patch = patch
}

VirtualPatch.prototype.version = version
VirtualPatch.prototype.type = "VirtualPatch"

},{"./version":31}],34:[function(require,module,exports){
var version = require("./version")

module.exports = VirtualText

function VirtualText(text) {
    this.text = String(text)
}

VirtualText.prototype.version = version
VirtualText.prototype.type = "VirtualText"

},{"./version":31}],35:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook")

module.exports = diffProps

function diffProps(a, b) {
    var diff

    for (var aKey in a) {
        if (!(aKey in b)) {
            diff = diff || {}
            diff[aKey] = undefined
        }

        var aValue = a[aKey]
        var bValue = b[aKey]

        if (aValue === bValue) {
            continue
        } else if (isObject(aValue) && isObject(bValue)) {
            if (getPrototype(bValue) !== getPrototype(aValue)) {
                diff = diff || {}
                diff[aKey] = bValue
            } else if (isHook(bValue)) {
                 diff = diff || {}
                 diff[aKey] = bValue
            } else {
                var objectDiff = diffProps(aValue, bValue)
                if (objectDiff) {
                    diff = diff || {}
                    diff[aKey] = objectDiff
                }
            }
        } else {
            diff = diff || {}
            diff[aKey] = bValue
        }
    }

    for (var bKey in b) {
        if (!(bKey in a)) {
            diff = diff || {}
            diff[bKey] = b[bKey]
        }
    }

    return diff
}

function getPrototype(value) {
  if (Object.getPrototypeOf) {
    return Object.getPrototypeOf(value)
  } else if (value.__proto__) {
    return value.__proto__
  } else if (value.constructor) {
    return value.constructor.prototype
  }
}

},{"../vnode/is-vhook":27,"is-object":9}],36:[function(require,module,exports){
var isArray = require("x-is-array")

var VPatch = require("../vnode/vpatch")
var isVNode = require("../vnode/is-vnode")
var isVText = require("../vnode/is-vtext")
var isWidget = require("../vnode/is-widget")
var isThunk = require("../vnode/is-thunk")
var handleThunk = require("../vnode/handle-thunk")

var diffProps = require("./diff-props")

module.exports = diff

function diff(a, b) {
    var patch = { a: a }
    walk(a, b, patch, 0)
    return patch
}

function walk(a, b, patch, index) {
    if (a === b) {
        return
    }

    var apply = patch[index]
    var applyClear = false

    if (isThunk(a) || isThunk(b)) {
        thunks(a, b, patch, index)
    } else if (b == null) {

        // If a is a widget we will add a remove patch for it
        // Otherwise any child widgets/hooks must be destroyed.
        // This prevents adding two remove patches for a widget.
        if (!isWidget(a)) {
            clearState(a, patch, index)
            apply = patch[index]
        }

        apply = appendPatch(apply, new VPatch(VPatch.REMOVE, a, b))
    } else if (isVNode(b)) {
        if (isVNode(a)) {
            if (a.tagName === b.tagName &&
                a.namespace === b.namespace &&
                a.key === b.key) {
                var propsPatch = diffProps(a.properties, b.properties)
                if (propsPatch) {
                    apply = appendPatch(apply,
                        new VPatch(VPatch.PROPS, a, propsPatch))
                }
                apply = diffChildren(a, b, patch, apply, index)
            } else {
                apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
                applyClear = true
            }
        } else {
            apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
            applyClear = true
        }
    } else if (isVText(b)) {
        if (!isVText(a)) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
            applyClear = true
        } else if (a.text !== b.text) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
        }
    } else if (isWidget(b)) {
        if (!isWidget(a)) {
            applyClear = true;
        }

        apply = appendPatch(apply, new VPatch(VPatch.WIDGET, a, b))
    }

    if (apply) {
        patch[index] = apply
    }

    if (applyClear) {
        clearState(a, patch, index)
    }
}

function diffChildren(a, b, patch, apply, index) {
    var aChildren = a.children
    var bChildren = reorder(aChildren, b.children)

    var aLen = aChildren.length
    var bLen = bChildren.length
    var len = aLen > bLen ? aLen : bLen

    for (var i = 0; i < len; i++) {
        var leftNode = aChildren[i]
        var rightNode = bChildren[i]
        index += 1

        if (!leftNode) {
            if (rightNode) {
                // Excess nodes in b need to be added
                apply = appendPatch(apply,
                    new VPatch(VPatch.INSERT, null, rightNode))
            }
        } else {
            walk(leftNode, rightNode, patch, index)
        }

        if (isVNode(leftNode) && leftNode.count) {
            index += leftNode.count
        }
    }

    if (bChildren.moves) {
        // Reorder nodes last
        apply = appendPatch(apply, new VPatch(VPatch.ORDER, a, bChildren.moves))
    }

    return apply
}

function clearState(vNode, patch, index) {
    // TODO: Make this a single walk, not two
    unhook(vNode, patch, index)
    destroyWidgets(vNode, patch, index)
}

// Patch records for all destroyed widgets must be added because we need
// a DOM node reference for the destroy function
function destroyWidgets(vNode, patch, index) {
    if (isWidget(vNode)) {
        if (typeof vNode.destroy === "function") {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(VPatch.REMOVE, vNode, null)
            )
        }
    } else if (isVNode(vNode) && (vNode.hasWidgets || vNode.hasThunks)) {
        var children = vNode.children
        var len = children.length
        for (var i = 0; i < len; i++) {
            var child = children[i]
            index += 1

            destroyWidgets(child, patch, index)

            if (isVNode(child) && child.count) {
                index += child.count
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

// Create a sub-patch for thunks
function thunks(a, b, patch, index) {
    var nodes = handleThunk(a, b);
    var thunkPatch = diff(nodes.a, nodes.b)
    if (hasPatches(thunkPatch)) {
        patch[index] = new VPatch(VPatch.THUNK, null, thunkPatch)
    }
}

function hasPatches(patch) {
    for (var index in patch) {
        if (index !== "a") {
            return true;
        }
    }

    return false;
}

// Execute hooks when two nodes are identical
function unhook(vNode, patch, index) {
    if (isVNode(vNode)) {
        if (vNode.hooks) {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(
                    VPatch.PROPS,
                    vNode,
                    undefinedKeys(vNode.hooks)
                )
            )
        }

        if (vNode.descendantHooks || vNode.hasThunks) {
            var children = vNode.children
            var len = children.length
            for (var i = 0; i < len; i++) {
                var child = children[i]
                index += 1

                unhook(child, patch, index)

                if (isVNode(child) && child.count) {
                    index += child.count
                }
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

function undefinedKeys(obj) {
    var result = {}

    for (var key in obj) {
        result[key] = undefined
    }

    return result
}

// List diff, naive left to right reordering
function reorder(aChildren, bChildren) {

    var bKeys = keyIndex(bChildren)

    if (!bKeys) {
        return bChildren
    }

    var aKeys = keyIndex(aChildren)

    if (!aKeys) {
        return bChildren
    }

    var bMatch = {}, aMatch = {}

    for (var aKey in bKeys) {
        bMatch[bKeys[aKey]] = aKeys[aKey]
    }

    for (var bKey in aKeys) {
        aMatch[aKeys[bKey]] = bKeys[bKey]
    }

    var aLen = aChildren.length
    var bLen = bChildren.length
    var len = aLen > bLen ? aLen : bLen
    var shuffle = []
    var freeIndex = 0
    var i = 0
    var moveIndex = 0
    var moves = {}
    var removes = moves.removes = {}
    var reverse = moves.reverse = {}
    var hasMoves = false

    while (freeIndex < len) {
        var move = aMatch[i]
        if (move !== undefined) {
            shuffle[i] = bChildren[move]
            if (move !== moveIndex) {
                moves[move] = moveIndex
                reverse[moveIndex] = move
                hasMoves = true
            }
            moveIndex++
        } else if (i in aMatch) {
            shuffle[i] = undefined
            removes[i] = moveIndex++
            hasMoves = true
        } else {
            while (bMatch[freeIndex] !== undefined) {
                freeIndex++
            }

            if (freeIndex < len) {
                var freeChild = bChildren[freeIndex]
                if (freeChild) {
                    shuffle[i] = freeChild
                    if (freeIndex !== moveIndex) {
                        hasMoves = true
                        moves[freeIndex] = moveIndex
                        reverse[moveIndex] = freeIndex
                    }
                    moveIndex++
                }
                freeIndex++
            }
        }
        i++
    }

    if (hasMoves) {
        shuffle.moves = moves
    }

    return shuffle
}

function keyIndex(children) {
    var i, keys

    for (i = 0; i < children.length; i++) {
        var child = children[i]

        if (child.key !== undefined) {
            keys = keys || {}
            keys[child.key] = i
        }
    }

    return keys
}

function appendPatch(apply, patch) {
    if (apply) {
        if (isArray(apply)) {
            apply.push(patch)
        } else {
            apply = [apply, patch]
        }

        return apply
    } else {
        return patch
    }
}

},{"../vnode/handle-thunk":25,"../vnode/is-thunk":26,"../vnode/is-vnode":28,"../vnode/is-vtext":29,"../vnode/is-widget":30,"../vnode/vpatch":33,"./diff-props":35,"x-is-array":37}],37:[function(require,module,exports){
var nativeIsArray = Array.isArray
var toString = Object.prototype.toString

module.exports = nativeIsArray || isArray

function isArray(obj) {
    return toString.call(obj) === "[object Array]"
}

},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb2tlc2NyaXB0LmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXItcmVzb2x2ZS9lbXB0eS5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyLXNwbGl0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2VwZWdqcy9kaXN0L0VQRUcuanMiLCJub2RlX21vZHVsZXMvZXYtc3RvcmUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZ2xvYmFsL2RvY3VtZW50LmpzIiwibm9kZV9tb2R1bGVzL2luZGl2aWR1YWwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvaW5kaXZpZHVhbC9vbmUtdmVyc2lvbi5qcyIsIm5vZGVfbW9kdWxlcy9pcy1vYmplY3QvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vY3JlYXRlLWVsZW1lbnQuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vZGlmZi5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9oLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3BhdGNoLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zkb20vYXBwbHktcHJvcGVydGllcy5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92ZG9tL2NyZWF0ZS1lbGVtZW50LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zkb20vZG9tLWluZGV4LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zkb20vcGF0Y2gtb3AuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmRvbS9wYXRjaC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92ZG9tL3VwZGF0ZS13aWRnZXQuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmlydHVhbC1oeXBlcnNjcmlwdC9ob29rcy9ldi1ob29rLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3ZpcnR1YWwtaHlwZXJzY3JpcHQvaG9va3Mvc29mdC1zZXQtaG9vay5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92aXJ0dWFsLWh5cGVyc2NyaXB0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3ZpcnR1YWwtaHlwZXJzY3JpcHQvcGFyc2UtdGFnLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL2hhbmRsZS10aHVuay5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS9pcy10aHVuay5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS9pcy12aG9vay5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS9pcy12bm9kZS5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS9pcy12dGV4dC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS9pcy13aWRnZXQuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdm5vZGUvdmVyc2lvbi5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS92bm9kZS5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS92cGF0Y2guanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdm5vZGUvdnRleHQuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdnRyZWUvZGlmZi1wcm9wcy5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92dHJlZS9kaWZmLmpzIiwibm9kZV9tb2R1bGVzL3gtaXMtYXJyYXkvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbitCQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4aUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDblVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgZXBlZ2pzLCB2aXJ0dWFsLCBoLCBkZXB0aCwgZm9yTG9vcENvdW50LCB1bnBhY2tpbmcsIG5hbWVzcGFjZXMsIGxldmVsU3RhY2ssIHByZWZpeCwgdG9rZW5EZWYsIHN0ckludGVycG9sYXRpb25Ub2tlbkRlZiwgc3RySW50ZXJwb2xhdGlvbkdyYW1tYXJEZWYsIHN0ckdyYW0sIGdyYW1tYXJEZWYsIG5jLCBiYWNrZW5kLCBncmFtO1xuLy8gQ29rZVNjcmlwdCBsYW5ndWFnZSBieSBCYXRpc3RlIEJpZWxlciAyMDE1XG4vLyBJbXBsZW1lbnRlZCB1c2luZyBFUEVHLkpTLCB2MC4wLjhcblxuZXBlZ2pzID0gcmVxdWlyZShcImVwZWdqc1wiKTtcbnZpcnR1YWwgPSByZXF1aXJlKFwidmlydHVhbC1kb21cIik7XG5oID0gdmlydHVhbC5jcmVhdGU7XG5cbmRlcHRoID0gMDtcbmZvckxvb3BDb3VudCA9IDE7XG51bnBhY2tpbmcgPSAwO1xubmFtZXNwYWNlcyA9IFt7fV07XG5sZXZlbFN0YWNrID0gWzBdO1xucHJlZml4ID0gJ19fJztcblxuZnVuY3Rpb24gY3VycmVudE5zKCkge1xuICByZXR1cm4gbmFtZXNwYWNlc1tuYW1lc3BhY2VzLmxlbmd0aCAtIDFdO1xufVxuXG5mdW5jdGlvbiBjdXJyZW50TnNIYXMocCkge1xuICByZXR1cm4gbmFtZXNwYWNlc1tuYW1lc3BhY2VzLmxlbmd0aCAtIDFdLmhhc093blByb3BlcnR5KHApO1xufVxuXG5mdW5jdGlvbiBuZXdOcygpIHtcbiAgbmFtZXNwYWNlcy5wdXNoKHt9KTtcbiAgcmV0dXJuIG5hbWVzcGFjZXNbbmFtZXNwYWNlcy5sZW5ndGggLSAxXTtcbn1cblxuZnVuY3Rpb24gcmVzZXRHbG9iYWwoKSB7XG4gIG5hbWVzcGFjZXMgPSBbe31dO1xuICBmb3JMb29wQ291bnQgPSAxO1xuICBsZXZlbFN0YWNrID0gWzBdO1xuICBkZXB0aCA9IDA7XG4gIHVucGFja2luZyA9IDA7XG59XG5cbi8vIHRva2VuIGFyZSBtYXRjaGVkIGluIG9yZGVyIG9mIGRlY2xhcmF0aW9uO1xuLy8gVE9ETzogYWRkIGZ1bmN0aW9uc1xuXG50b2tlbkRlZiA9IFtcbiAge2tleTogXCJzdHJpbmdcIiwgZnVuYzogc3RyaW5nRGVmfSxcbiAge2tleTogXCJjb21tZW50XCIsIGZ1bmM6IGNvbW1lbnREZWZ9LFxuICB7a2V5OiBcImZ1bmN0aW9uX2RlZlwiLCBmdW5jOiBkZWZEZWYsIHZlcmJvc2U6IFwiZnVuY3Rpb25cIn0sXG4gIHtrZXk6IFwiY2xhc3NcIiwgcmVnOiAvXmNsYXNzIC99LFxuICB7a2V5OiBcInJldFwiLCByZWc6IC9ecmV0dXJuLywgdmVyYm9zZTogXCJyZXR1cm5cIn0sXG4gIHtrZXk6IFwiaWZcIiwgcmVnOiAvXmlmIC99LFxuICB7a2V5OiBcIm9yXCIsIHJlZzogL15vciAvfSxcbiAge2tleTogXCJhbmRcIiwgcmVnOiAvXmFuZCAvfSxcbiAge2tleTogXCJ3aGlsZVwiLCByZWc6IC9ed2hpbGUgL30sXG4gIHtrZXk6IFwiaW5zdGFuY2VvZlwiLCByZWc6IC9eaW5zdGFuY2VvZiAvfSxcbiAge2tleTogXCJ0cnlcIiwgcmVnOiAvXnRyeS99LFxuICB7a2V5OiBcImNhdGNoXCIsIHJlZzogL15jYXRjaC99LFxuICB7a2V5OiBcInRocm93XCIsIHJlZzogL150aHJvdyAvfSxcbiAge2tleTogXCJwYXp6XCIsIHJlZzogL15wYXNzLywgdmVyYm9zZTogXCJwYXNzXCJ9LFxuICB7a2V5OiBcIm5ld1wiLCByZWc6IC9ebmV3IC99LFxuICB7a2V5OiBcInRhZ1wiLCByZWc6IC9ePFthLXpBLVpdWzAtOWEtekEtWl17MCwyOX0vfSxcbiAge2tleTogXCI+XCIsIHJlZzogL14+L30sXG4gIHtrZXk6IFwiZWxzZWlmXCIsIHJlZzogL15lbHNlaWYgL30sXG4gIHtrZXk6IFwiZWxzZVwiLCByZWc6IC9eZWxzZS99LFxuICB7a2V5OiBcImZvcl9sb29wXCIsIHJlZzogL15mb3IgLywgdmVyYm9zZTogXCJmb3IgbG9vcFwifSxcbiAge2tleTogXCJpblwiLCByZWc6IC9eaW4gL30sXG4gIHtrZXk6IFwibm90XCIsIHJlZzogL15ub3QgLywgdmVyYm9zZTogXCJub3RcIn0sXG4gIHtrZXk6IFwibmFtZVwiLCByZWc6IC9eW2EtekEtWl8kXShbMC05YS16QS1aXyRcXC1dezAsMjh9WzAtOWEtekEtWl8kXSk/L30sXG4gIHtrZXk6IFwicmVnZXhwXCIsIGZ1bmM6IHJlZ0V4cERlZiwgdmVyYm9zZTogXCJyZWd1bGFyIGV4cHJlc3Npb25cIn0sXG4gIHtrZXk6IFwibWF0aF9vcGVyYXRvcnNcIiwgcmVnOiAvXihcXCtcXCt8XFwtXFwtKS8sIHZlcmJvc2U6IFwibWF0aCBvcGVyYXRvclwifSxcbiAge2tleTogXCJiaW5hcnlfb3BlcmF0b3JzXCIsIHJlZzogL14oXFwmXFwmfFxcfFxcfHxcXCZ8XFx8fDw8fFxcPlxcPikvLCB2ZXJib3NlOiBcImJpbmFyeSBvcGVyYXRvclwifSxcbiAge2tleTogXCJjb21wYXJpc29uXCIsIHJlZzogL14oPD18Pj18PHw+fCE9fD09KS99LFxuICB7a2V5OiBcImFzc2lnblwiLCByZWc6IC9eKFxcKz18LT18PXw6PSkvfSxcbiAge2tleTogXCJudW1iZXJcIiwgcmVnOiAvXlstXT9bMC05XStcXC4/WzAtOV0qL30sXG4gIHtrZXk6IFwiY29tbWFcIiwgcmVnOiAvXlxcLC99LFxuICB7a2V5OiBcImRvdFwiLCByZWc6IC9eXFwuL30sXG4gIHtrZXk6IFwiY29sb25cIiwgcmVnOiAvXlxcOi8sIHZlcmJvc2U6IFwiOlwifSxcbiAge2tleTogXCJvcGVuX3BhclwiLCByZWc6IC9eXFwoLywgdmVyYm9zZTogXCIoXCJ9LFxuICB7a2V5OiBcImNsb3NlX3BhclwiLCByZWc6IC9eXFwpLywgdmVyYm9zZTogXCIpXCJ9LFxuICB7a2V5OiBcIm9wZW5fYnJhXCIsIHJlZzogL15cXFsvLCB2ZXJib3NlOiBcIltcIn0sXG4gIHtrZXk6IFwiY2xvc2VfYnJhXCIsIHJlZzogL15cXF0vLCB2ZXJib3NlOiBcIl1cIn0sXG4gIHtrZXk6IFwib3Blbl9jdXJseVwiLCByZWc6IC9eXFx7LywgdmVyYm9zZTogXCJ7XCJ9LFxuICB7a2V5OiBcImNsb3NlX2N1cmx5XCIsIHJlZzogL15cXH0vLCB2ZXJib3NlOiBcIn1cIn0sXG4gIHtrZXk6IFwibWF0aFwiLCByZWc6IC9eWy18XFwrfFxcKnxcXC98JV0vfSxcbiAge2tleTogXCJzYW1lZGVudFwiLCBmdW5jOiBkZW50KFwic2FtZWRlbnRcIiksIHZlcmJvc2U6IFwic2FtZSBpbmRlbnRhdGlvblwifSxcbiAge2tleTogXCJkZWRlbnRcIiwgZnVuYzogZGVudChcImRlZGVudFwiKX0sXG4gIHtrZXk6IFwiaW5kZW50XCIsIGZ1bmM6IGRlbnQoXCJpbmRlbnRcIil9LFxuICB7a2V5OiBcIldcIiwgcmVnOiAvXlsgXS8sIHZlcmJvc2U6IFwic2luZ2xlIHdoaXRlc3BhY2VcIn1cbl07XG5cbmZ1bmN0aW9uIHN0YXJ0U3RyKGlucHV0LHN0cmVhbSkge1xuICB2YXIgbGFzdDtcbiAgbGFzdCA9IHN0cmVhbVtzdHJlYW0ubGVuZ3RoIC0gMV07XG4gIGlmKGxhc3QgJiYgbGFzdC52YWx1ZSA9PT0gXCJcXFxcXCIpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYoaW5wdXQubWF0Y2goL14jey8pKSB7XG4gICAgcmV0dXJuIFwiI3tcIjtcbiAgfVxufVxuXG5zdHJJbnRlcnBvbGF0aW9uVG9rZW5EZWYgPSBbXG4gIHtrZXk6IFwic3RhcnRcIiwgZnVuYzogc3RhcnRTdHJ9LFxuICB7a2V5OiBcImVuZFwiLCByZWc6IC9efS99LFxuICB7a2V5OiBcIm5hbWVcIiwgcmVnOiAvXlthLXpBLVpfJF1bMC05YS16QS1aX117MCwyOX0vfSxcbiAge2tleTogXCJkb3RcIiwgcmVnOiAvXlxcLi99LFxuICB7a2V5OiBcImNoYXJcIiwgcmVnOiAvXi4vfVxuXTtcblxuc3RySW50ZXJwb2xhdGlvbkdyYW1tYXJEZWYgPSB7XG4gIFNUQVJUOiB7cnVsZXM6IFtcIkVMKiBFT0ZcIl19LCBFTDoge3J1bGVzOiBbXCJWQVJcIiwgXCJjaGFyXCIsIFwibmFtZVwiLCBcInN0YXJ0XCIsIFwiZW5kXCIsIFwiZG90XCJdfSwgVkFSOiB7cnVsZXM6IFtcInN0YXJ0IE5BTUUgZW5kXCJdfSwgTkFNRToge3J1bGVzOiBbXCJuYW1lIGRvdCBOQU1FXCIsIFwibmFtZVwiXX1cbn07XG5cbnN0ckdyYW0gPSBlcGVnanMuY29tcGlsZUdyYW1tYXIoc3RySW50ZXJwb2xhdGlvbkdyYW1tYXJEZWYsIHN0ckludGVycG9sYXRpb25Ub2tlbkRlZik7XG5cbmZ1bmN0aW9uIGdlbmVyYXRlU3RyaW5nQ29kZShub2RlLGMpIHtcbiAgdmFyIHN0ciwgX19pbmRleDEsIF9fa2V5czEsIGNoaWxkO1xuICBpZihub2RlLnR5cGUgPT09ICdWQVInKSB7XG4gICAgcmV0dXJuIGMgKyAnICsgJyArIGdlbmVyYXRlU3RyaW5nQ29kZShub2RlLmNoaWxkcmVuWzFdLCBjKSArICcgKyAnICsgYztcbiAgfVxuICBcbiAgaWYobm9kZS52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG5vZGUudmFsdWU7XG4gIH1cbiAgXG4gIHN0ciA9ICcnO1xuICBpZighbm9kZS5jaGlsZHJlbikge1xuICAgIHJldHVybiAnJztcbiAgfVxuICBcbiAgX19rZXlzMSA9IE9iamVjdC5rZXlzKG5vZGUuY2hpbGRyZW4pO1xuICBmb3IoX19pbmRleDEgPSAwOyBfX2luZGV4MSA8IF9fa2V5czEubGVuZ3RoOyBfX2luZGV4MSsrKSB7XG4gICAgY2hpbGQgPSBub2RlLmNoaWxkcmVuW19fa2V5czFbX19pbmRleDFdXTtcbiAgICBzdHIgKz0gZ2VuZXJhdGVTdHJpbmdDb2RlKGNoaWxkLCBjKTtcbiAgfVxuICByZXR1cm4gc3RyO1xufVxuXG5mdW5jdGlvbiBjdXJyZW50TGV2ZWwoKSB7XG4gIHJldHVybiBsZXZlbFN0YWNrW2xldmVsU3RhY2subGVuZ3RoIC0gMV07XG59XG5cbmZ1bmN0aW9uIGluZGVudFR5cGUobCkge1xuICBpZihsID4gY3VycmVudExldmVsKCkpIHtcbiAgICByZXR1cm4gJ2luZGVudCc7XG4gIH1cbiAgXG4gIGlmKGwgPCBjdXJyZW50TGV2ZWwoKSkge1xuICAgIHJldHVybiAnZGVkZW50JztcbiAgfVxuICBcbiAgaWYobCA9PT0gY3VycmVudExldmVsKCkpIHtcbiAgICByZXR1cm4gJ3NhbWVkZW50JztcbiAgfVxufVxuXG5mdW5jdGlvbiBkZW50KGRlbnRUeXBlKSB7XG4gIHJldHVybiBmdW5jdGlvbiBfZGVudChpbnB1dCkge1xuICAgIHZhciBtLCBsaW5lcywgaW5kZW50O1xuICAgIC8vIGVtcHR5IGxpbmUgaXMgYSBzYW1lZGVudFxuICAgIG0gPSBpbnB1dC5tYXRjaCgvXlxcbltcXHNdKi8pO1xuICAgIGlmKG0pIHtcbiAgICAgIGxpbmVzID0gbVswXS5zcGxpdChcIlxcblwiKTtcbiAgICAgIGluZGVudCA9IGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdLmxlbmd0aDtcbiAgICAgIGlmKGluZGVudFR5cGUoaW5kZW50KSA9PT0gZGVudFR5cGUpIHtcbiAgICAgICAgaWYoZGVudFR5cGUgPT09ICdkZWRlbnQnKSB7XG4gICAgICAgICAgbGV2ZWxTdGFjay5wb3AoKTtcbiAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmKGRlbnRUeXBlID09PSAnaW5kZW50Jykge1xuICAgICAgICAgIGxldmVsU3RhY2sucHVzaChpbmRlbnQpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gbVswXTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG5cbmZ1bmN0aW9uIHN0cmluZ0RlZihpbnB1dCkge1xuICB2YXIgZmlyc3QsIGksIGNoO1xuICBmaXJzdCA9IGlucHV0LmNoYXJBdCgwKTtcbiAgaWYoZmlyc3QgPT09ICdcIicgfHwgZmlyc3QgPT09IFwiJ1wiKSB7XG4gICAgaSA9IDE7XG4gICAgd2hpbGUoaW5wdXQuY2hhckF0KGkpKXtcbiAgICAgIGNoID0gaW5wdXQuY2hhckF0KGkpO1xuICAgICAgaWYoY2ggPT09ICdcXFxcJykge1xuICAgICAgICBpKys7XG4gICAgICB9IGVsc2UgaWYoY2ggPT09IGZpcnN0KSB7XG4gICAgICAgIHJldHVybiBpbnB1dC5zbGljZSgwLCBpICsgMSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHJlZ0V4cERlZihpbnB1dCkge1xuICB2YXIgaSwgY2g7XG4gIGlmKGlucHV0LmNoYXJBdCgwKSA9PT0gJy8nKSB7XG4gICAgaSA9IDE7XG4gICAgd2hpbGUoaW5wdXQuY2hhckF0KGkpKXtcbiAgICAgIGNoID0gaW5wdXQuY2hhckF0KGkpO1xuICAgICAgaWYoY2ggPT09ICdcXFxcJykge1xuICAgICAgICBpKys7XG4gICAgICB9IGVsc2UgaWYoY2ggPT09ICcvJykge1xuICAgICAgICBpKys7XG4gICAgICAgIC8vIG1vZGlmaWVyc1xuICAgICAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkgJiYgXCJpZ21cIi5pbmRleE9mKGlucHV0LmNoYXJBdChpKSkgIT09IC0xKXtcbiAgICAgICAgICBpKys7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGlucHV0LnNsaWNlKDAsIGkpO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBkZWZEZWYoaW5wdXQpIHtcbiAgaWYoaW5wdXQubWF0Y2goL15kZWZbXFwofCB8XFxuXS8pKSB7XG4gICAgcmV0dXJuIFwiZGVmXCI7XG4gIH1cbiAgXG4gIGlmKGlucHV0LmluZGV4T2YoXCJkb20gXCIpID09PSAwKSB7XG4gICAgcmV0dXJuIFwiZG9tXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tbWVudERlZihpbnB1dCkge1xuICB2YXIgbSwgaSwgY2g7XG4gIG0gPSBpbnB1dC5tYXRjaCgvXiMvKTtcbiAgaWYobSkge1xuICAgIGkgPSBtWzBdLmxlbmd0aDtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpe1xuICAgICAgY2ggPSBpbnB1dC5jaGFyQXQoaSk7XG4gICAgICBpZihjaCA9PT0gJ1xcbicpIHtcbiAgICAgICAgcmV0dXJuIGlucHV0LnNsaWNlKDAsIGkpO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiByZWZsZWN0KHBhcmFtcykgeyByZXR1cm4gcGFyYW1zOyB9XG5cbmdyYW1tYXJEZWYgPSB7XG4gIFNUQVJUOiB7cnVsZXM6IFtcIkxJTkUqIEVPRlwiXX0sIEVMQzoge3J1bGVzOiBbXCJXKiBjb21tZW50XCJdLCB2ZXJib3NlOiBcImNvbW1lbnRcIn0sIExJTkU6IHtydWxlczogW1wiU1RBVEVNRU5UIEVMQz8gc2FtZWRlbnQrXCIsIFwiU1RBVEVNRU5UIEVMQz8gIWRlZGVudFwiLCBcbiAgICBcIkVMQz8gc2FtZWRlbnRcIiwgXCJFTEMgIWRlZGVudFwiXSwgdmVyYm9zZTogXCJuZXcgbGluZVwifSwgQkxPQ0s6IHtydWxlczogW1wiaW5kZW50IHBhenogZGVkZW50XCIsIFwiaW5kZW50IExJTkUrIGRlZGVudFwiXX0sIFNUQVRFTUVOVDoge3J1bGVzOiBbXCJBU1NJR05cIiwgXCJFWFBSXCIsIFwiSUZcIiwgXCJXSElMRVwiLCBcIkZPUlwiLCBcIlJFVFVSTlwiLCBcbiAgICBcIkNMQVNTXCIsIFwiVEFHXCIsIFwiRE9NX0FTU0lHTlwiLCBcIlRSWV9DQVRDSFwiLCBcIlRIUk9XXCJdfSwgQ0xBU1NfTUVUSE9EUzoge1xuICAgIHJ1bGVzOiBbXCJzYW1lZGVudCogZjpGVU5DX0RFRiBzYW1lZGVudCpcIl0sIGhvb2tzOiBmdW5jdGlvbiAocCkgeyByZXR1cm4gcC5mOyB9XG4gIH0sIENMQVNTOiB7XG4gICAgcnVsZXM6IFtcbiAgICAgIFwiY2xhc3MgbjpuYW1lIG9wZW5fcGFyIHA6bmFtZSBjbG9zZV9wYXIgaW5kZW50IG06Q0xBU1NfTUVUSE9EUysgZGVkZW50XCIsXG4gICAgICBcImNsYXNzIG46bmFtZSBpbmRlbnQgbTpDTEFTU19NRVRIT0RTKyBkZWRlbnRcIlxuICAgIF0sIGhvb2tzOiBbXG4gICAgICBmdW5jdGlvbiAocCkgeyByZXR1cm4ge25hbWU6IHAubiwgbWV0aG9kczogcC5tLCBwYXJlbnQ6IHAucH07IH0sXG4gICAgICBmdW5jdGlvbiAocCkgeyByZXR1cm4ge25hbWU6IHAubiwgbWV0aG9kczogcC5tfTsgfVxuICAgIF1cbiAgfSwgRlVOQ19ERUZfUEFSQU1TOiB7cnVsZXM6IFtcbiAgICBcInAxOkZVTkNfREVGX1BBUkFNUyBjb21tYSBXIHAyOkZVTkNfREVGX1BBUkFNU1wiLFxuICAgIFwicDE6bmFtZSBhc3NpZ24gZTpFWFBSXCIsXG4gICAgXCJwMTpuYW1lXCJcbiAgICBdLCB2ZXJib3NlOiBcImRlZiBwYXJhbWV0ZXJzXCJcbiAgfSwgTEFNQkRBX0JPRFk6IHtydWxlczogW1wiQVNTSUdOXCIsIFwiRVhQUlwiXX0sIExBTUJEQToge3J1bGVzOiBbXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIFcgYmxvY2s6TEFNQkRBX0JPRFlcIixcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGZuOm5hbWUgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIFcgYmxvY2s6TEFNQkRBX0JPRFlcIixcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGJsb2NrOkxBTUJEQV9CT0RZXCJcbiAgICBdLCBob29rczogcmVmbGVjdFxuICB9LCBGVU5DX0RFRjoge3J1bGVzOiBbXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIGJsb2NrOkJMT0NLXCIsXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgVyBmbjpuYW1lIG9wZW5fcGFyIHBhcmFtczpGVU5DX0RFRl9QQVJBTVM/IGNsb3NlX3BhciBibG9jazpCTE9DS1wiLFxuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBibG9jazpCTE9DS1wiLFxuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIGJsb2NrOkJMT0NLXCJcbiAgICBdLCBob29rczogcmVmbGVjdCwgdmVyYm9zZTogXCJkZWYgZGVmaW5pdGlvblwiXG4gIH0sIEVMU0VfSUY6IHtydWxlczogW1wic2FtZWRlbnQgZWxzZWlmIGU6RVhQUiBiOkJMT0NLXCJdLCBob29rczogcmVmbGVjdH0sIEVMU0U6IHtydWxlczogW1wic2FtZWRlbnQgZWxzZSBiOkJMT0NLXCJdLCBob29rczogcmVmbGVjdH0sIElGOiB7cnVsZXM6IFtcImlmIGU6RVhQUiBiOkJMT0NLIGVsaWY6RUxTRV9JRiogZWw6RUxTRT9cIl0sIGhvb2tzOiByZWZsZWN0fSwgRUxTRV9FWFBSOiB7cnVsZXM6IFtcIlcgZWxzZSBXIGI6RVhQUlwiXSwgaG9va3M6IHJlZmxlY3R9LCBJRl9FWFBSOiB7cnVsZXM6IFtcImU6RVhQUiBXIGlmIHRlc3Q6RVhQUiBlbDpFTFNFX0VYUFI/XCJdLCBob29rczogcmVmbGVjdH0sIFdISUxFOiB7cnVsZXM6IFtcIndoaWxlIGU6RVhQUiBiOkJMT0NLXCJdLCBob29rczogcmVmbGVjdH0sIE1BVEg6IHtydWxlczogW1wiZTE6RVhQUiBXIG9wOm1hdGggVyBlMjpFWFBSXCJdfSwgUEFUSDoge3J1bGVzOiBbXCJQQVRIIGRvdCBuYW1lXCIsIFwiUEFUSCBvcGVuX2JyYSBudW1iZXIgY2xvc2VfYnJhXCIsIFwibmFtZVwiXX0sIEFTU0lHTjoge3J1bGVzOiBbXG4gICAgXCJsZWZ0Ok9CSkVDVCBXIG9wOmFzc2lnbiBXIHJpZ2h0OkVYUFJcIixcbiAgICBcImxlZnQ6RVhQUiBXIG9wOmFzc2lnbiBXIHJpZ2h0OkVYUFJcIixcbiAgICBcImxlZnQ6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSIFcgb3A6YXNzaWduIFcgcmlnaHQ6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSXCIsXG4gICAgXCJsZWZ0OlNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUiBXIG9wOmFzc2lnbiBXIHJpZ2h0OkVYUFJcIlxuICBdLCBob29rczogcmVmbGVjdH0sIFdfT1JfU0FNRURFTlQ6IHtydWxlczogW1wiV1wiLCBcInNhbWVkZW50XCJdLCB2ZXJib3NlOiBcInNhbWVkZW50IG9yIHdoaXRlc3BhY2VcIn0sIFdfU0FNRURFTlRfSU5ERU5UOiB7cnVsZXM6IFtcIldcIiwgXCJzYW1lZGVudFwiLCBcImluZGVudFwiXSwgdmVyYm9zZTogXCJpbmRlbnQgb3Igc2FtZWRlbnQgb3Igd2hpdGVzcGFjZVwifSwgQU5ZX1NQQUNFOiB7cnVsZXM6IFtcIldcIiwgXCJzYW1lZGVudFwiLCBcImluZGVudFwiLCBcImRlZGVudFwiLCBcImNvbW1lbnRcIl0sIHZlcmJvc2U6IFwiYW55IHNwYWNlXCJ9LCBGVU5DX0NBTExfUEFSQU1TOiB7cnVsZXM6IFtcIkVYUFIgY29tbWEgQU5ZX1NQQUNFKyBGVU5DX0NBTExfUEFSQU1TIEFOWV9TUEFDRSpcIiwgXCJFWFBSIEFOWV9TUEFDRSpcIl19LCBGVU5DX0NBTEw6IHtydWxlczogW1xuICAgIFwib3Blbl9wYXIgRlVOQ19DQUxMX1BBUkFNUz8gY2xvc2VfcGFyXCJcbiAgXX0sIFRZUEU6IHtydWxlczogW1wibmFtZSBjb2xvblwiXX0sIEZPUjoge3J1bGVzOiBbXG4gICAgXCJmb3JfbG9vcCBrOm5hbWUgY29tbWEgVyB2Om5hbWUgVyBpbiBhOkVYUFIgYjpCTE9DS1wiLFxuICAgIFwiZm9yX2xvb3AgdjpuYW1lIFcgaW4gYTpFWFBSIGI6QkxPQ0tcIl0sIGhvb2tzOiByZWZsZWN0XG4gIH0sIFNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUjoge3J1bGVzOiBbXG4gICAgXCJlMTpFWFBSIGNvbW1hIFcgZTI6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSXCIsXG4gICAgXCJlMTpFWFBSIGNvbW1hIFcgZTI6RVhQUlwiXG4gIF0sIGhvb2tzOiBbXG4gICAgZnVuY3Rpb24gKHApIHsgcmV0dXJuIFtwLmUxXS5jb25jYXQocC5lMi5jaGlsZHJlbik7IH0sIGZ1bmN0aW9uIChwKSB7IHJldHVybiBbcC5lMSwgcC5lMl07IH1cbiAgXSBcbiAgfSwgQ09NTUFfU0VQQVJBVEVEX0VYUFI6IHtydWxlczogW1xuICAgIFwiRVhQUiBjb21tYSBBTllfU1BBQ0UrIENPTU1BX1NFUEFSQVRFRF9FWFBSIEFOWV9TUEFDRSpcIixcbiAgICBcIkVYUFIgQU5ZX1NQQUNFKlwiXG4gIF19LCBBUlJBWToge3J1bGVzOiBbXG4gICAgXCJvcGVuX2JyYSBBTllfU1BBQ0UqIGM6Q09NTUFfU0VQQVJBVEVEX0VYUFI/IEFOWV9TUEFDRSogY2xvc2VfYnJhXCJcbiAgXX0sIE1FTUJFUlM6IHtydWxlczogW1xuICAgIFwibmFtZTpuYW1lIGNvbG9uIFcgdmFsdWU6RVhQUiBzYW1lOnNhbWVkZW50PyBjb21tYSBhbnk6QU5ZX1NQQUNFKyBtOk1FTUJFUlMgc3BhY2U6QU5ZX1NQQUNFKlwiLFxuICAgIFwibmFtZTpuYW1lIGNvbG9uIFcgdmFsdWU6RVhQUiBzcGFjZTpBTllfU1BBQ0UqXCJcbiAgXSwgaG9va3M6IFtcbiAgICBmdW5jdGlvbiAocCkgeyByZXR1cm4gW3BdLmNvbmNhdChwLm0uY2hpbGRyZW4pOyB9LCBmdW5jdGlvbiAocCkgeyByZXR1cm4gW3BdOyB9XG4gIF1cbiAgfSwgT0JKRUNUOiB7cnVsZXM6IFtcbiAgICBcIm9wZW5fY3VybHkgaW5kZW50PyBNRU1CRVJTPyBjbG9zZV9jdXJseVwiXG4gIF19LCBUQUdfUEFSQU1TOiB7cnVsZXM6IFtcbiAgICBcImxlZnQ6VEFHX1BBUkFNUyBXIHJpZ2h0OlRBR19QQVJBTVNcIixcbiAgICBcIm46bmFtZSBhc3NpZ24gZTpFWFBSXCIsXG4gICAgXCJuOm5hbWVcIlxuICAgIF0sIGhvb2tzOiByZWZsZWN0LCB2ZXJib3NlOiBcInRhZyBwYXJhbWV0ZXJzXCJcbiAgfSwgVEFHOiB7cnVsZXM6IFtcbiAgICBcInRhZzp0YWcgVz8gcGFyYW1zOlRBR19QQVJBTVM/IGVuZDo+PyBibG9jazpCTE9DSz9cIlxuICBdLCBob29rczogcmVmbGVjdFxuICB9LCBET01fQVNTSUdOOiB7cnVsZXM6IFtcbiAgICBcImFzc2lnbiBFWFBSXCJcbiAgXX0sIFRSWV9DQVRDSDoge3J1bGVzOiBbXG4gICAgXCJ0cnkgYjE6QkxPQ0sgc2FtZWRlbnQ/IGNhdGNoIG9wZW5fcGFyIGVycjpuYW1lPyBjbG9zZV9wYXIgYjI6QkxPQ0tcIlxuICAgIF0sIGhvb2tzOiByZWZsZWN0XG4gIH0sIFRIUk9XOiB7cnVsZXM6IFtcbiAgICBcInRocm93IEVYUFJcIlxuICBdfSwgUkVUVVJOOiB7cnVsZXM6IFtcInJldCBXIFNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUlwiLCBcInJldCBXIEVYUFJcIiwgXCJyZXRcIl19LCBSSUdIVF9FWFBSOiB7cnVsZXM6IFtcbiAgICBcIm1hdGhfb3BlcmF0b3JzXCIsXG4gICAgXCJXIGJpbmFyeV9vcGVyYXRvcnMgVyBFWFBSXCIsXG4gICAgXCJXIG9yIEVYUFJcIixcbiAgICBcIlcgYW5kIEVYUFJcIixcbiAgICBcIlcgY29tcGFyaXNvbiBXIEVYUFJcIixcbiAgICBcIlcgPiBXIEVYUFJcIixcbiAgICBcImRvdCBFWFBSXCIsXG4gICAgXCJXIGluc3RhbmNlb2YgRVhQUlwiLFxuICAgIFwib3Blbl9icmEgRVhQUiBjbG9zZV9icmFcIixcbiAgICBcIkZVTkNfQ0FMTFwiXG4gICAgXSwgdmVyYm9zZTogXCJleHByZXNzaW9uXCJcbiAgfSwgRVhQUjoge3J1bGVzOiBbXG4gICAgXCJJRl9FWFBSXCIsXG4gICAgXCJNQVRIXCIsXG4gICAgXCJPQkpFQ1RcIixcbiAgICBcIkZVTkNfREVGXCIsXG4gICAgXCJFWFBSIFJJR0hUX0VYUFJcIixcbiAgICBcIm5hbWVcIixcbiAgICBcIm51bWJlclwiLFxuICAgIFwiTEFNQkRBXCIsXG4gICAgXCJzdHJpbmdcIixcbiAgICBcInJlZ2V4cFwiLFxuICAgIFwib3Blbl9wYXIgRVhQUiBjbG9zZV9wYXJcIixcbiAgICBcIm5ldyBFWFBSXCIsXG4gICAgXCJub3QgRVhQUlwiLFxuICAgIFwiQVJSQVlcIlxuICAgIF0sIHZlcmJvc2U6IFwiZXhwcmVzc2lvblwiXG4gIH1cbn07XG5cbmZ1bmN0aW9uIHNwYWNlcihuKSB7XG4gIHZhciBvdXQsIGk7XG4gIG91dCA9IFwiXCI7XG4gIGkgPSAwO1xuICB3aGlsZShpIDwgbil7XG4gICAgb3V0ICs9IFwiIFwiO1xuICAgIGkrKztcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiBzcChtb2QpIHtcbiAgaWYobW9kKSB7XG4gICAgcmV0dXJuIHNwYWNlcigyICogKGRlcHRoICsgbW9kKSk7XG4gIH1cbiAgcmV0dXJuIHNwYWNlcigyICogZGVwdGgpO1xufVxuXG5uYyA9IDE7XG5cbi8vIGNoaWxkcmVuIG5hbWVcbmZ1bmN0aW9uIENOKCkge1xuICByZXR1cm4gcHJlZml4ICsgJ2MnICsgbmM7XG59XG5cbmZ1bmN0aW9uIHB1c2hDTigpIHtcbiAgbmMrKztcbiAgcmV0dXJuIHByZWZpeCArICdjJyArIG5jO1xufVxuXG5mdW5jdGlvbiBwb3BDTigpIHtcbiAgbmMtLTtcbiAgcmV0dXJuIHByZWZpeCArICdjJyArIG5jO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZUhvaXN0ZWRWYXIoKSB7XG4gIHZhciBucywgaG9pc3RlZCwgX19pbmRleDIsIF9fa2V5czIsIGtleSwgdmFsdWU7XG4gIG5zID0gY3VycmVudE5zKCk7XG4gIGhvaXN0ZWQgPSBbXTtcbiAgX19rZXlzMiA9IE9iamVjdC5rZXlzKG5zKTtcbiAgZm9yKF9faW5kZXgyID0gMDsgX19pbmRleDIgPCBfX2tleXMyLmxlbmd0aDsgX19pbmRleDIrKykge1xuICAgIGtleSA9IF9fa2V5czJbX19pbmRleDJdO1xuICAgIHZhbHVlID0gbnNbX19rZXlzMltfX2luZGV4Ml1dO1xuICAgIGlmKHZhbHVlID09PSAnaG9pc3QnKSB7XG4gICAgICBob2lzdGVkLnB1c2goa2V5KTtcbiAgICB9XG4gIH1cbiAgaWYoaG9pc3RlZC5sZW5ndGgpIHtcbiAgICByZXR1cm4gJ3ZhciAnICsgaG9pc3RlZC5qb2luKCcsICcpICsgJzsnO1xuICB9XG4gIHJldHVybiAnJztcbn1cblxuZnVuY3Rpb24gaG9pc3RWYXIobmFtZSkge1xuICB2YXIgbnM7XG4gIG5zID0gY3VycmVudE5zKCk7XG4gIG5zW25hbWVdID0gJ2hvaXN0Jztcbn1cblxuYmFja2VuZCA9IHtcbiAgU1RBUlQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciwgX19pbmRleDMsIF9fa2V5czMsIGNoaWxkLCBob2lzdGVkO1xuICAgIHN0ciA9ICcnO1xuICAgIF9fa2V5czMgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgICBmb3IoX19pbmRleDMgPSAwOyBfX2luZGV4MyA8IF9fa2V5czMubGVuZ3RoOyBfX2luZGV4MysrKSB7XG4gICAgICBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX19rZXlzM1tfX2luZGV4M11dO1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShjaGlsZCk7XG4gICAgfVxuICAgIGhvaXN0ZWQgPSBnZW5lcmF0ZUhvaXN0ZWRWYXIoKTtcbiAgICBpZihob2lzdGVkKSB7XG4gICAgICByZXR1cm4gZ2VuZXJhdGVIb2lzdGVkVmFyKCkgKyAnXFxuJyArIHN0cjtcbiAgICB9XG4gICAgcmV0dXJuIHN0cjtcbiAgfSwgXG4gIGRlZGVudDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICBkZXB0aCA9IE1hdGgubWF4KDAsIGRlcHRoIC0gMSk7XG4gICAgcmV0dXJuICcnO1xuICB9LCBcbiAgaW5kZW50OiBmdW5jdGlvbiAobm9kZSkge1xuICAgIGRlcHRoID0gZGVwdGggKyAxO1xuICAgIHJldHVybiAnXFxuJyArIHNwKCk7XG4gIH0sIFxuICBzYW1lZGVudDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgbCwgaSwgc3RyO1xuICAgIGwgPSBub2RlLnZhbHVlLnNwbGl0KCdcXG4nKS5sZW5ndGggLSAxO1xuICAgIGkgPSAwO1xuICAgIHN0ciA9ICcnO1xuICAgIHdoaWxlKGkgPCBsKXtcbiAgICAgIHN0ciArPSAnXFxuJyArIHNwKCk7XG4gICAgICBpKys7XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG4gIH0sIFxuICBET01fQVNTSUdOOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBuYW1lLCB2YXJuYW1lLCBzdHI7XG4gICAgbmFtZSA9IENOKCk7XG4gICAgdmFybmFtZSA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzFdKTtcbiAgICBob2lzdFZhcihDTigpKTtcbiAgICBob2lzdFZhcignJyArIHByZWZpeCArICd0bXAnKTtcbiAgICBzdHIgPSAnJyArIHByZWZpeCArICd0bXAgPSAnICsgdmFybmFtZSArICc7ICcgKyBwcmVmaXggKyAndG1wIGluc3RhbmNlb2YgQXJyYXkgPyAoJyArIG5hbWUgKyAnID0gJyArIG5hbWUgKyAnLmNvbmNhdCgnICsgcHJlZml4ICsgJ3RtcCkpIDogJyArIG5hbWUgKyAnLnB1c2goU3RyaW5nKCcgKyBwcmVmaXggKyAndG1wKSknO1xuICAgIHJldHVybiBzdHI7XG4gIH0sIFxuICBUQUdfUEFSQU1TOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBuYW1lO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ubGVmdCkge1xuICAgICAgcmV0dXJuIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmxlZnQpICsgJywgJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnJpZ2h0KTtcbiAgICB9XG4gICAgXG4gICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4ubi52YWx1ZTtcbiAgICBcbiAgICBpZihub2RlLmNoaWxkcmVuLmUpIHtcbiAgICAgIHJldHVybiAnXCInICsgbmFtZSArICdcIjogJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gJ1wiJyArIG5hbWUgKyAnXCI6IHRydWUnO1xuICAgIH1cbiAgfSwgXG4gIFRBRzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyLCBwYXJhbXMsIG5hbWUsIHN1YiwgbnM7XG4gICAgc3RyID0gJyc7XG4gICAgcGFyYW1zID0gXCJ7XCI7XG4gICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4udGFnLnZhbHVlLnN1YnN0cmluZygxKTtcbiAgICBpZihub2RlLmNoaWxkcmVuLnBhcmFtcykge1xuICAgICAgcGFyYW1zICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnBhcmFtcyk7XG4gICAgfVxuICAgIFxuICAgIHBhcmFtcyArPSAnfSc7XG4gICAgc3ViID0gJ1tdJztcbiAgICBucyA9IGN1cnJlbnROcygpO1xuICAgIFxuICAgIGlmKG5vZGUuY2hpbGRyZW4uYmxvY2spIHtcbiAgICAgIHN1YiA9IHB1c2hDTigpO1xuICAgICAgc3RyICs9IENOKCkgKyAnID0gW107JztcbiAgICAgIGhvaXN0VmFyKENOKCkpO1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrKTtcbiAgICAgIHBvcENOKCk7XG4gICAgfVxuICAgIFxuICAgIHN0ciArPSAnXFxuJyArIHNwKCkgKyBDTigpICsgJy5wdXNoKGNva2VzY3JpcHQuaChcIicgKyBuYW1lICsgJ1wiLCAnICsgcGFyYW1zICsgJywgJyArIHN1YiArICcpKSc7XG4gICAgcmV0dXJuIHN0cjtcbiAgfSwgXG4gIENMQVNTOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBuYW1lLCBmdW5jcywgcGFyZW50LCBzdHIsIGNvbnN0cnVjdG9yLCBfX2luZGV4NCwgX19rZXlzNCwgZnVuYywgZnVuY19kZWYsIGZ1bmNfbmFtZSwgbnMsIHBhcmFtcywgYm9keSwgY29uc19zdHIsIF9faW5kZXg1LCBfX2tleXM1LCBrZXksIHZhbHVlO1xuICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuLm5hbWUudmFsdWU7XG4gICAgZnVuY3MgPSBub2RlLmNoaWxkcmVuLm1ldGhvZHM7XG4gICAgcGFyZW50ID0gbm9kZS5jaGlsZHJlbi5wYXJlbnQ7XG4gICAgc3RyID0gJyc7XG4gICAgY29uc3RydWN0b3IgPSBudWxsO1xuICAgIF9fa2V5czQgPSBPYmplY3Qua2V5cyhmdW5jcyk7XG4gICAgZm9yKF9faW5kZXg0ID0gMDsgX19pbmRleDQgPCBfX2tleXM0Lmxlbmd0aDsgX19pbmRleDQrKykge1xuICAgICAgZnVuYyA9IGZ1bmNzW19fa2V5czRbX19pbmRleDRdXTtcbiAgICAgIGZ1bmNfZGVmID0gZnVuYy5jaGlsZHJlbjtcbiAgICAgIGZ1bmNfbmFtZSA9IGZ1bmNfZGVmLmNoaWxkcmVuLmZuLnZhbHVlO1xuICAgICAgaWYoZnVuY19uYW1lID09PSAnY29uc3RydWN0b3InKSB7XG4gICAgICAgIGNvbnN0cnVjdG9yID0gZnVuY19kZWY7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgKz0gJ1xcbicgKyBzcCgpICsgbmFtZSArICcucHJvdG90eXBlLicgKyBmdW5jX25hbWUgKyAnID0gJyArIGdlbmVyYXRlQ29kZShmdW5jX2RlZik7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGhvaXN0VmFyKG5hbWUpO1xuICAgIG5zID0gbmV3TnMoKTtcbiAgICBcbiAgICBwYXJhbXMgPSBjb25zdHJ1Y3RvciAmJiBjb25zdHJ1Y3Rvci5jaGlsZHJlbi5wYXJhbXM7XG4gICAgaWYocGFyYW1zKSB7XG4gICAgICBwYXJhbXMgPSBnZW5lcmF0ZUNvZGUocGFyYW1zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGFyYW1zID0gJyc7XG4gICAgfVxuICAgIFxuICAgIGJvZHkgPSBjb25zdHJ1Y3RvciAmJiBjb25zdHJ1Y3Rvci5jaGlsZHJlbi5ibG9jaztcbiAgICBjb25zX3N0ciA9ICcnICsgbmFtZSArICcgPSBmdW5jdGlvbiAnICsgbmFtZSArICcgKCAnICsgcGFyYW1zICsgJyApIHsnO1xuICAgIGNvbnNfc3RyICs9ICdcXG4nICsgc3AoMSkgKyAnaWYoISh0aGlzIGluc3RhbmNlb2YgJyArIG5hbWUgKyAnKSl7IHJldHVybiBuZXcgJyArIG5hbWUgKyAnKCcgKyBPYmplY3Qua2V5cyhucykuam9pbignLCcpICsgJyl9JztcbiAgICBfX2tleXM1ID0gT2JqZWN0LmtleXMobnMpO1xuICAgIGZvcihfX2luZGV4NSA9IDA7IF9faW5kZXg1IDwgX19rZXlzNS5sZW5ndGg7IF9faW5kZXg1KyspIHtcbiAgICAgIGtleSA9IF9fa2V5czVbX19pbmRleDVdO1xuICAgICAgdmFsdWUgPSBuc1tfX2tleXM1W19faW5kZXg1XV07XG4gICAgICBpZih2YWx1ZSAhPT0gdHJ1ZSAmJiB2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnNfc3RyICs9ICdcXG4nICsgc3AoMSkgKyAnaWYoJyArIGtleSArICcgPT09IHVuZGVmaW5lZCkgeycgKyBrZXkgKyAnID0gJyArIGdlbmVyYXRlQ29kZSh2YWx1ZSkgKyAnfSc7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGJvZHkpIHtcbiAgICAgIGNvbnNfc3RyICs9IGdlbmVyYXRlQ29kZShib2R5KTtcbiAgICB9XG4gICAgY29uc19zdHIgKz0gc3AoKSArICdcXG59JztcbiAgICBcbiAgICBpZihwYXJlbnQpIHtcbiAgICAgIGNvbnNfc3RyICs9ICdcXG4nICsgc3AoKSArICcnICsgbmFtZSArICcucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSgnICsgcGFyZW50LnZhbHVlICsgJy5wcm90b3R5cGUpJztcbiAgICAgIGNvbnNfc3RyICs9ICdcXG4nICsgc3AoKSArICcnICsgbmFtZSArICcucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gJyArIG5hbWUgKyAnJztcbiAgICB9XG4gICAgXG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICByZXR1cm4gY29uc19zdHIgKyBzdHI7XG4gIH0sIFxuICBMQU1CREE6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIG5hbWUsIG5zLCBzdHIsIF9faW5kZXg2LCBfX2tleXM2LCBrZXksIHZhbHVlLCBjb2RlO1xuICAgIG5hbWUgPSBcIlwiO1xuICAgIG5zID0gbmV3TnMoKTtcbiAgICBpZihub2RlLmNoaWxkcmVuLmZuKSB7XG4gICAgICBuYW1lID0gbm9kZS5jaGlsZHJlbi5mbi52YWx1ZTtcbiAgICAgIG5zW25hbWVdID0gdHJ1ZTtcbiAgICB9XG4gICAgXG4gICAgc3RyID0gXCJmdW5jdGlvbiBcIiArIG5hbWUgKyBcIihcIjtcbiAgICBpZihub2RlLmNoaWxkcmVuLnBhcmFtcykge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnBhcmFtcywgbnMpO1xuICAgIH1cbiAgICBcbiAgICBzdHIgKz0gJykgeyc7XG4gICAgX19rZXlzNiA9IE9iamVjdC5rZXlzKG5zKTtcbiAgICBmb3IoX19pbmRleDYgPSAwOyBfX2luZGV4NiA8IF9fa2V5czYubGVuZ3RoOyBfX2luZGV4NisrKSB7XG4gICAgICBrZXkgPSBfX2tleXM2W19faW5kZXg2XTtcbiAgICAgIHZhbHVlID0gbnNbX19rZXlzNltfX2luZGV4Nl1dO1xuICAgICAgaWYodmFsdWUgIT09IHRydWUgJiYgdmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb2RlID0gZ2VuZXJhdGVDb2RlKHZhbHVlKTtcbiAgICAgICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyAnaWYoJyArIGtleSArICcgPT09IHVuZGVmaW5lZCkgeycgKyBrZXkgKyAnID0gJyArIGNvZGUgKyAnfSc7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmKG5vZGUuY2hpbGRyZW4uYmxvY2spIHtcbiAgICAgIHN0ciArPSAnIHJldHVybiAnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYmxvY2ssIG5zKTtcbiAgICB9XG4gICAgXG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICByZXR1cm4gc3RyICsgXCI7IH1cIjtcbiAgfSwgXG4gIEZVTkNfREVGOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBuYW1lLCBucywgaXNfZG9tLCBzdHIsIF9faW5kZXg3LCBfX2tleXM3LCBrZXksIHZhbHVlLCBjb2RlLCBib2R5LCBob2lzdGVkO1xuICAgIG5hbWUgPSBcIlwiO1xuICAgIG5zID0gY3VycmVudE5zKCk7XG4gICAgaXNfZG9tID0gbm9kZS5jaGlsZHJlbi5mZC52YWx1ZSA9PT0gJ2RvbSc7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5mbikge1xuICAgICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICBuc1tuYW1lXSA9IHRydWU7XG4gICAgfVxuICAgIFxuICAgIG5zID0gbmV3TnMoKTtcbiAgICBzdHIgPSBcImZ1bmN0aW9uIFwiICsgbmFtZSArIFwiKFwiO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ucGFyYW1zKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucGFyYW1zKTtcbiAgICB9XG4gICAgXG4gICAgc3RyICs9ICcpIHsnO1xuICAgIF9fa2V5czcgPSBPYmplY3Qua2V5cyhucyk7XG4gICAgZm9yKF9faW5kZXg3ID0gMDsgX19pbmRleDcgPCBfX2tleXM3Lmxlbmd0aDsgX19pbmRleDcrKykge1xuICAgICAga2V5ID0gX19rZXlzN1tfX2luZGV4N107XG4gICAgICB2YWx1ZSA9IG5zW19fa2V5czdbX19pbmRleDddXTtcbiAgICAgIGlmKHZhbHVlICE9PSB0cnVlICYmIHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29kZSA9IGdlbmVyYXRlQ29kZSh2YWx1ZSk7XG4gICAgICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgJ2lmKCcgKyBrZXkgKyAnID09PSB1bmRlZmluZWQpIHsnICsga2V5ICsgJyA9ICcgKyBjb2RlICsgJzt9JztcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgYm9keSA9ICcnO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uYmxvY2spIHtcbiAgICAgIGJvZHkgPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5ibG9jayk7XG4gICAgfVxuICAgIFxuICAgIGlmKGlzX2RvbSkge1xuICAgICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyAndmFyICcgKyBDTigpICsgJyA9IFtdOyc7XG4gICAgfVxuICAgIFxuICAgIGhvaXN0ZWQgPSBnZW5lcmF0ZUhvaXN0ZWRWYXIoKTtcbiAgICBpZihob2lzdGVkKSB7XG4gICAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArIGhvaXN0ZWQ7XG4gICAgfVxuICAgIFxuICAgIHN0ciArPSBib2R5O1xuICAgIFxuICAgIG5hbWVzcGFjZXMucG9wKCk7XG4gICAgXG4gICAgaWYoaXNfZG9tKSB7XG4gICAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArICdyZXR1cm4gJyArIENOKCkgKyAnOyc7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzdHIgKyAnXFxuJyArIHNwKCkgKyAnfSc7XG4gIH0sIFxuICBGVU5DX0RFRl9QQVJBTVM6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciwgbnMsIF9faW5kZXg4LCBfX2tleXM4LCBuO1xuICAgIHN0ciA9IFwiXCI7XG4gICAgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBpZihub2RlLmNoaWxkcmVuWzBdLnR5cGUgPT09ICduYW1lJykge1xuICAgICAgbnNbbm9kZS5jaGlsZHJlblswXS52YWx1ZV0gPSB0cnVlO1xuICAgICAgaWYobm9kZS5jaGlsZHJlblsxXSAmJiBub2RlLmNoaWxkcmVuWzFdLnR5cGUgPT09ICdhc3NpZ24nKSB7XG4gICAgICAgIG5zW25vZGUuY2hpbGRyZW5bMF0udmFsdWVdID0gbm9kZS5jaGlsZHJlblsyXTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgX19rZXlzOCA9IE9iamVjdC5rZXlzKG5vZGUuY2hpbGRyZW4pO1xuICAgIGZvcihfX2luZGV4OCA9IDA7IF9faW5kZXg4IDwgX19rZXlzOC5sZW5ndGg7IF9faW5kZXg4KyspIHtcbiAgICAgIG4gPSBub2RlLmNoaWxkcmVuW19fa2V5czhbX19pbmRleDhdXTtcbiAgICAgIGlmKG4udHlwZSA9PT0gJ25hbWUnIHx8IG4udHlwZSA9PT0gJ0ZVTkNfREVGX1BBUkFNUycgfHwgbi50eXBlID09PSAnY29tbWEnIHx8IG4udHlwZSA9PT0gJ3dpbmRvdycpIHtcbiAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShuKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHN0cjtcbiAgfSwgXG4gIEFTU0lHTjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyLCBvcCwgZXhwbGljaXRfZ2xvYmFsLCBucywgbGVmdCwgcmlnaHRfY29kZSwgdW5wYWNrX25hbWUsIGksIF9faW5kZXg5LCBfX2tleXM5LCBjaGlsZCwgbiwgbWVtYmVycywgX19pbmRleDEwLCBfX2tleXMxMCwgbWVtYmVyLCBuYW1lLCB2YWx1ZSwgX19pbmRleDExLCBfX2tleXMxMSwgcywgX19pbmRleDEyLCBfX2tleXMxMiwgY2g7XG4gICAgc3RyID0gXCJcIjtcbiAgICBvcCA9IG5vZGUuY2hpbGRyZW4ub3AudmFsdWU7XG4gICAgZXhwbGljaXRfZ2xvYmFsID0gb3AgPT09ICc6PSc7XG4gICAgaWYoZXhwbGljaXRfZ2xvYmFsKSB7XG4gICAgICBvcCA9ICc9JztcbiAgICB9XG4gICAgXG4gICAgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBsZWZ0ID0gbm9kZS5jaGlsZHJlbi5sZWZ0O1xuICAgIHJpZ2h0X2NvZGUgPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5yaWdodCk7XG4gICAgXG4gICAgLy8gYXNzaWduZW1lbnQgdW5wYWNraW5nXG4gICAgaWYobGVmdC50eXBlID09PSAnU1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSJykge1xuICAgICAgdW5wYWNraW5nKys7XG4gICAgICB1bnBhY2tfbmFtZSA9ICcnICsgcHJlZml4ICsgJ3VucGFjaycgKyB1bnBhY2tpbmcgKyAnJztcbiAgICAgIHN0ciArPSAndmFyICcgKyB1bnBhY2tfbmFtZSArICcgPSAnICsgcmlnaHRfY29kZSArICc7XFxuJyArIHNwKCk7XG4gICAgICBpID0gMDtcbiAgICAgIF9fa2V5czkgPSBPYmplY3Qua2V5cyhsZWZ0LmNoaWxkcmVuKTtcbiAgICAgIGZvcihfX2luZGV4OSA9IDA7IF9faW5kZXg5IDwgX19rZXlzOS5sZW5ndGg7IF9faW5kZXg5KyspIHtcbiAgICAgICAgY2hpbGQgPSBsZWZ0LmNoaWxkcmVuW19fa2V5czlbX19pbmRleDldXTtcbiAgICAgICAgbiA9IGNoaWxkLmNoaWxkcmVuWzBdO1xuICAgICAgICBpZihuLnR5cGUgPT09ICduYW1lJyAmJiBjaGlsZC5jaGlsZHJlbi5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICBob2lzdFZhcihuLnZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKGNoaWxkKSArICcgJyArIG9wICsgJyAnICsgdW5wYWNrX25hbWUgKyAnWycgKyBpICsgJ10nO1xuICAgICAgICBpZihpIDwgbGVmdC5jaGlsZHJlbi5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgc3RyICs9ICc7XFxuJyArIHNwKCk7XG4gICAgICAgIH1cbiAgICAgICAgaSsrO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG4gICAgXG4gICAgLy8gYXNzaWduZW1lbnQgbWFwcGluZ1xuICAgIGlmKGxlZnQudHlwZSA9PT0gJ09CSkVDVCcpIHtcbiAgICAgIHVucGFja2luZysrO1xuICAgICAgdW5wYWNrX25hbWUgPSAnJyArIHByZWZpeCArICd1bnBhY2snICsgdW5wYWNraW5nICsgJyc7XG4gICAgICBzdHIgKz0gJ3ZhciAnICsgdW5wYWNrX25hbWUgKyAnID0gJyArIHJpZ2h0X2NvZGUgKyAnO1xcbicgKyBzcCgpO1xuICAgICAgaSA9IDA7XG4gICAgICBtZW1iZXJzID0gbGVmdC5jaGlsZHJlblsxXS5jaGlsZHJlbjtcbiAgICAgIF9fa2V5czEwID0gT2JqZWN0LmtleXMobWVtYmVycyk7XG4gICAgICBmb3IoX19pbmRleDEwID0gMDsgX19pbmRleDEwIDwgX19rZXlzMTAubGVuZ3RoOyBfX2luZGV4MTArKykge1xuICAgICAgICBtZW1iZXIgPSBtZW1iZXJzW19fa2V5czEwW19faW5kZXgxMF1dO1xuICAgICAgICBuYW1lID0gZ2VuZXJhdGVDb2RlKG1lbWJlci5uYW1lKTtcbiAgICAgICAgdmFsdWUgPSBnZW5lcmF0ZUNvZGUobWVtYmVyLnZhbHVlKTtcbiAgICAgICAgaWYobWVtYmVyLnNhbWVkZW50KSB7XG4gICAgICAgICAgZ2VuZXJhdGVDb2RlKG1lbWJlci5zYW1lZGVudCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYobWVtYmVyLmFueSkge1xuICAgICAgICAgIF9fa2V5czExID0gT2JqZWN0LmtleXMobWVtYmVyLmFueSk7XG4gICAgICAgICAgZm9yKF9faW5kZXgxMSA9IDA7IF9faW5kZXgxMSA8IF9fa2V5czExLmxlbmd0aDsgX19pbmRleDExKyspIHtcbiAgICAgICAgICAgIHMgPSBtZW1iZXIuYW55W19fa2V5czExW19faW5kZXgxMV1dO1xuICAgICAgICAgICAgZ2VuZXJhdGVDb2RlKHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZihtZW1iZXIuc3BhY2UpIHtcbiAgICAgICAgICBfX2tleXMxMiA9IE9iamVjdC5rZXlzKG1lbWJlci5zcGFjZSk7XG4gICAgICAgICAgZm9yKF9faW5kZXgxMiA9IDA7IF9faW5kZXgxMiA8IF9fa2V5czEyLmxlbmd0aDsgX19pbmRleDEyKyspIHtcbiAgICAgICAgICAgIHMgPSBtZW1iZXIuc3BhY2VbX19rZXlzMTJbX19pbmRleDEyXV07XG4gICAgICAgICAgICBnZW5lcmF0ZUNvZGUocyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHN0ciArPSBcIlwiICsgdmFsdWUgKyBcIi5cIiArIG5hbWUgKyBcIiA9IFwiICsgdW5wYWNrX25hbWUgKyBcIi5cIiArIG5hbWUgKyBcIlwiO1xuICAgICAgICBpZihpIDwgbWVtYmVycy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgc3RyICs9ICc7XFxuJyArIHNwKCk7XG4gICAgICAgIH1cbiAgICAgICAgaSsrO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG4gICAgXG4gICAgXG4gICAgaWYobGVmdC5jaGlsZHJlblswXS50eXBlID09PSAnbmFtZScpIHtcbiAgICAgIGNoID0gbGVmdC5jaGlsZHJlblswXTtcbiAgICAgIGlmKCFjdXJyZW50TnNIYXMoY2gudmFsdWUpKSB7XG4gICAgICAgIGlmKCFleHBsaWNpdF9nbG9iYWwpIHtcbiAgICAgICAgICBob2lzdFZhcihjaC52YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmxlZnQpICsgJyAnICsgb3AgKyAnICcgKyByaWdodF9jb2RlO1xuICB9LCBcbiAgU1RBVEVNRU5UOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHIsIF9faW5kZXgxMywgX19rZXlzMTMsIGNoaWxkLCBlLCB0LCBvdGhlcjtcbiAgICBzdHIgPSAnJztcbiAgICBfX2tleXMxMyA9IE9iamVjdC5rZXlzKG5vZGUuY2hpbGRyZW4pO1xuICAgIGZvcihfX2luZGV4MTMgPSAwOyBfX2luZGV4MTMgPCBfX2tleXMxMy5sZW5ndGg7IF9faW5kZXgxMysrKSB7XG4gICAgICBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX19rZXlzMTNbX19pbmRleDEzXV07XG4gICAgICBlID0gY2hpbGQuY2hpbGRyZW4gJiYgY2hpbGQuY2hpbGRyZW5bMF07XG4gICAgICAvLyBUT0RPOiB0aGlzIHNob3VsZCBiZSBwb3NzaWJsZVxuICAgICAgdCA9IGNoaWxkLnR5cGU7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKGNoaWxkKTtcbiAgICAgIG90aGVyID0gZSAmJiAoZS50eXBlID09PSAnRlVOQ19ERUYnIHx8IGUudHlwZSA9PT0gJ0xBTUJEQScpO1xuICAgICAgaWYodCA9PT0gJ0ZPUicgfHwgdCA9PT0gJ1RSWV9DQVRDSCcgfHwgdCA9PT0gJ1dISUxFJyB8fCB0ID09PSAnSUYnIHx8IHQgPT09ICdTVEFURU1FTlQnIHx8IHQgPT09ICdzYW1lZGVudCcgfHwgb3RoZXIpIHtcbiAgICAgICAgXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgKz0gJzsnO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc3RyO1xuICB9LCBcbiAgSUY6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciwgZWxpZiwgX19pbmRleDE0LCBfX2tleXMxNCwgdmFsdWU7XG4gICAgc3RyID0gJyc7XG4gICAgc3RyID0gJ2lmKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcpIHsnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYikgKyAnXFxuJyArIHNwKCkgKyAnfSc7XG4gICAgZWxpZiA9IG5vZGUuY2hpbGRyZW4uZWxpZjtcbiAgICBpZihlbGlmKSB7XG4gICAgICBpZihBcnJheS5pc0FycmF5KGVsaWYpKSB7XG4gICAgICAgIF9fa2V5czE0ID0gT2JqZWN0LmtleXMoZWxpZik7XG4gICAgICAgIGZvcihfX2luZGV4MTQgPSAwOyBfX2luZGV4MTQgPCBfX2tleXMxNC5sZW5ndGg7IF9faW5kZXgxNCsrKSB7XG4gICAgICAgICAgdmFsdWUgPSBlbGlmW19fa2V5czE0W19faW5kZXgxNF1dO1xuICAgICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUodmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKGVsaWYpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZihub2RlLmNoaWxkcmVuLmVsKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZWwpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc3RyO1xuICB9LCBcbiAgSUZfRVhQUjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyO1xuICAgIHN0ciA9ICcnO1xuICAgIHN0ciA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnRlc3QpICsgJyA/ICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcgOiAnO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uZWwpIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciArPSAndW5kZWZpbmVkJztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHN0cjtcbiAgfSwgXG4gIEVMU0VfRVhQUjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYik7XG4gIH0sIFxuICBXSElMRTogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJ3doaWxlKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcpeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgfSwgXG4gIEZPUjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIga2V5SW5kZXhOYW1lLCBrZXlBcnJheU5hbWUsIGFycmF5TmFtZSwgdmFyTmFtZSwgaW5kZXhOYW1lLCBzdHI7XG4gICAga2V5SW5kZXhOYW1lID0gcHJlZml4ICsgXCJpbmRleFwiICsgZm9yTG9vcENvdW50O1xuICAgIGtleUFycmF5TmFtZSA9IHByZWZpeCArIFwia2V5c1wiICsgZm9yTG9vcENvdW50O1xuICAgIGhvaXN0VmFyKGtleUluZGV4TmFtZSk7XG4gICAgaG9pc3RWYXIoa2V5QXJyYXlOYW1lKTtcbiAgICBcbiAgICBhcnJheU5hbWUgPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5hKTtcbiAgICB2YXJOYW1lID0gbm9kZS5jaGlsZHJlbi52LnZhbHVlO1xuICAgIGZvckxvb3BDb3VudCsrO1xuICAgIGluZGV4TmFtZSA9IGZhbHNlO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uaykge1xuICAgICAgaW5kZXhOYW1lID0gbm9kZS5jaGlsZHJlbi5rLnZhbHVlO1xuICAgIH1cbiAgICBcbiAgICBpZihpbmRleE5hbWUpIHtcbiAgICAgIGhvaXN0VmFyKGluZGV4TmFtZSk7XG4gICAgfVxuICAgIGhvaXN0VmFyKHZhck5hbWUpO1xuICAgIFxuICAgIHN0ciA9ICcnICsga2V5QXJyYXlOYW1lICsgJyA9IE9iamVjdC5rZXlzKCcgKyBhcnJheU5hbWUgKyAnKTtcXG4nO1xuICAgIHN0ciArPSBzcCgpICsgJ2ZvcignICsga2V5SW5kZXhOYW1lICsgJyA9IDA7ICcgKyBrZXlJbmRleE5hbWUgKyAnIDwgJyArIGtleUFycmF5TmFtZSArICcubGVuZ3RoOyAnICsga2V5SW5kZXhOYW1lICsgJysrKSB7XFxuJztcbiAgICBpZihpbmRleE5hbWUpIHtcbiAgICAgIHN0ciArPSBzcCgxKSArICcnICsgaW5kZXhOYW1lICsgJyA9ICcgKyBrZXlBcnJheU5hbWUgKyAnWycgKyBrZXlJbmRleE5hbWUgKyAnXTtcXG4nO1xuICAgIH1cbiAgICBcbiAgICBzdHIgKz0gc3AoMSkgKyAnJyArIHZhck5hbWUgKyAnID0gJyArIGFycmF5TmFtZSArICdbJyArIGtleUFycmF5TmFtZSArICdbJyArIGtleUluZGV4TmFtZSArICddXTsnO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgICByZXR1cm4gc3RyO1xuICB9LCBcbiAgRUxTRV9JRjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyBlbHNlIGlmKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcpIHsnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYikgKyAnXFxuJyArIHNwKCkgKyAnfSc7XG4gIH0sIFxuICBFTFNFOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnIGVsc2UgeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgfSwgXG4gIFRSWV9DQVRDSDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyO1xuICAgIHN0ciA9IFwidHJ5IHtcIjtcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYjEpO1xuICAgIHN0ciArPSAnXFxuJyArIHNwKCkgKyBcIn0gY2F0Y2goXCIgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lcnIpICsgXCIpIHtcIjtcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYjIpO1xuICAgIHJldHVybiBzdHIgKyAnXFxuJyArIHNwKCkgKyBcIn1cIjtcbiAgfSwgXG4gIFNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgZWxlbWVudHMsIF9faW5kZXgxNSwgX19rZXlzMTUsIGNoaWxkO1xuICAgIGVsZW1lbnRzID0gW107XG4gICAgX19rZXlzMTUgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgICBmb3IoX19pbmRleDE1ID0gMDsgX19pbmRleDE1IDwgX19rZXlzMTUubGVuZ3RoOyBfX2luZGV4MTUrKykge1xuICAgICAgY2hpbGQgPSBub2RlLmNoaWxkcmVuW19fa2V5czE1W19faW5kZXgxNV1dO1xuICAgICAgZWxlbWVudHMucHVzaChnZW5lcmF0ZUNvZGUoY2hpbGQpKTtcbiAgICB9XG4gICAgcmV0dXJuICdbJyArIGVsZW1lbnRzLmpvaW4oXCIsIFwiKSArICddJztcbiAgfSwgXG4gIE1FTUJFUlM6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciwgaSwgX19pbmRleDE2LCBfX2tleXMxNiwgbWVtYmVyLCBfX2luZGV4MTcsIF9fa2V5czE3LCBzLCBfX2luZGV4MTgsIF9fa2V5czE4O1xuICAgIHN0ciA9IFwiXCI7XG4gICAgaSA9IDA7XG4gICAgX19rZXlzMTYgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgICBmb3IoX19pbmRleDE2ID0gMDsgX19pbmRleDE2IDwgX19rZXlzMTYubGVuZ3RoOyBfX2luZGV4MTYrKykge1xuICAgICAgbWVtYmVyID0gbm9kZS5jaGlsZHJlbltfX2tleXMxNltfX2luZGV4MTZdXTtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobWVtYmVyLm5hbWUpICsgJzogJyArIGdlbmVyYXRlQ29kZShtZW1iZXIudmFsdWUpO1xuICAgICAgaWYoaSA8IG5vZGUuY2hpbGRyZW4ubGVuZ3RoIC0gMSkge1xuICAgICAgICBzdHIgKz0gJywgJztcbiAgICAgIH1cbiAgICAgIGlmKG1lbWJlci5zYW1lKSB7XG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobWVtYmVyLnNhbWUpO1xuICAgICAgfVxuICAgICAgaWYobWVtYmVyLmFueSkge1xuICAgICAgICBfX2tleXMxNyA9IE9iamVjdC5rZXlzKG1lbWJlci5hbnkpO1xuICAgICAgICBmb3IoX19pbmRleDE3ID0gMDsgX19pbmRleDE3IDwgX19rZXlzMTcubGVuZ3RoOyBfX2luZGV4MTcrKykge1xuICAgICAgICAgIHMgPSBtZW1iZXIuYW55W19fa2V5czE3W19faW5kZXgxN11dO1xuICAgICAgICAgIGdlbmVyYXRlQ29kZShzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYobWVtYmVyLnNwYWNlKSB7XG4gICAgICAgIF9fa2V5czE4ID0gT2JqZWN0LmtleXMobWVtYmVyLnNwYWNlKTtcbiAgICAgICAgZm9yKF9faW5kZXgxOCA9IDA7IF9faW5kZXgxOCA8IF9fa2V5czE4Lmxlbmd0aDsgX19pbmRleDE4KyspIHtcbiAgICAgICAgICBzID0gbWVtYmVyLnNwYWNlW19fa2V5czE4W19faW5kZXgxOF1dO1xuICAgICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUocyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGkrKztcbiAgICB9XG4gICAgcmV0dXJuIHN0cjtcbiAgfSwgXG4gIHN0cmluZzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgdiwgYXN0O1xuICAgIHYgPSBub2RlLnZhbHVlO1xuICAgIHYgPSB2LnJlcGxhY2UoL1xcbi9nLCBcIlxcXFxuXCIpO1xuICAgIGFzdCA9IHN0ckdyYW0ucGFyc2Uodik7XG4gICAgaWYoIWFzdC5jb21wbGV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGFzdC5oaW50KTtcbiAgICB9XG4gICAgcmV0dXJuIGdlbmVyYXRlU3RyaW5nQ29kZShhc3QsIHYuY2hhckF0KDApKTtcbiAgfSwgXG4gIGNvbW1lbnQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuIG5vZGUudmFsdWUucmVwbGFjZSgvXiMvZywgXCIvL1wiKTtcbiAgfSwgXG4gIG5hbWU6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuIG5vZGUudmFsdWUucmVwbGFjZSgnLScsICdfJyk7XG4gIH0sIFxuICBwYXp6OiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnJztcbiAgfSwgXG4gIG5vdDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyEnO1xuICB9LCBcbiAgYW5kOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnJiYgJztcbiAgfSwgXG4gIG9yOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnfHwgJztcbiAgfSwgXG4gIGNvbXBhcmlzb246IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgaWYobm9kZS52YWx1ZSA9PT0gJz09Jykge1xuICAgICAgcmV0dXJuICc9PT0nO1xuICAgIH1cbiAgICBcbiAgICBpZihub2RlLnZhbHVlID09PSAnIT0nKSB7XG4gICAgICByZXR1cm4gJyE9PSc7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9XG59O1xuXG5mdW5jdGlvbiBnZW5lcmF0ZUNvZGUobm9kZSkge1xuICB2YXIgc3RyLCBfX2luZGV4MTksIF9fa2V5czE5LCBjaGlsZDtcbiAgaWYoIW5vZGUpIHtcbiAgICAvLyBkZWJ1Z2dlclxuICB9XG4gIGlmKGJhY2tlbmRbbm9kZS50eXBlXSkge1xuICAgIHJldHVybiBiYWNrZW5kW25vZGUudHlwZV0obm9kZSk7XG4gIH1cbiAgXG4gIGlmKG5vZGUudmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9XG4gIFxuICBzdHIgPSBcIlwiO1xuICBpZighbm9kZS5jaGlsZHJlbikge1xuICAgIHJldHVybiAnJztcbiAgfVxuICBcbiAgX19rZXlzMTkgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgZm9yKF9faW5kZXgxOSA9IDA7IF9faW5kZXgxOSA8IF9fa2V5czE5Lmxlbmd0aDsgX19pbmRleDE5KyspIHtcbiAgICBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX19rZXlzMTlbX19pbmRleDE5XV07XG4gICAgc3RyICs9IGdlbmVyYXRlQ29kZShjaGlsZCk7XG4gIH1cbiAgXG4gIHJldHVybiBzdHI7XG59XG5cblxuZnVuY3Rpb24gZ2VuZXJhdGVFeHBvcnRzKGtleXMpIHtcbiAgdmFyIHN0ciwgX19pbmRleDIwLCBfX2tleXMyMCwga2V5O1xuICBzdHIgPSAnXFxubW9kdWxlLmV4cG9ydHMgPSB7JztcbiAga2V5cyA9IGtleXMgfHwgT2JqZWN0LmtleXMoY3VycmVudE5zKCkpO1xuICBfX2tleXMyMCA9IE9iamVjdC5rZXlzKGtleXMpO1xuICBmb3IoX19pbmRleDIwID0gMDsgX19pbmRleDIwIDwgX19rZXlzMjAubGVuZ3RoOyBfX2luZGV4MjArKykge1xuICAgIGtleSA9IGtleXNbX19rZXlzMjBbX19pbmRleDIwXV07XG4gICAgc3RyICs9ICdcXG4gICcgKyBrZXkgKyAnIDogJyArIGtleSArICcsJztcbiAgfVxuICByZXR1cm4gc3RyICsgJ1xcbn0nO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZU1vZHVsZShpbnB1dCxvcHRzKSB7XG4gIHZhciBhc3QsIG9iajtcbiAgcmVzZXRHbG9iYWwoKTtcbiAgYXN0ID0gZ3JhbS5wYXJzZShpbnB1dCArIFwiXFxuXCIpO1xuICBpZighYXN0LmNvbXBsZXRlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGFzdC5oaW50KTtcbiAgfVxuICBcbiAgb2JqID0ge2FzdDogYXN0LCBjb2RlOiBnZW5lcmF0ZUNvZGUoYXN0KSwgbnM6IGN1cnJlbnROcygpfTtcbiAgcmV0dXJuIG9iajtcbn1cblxuXG5ncmFtID0gZXBlZ2pzLmNvbXBpbGVHcmFtbWFyKGdyYW1tYXJEZWYsIHRva2VuRGVmKTtcblxuZnVuY3Rpb24gY3JlYXRlVk5vZGUobmFtZSxhdHRycyxjaGlsZHJlbikge1xuICB2YXIgcHJvcHMsIGF0dHJpYnV0ZXMsIF9faW5kZXgyMSwgX19rZXlzMjEsIGtleSwgdmFsdWU7XG4gIC8vIHRoaXMgY291bGQgYmUgZG9uZSBhdCBjb21waWxlIHRpbWVcbiAgaWYoYXR0cnMuY29uc3RydWN0b3IgPT09IEFycmF5KSB7XG4gICAgcmV0dXJuIHZpcnR1YWwuaChuYW1lLCBhdHRycywgY2hpbGRyZW4pO1xuICB9XG4gIHByb3BzID0ge307XG4gIGF0dHJpYnV0ZXMgPSB7fTtcbiAgX19rZXlzMjEgPSBPYmplY3Qua2V5cyhhdHRycyk7XG4gIGZvcihfX2luZGV4MjEgPSAwOyBfX2luZGV4MjEgPCBfX2tleXMyMS5sZW5ndGg7IF9faW5kZXgyMSsrKSB7XG4gICAga2V5ID0gX19rZXlzMjFbX19pbmRleDIxXTtcbiAgICB2YWx1ZSA9IGF0dHJzW19fa2V5czIxW19faW5kZXgyMV1dO1xuICAgIGlmKGtleS5tYXRjaCgvXihjaGVja2VkfHZhbHVlfHNlbGVjdGVkKSQvKSkge1xuICAgICAgcHJvcHNba2V5XSA9IHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBhdHRyaWJ1dGVzW2tleV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cbiAgcHJvcHMuYXR0cmlidXRlcyA9IGF0dHJpYnV0ZXM7XG4gIHJldHVybiB2aXJ0dWFsLmgobmFtZSwgcHJvcHMsIGNoaWxkcmVuKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHY6IHZpcnR1YWwsIGg6IGNyZWF0ZVZOb2RlLCBjcmVhdGU6IHZpcnR1YWwuY3JlYXRlLCBkaWZmOiB2aXJ0dWFsLmRpZmYsIHBhdGNoOiB2aXJ0dWFsLnBhdGNoLCBncmFtbWFyOiBncmFtLCBzdHJHcmFtbWFyOiBzdHJHcmFtLCBncmFtbWFyRGVmOiBncmFtbWFyRGVmLCBlcGVnanM6IGVwZWdqcywgdG9rZW5EZWY6IHRva2VuRGVmLCBnZW5lcmF0ZU1vZHVsZTogZ2VuZXJhdGVNb2R1bGUsIGdlbmVyYXRlQ29kZTogZ2VuZXJhdGVDb2RlLCBnZW5lcmF0ZUV4cG9ydHM6IGdlbmVyYXRlRXhwb3J0c1xufTtcblxuIixudWxsLCIvKiFcbiAqIENyb3NzLUJyb3dzZXIgU3BsaXQgMS4xLjFcbiAqIENvcHlyaWdodCAyMDA3LTIwMTIgU3RldmVuIExldml0aGFuIDxzdGV2ZW5sZXZpdGhhbi5jb20+XG4gKiBBdmFpbGFibGUgdW5kZXIgdGhlIE1JVCBMaWNlbnNlXG4gKiBFQ01BU2NyaXB0IGNvbXBsaWFudCwgdW5pZm9ybSBjcm9zcy1icm93c2VyIHNwbGl0IG1ldGhvZFxuICovXG5cbi8qKlxuICogU3BsaXRzIGEgc3RyaW5nIGludG8gYW4gYXJyYXkgb2Ygc3RyaW5ncyB1c2luZyBhIHJlZ2V4IG9yIHN0cmluZyBzZXBhcmF0b3IuIE1hdGNoZXMgb2YgdGhlXG4gKiBzZXBhcmF0b3IgYXJlIG5vdCBpbmNsdWRlZCBpbiB0aGUgcmVzdWx0IGFycmF5LiBIb3dldmVyLCBpZiBgc2VwYXJhdG9yYCBpcyBhIHJlZ2V4IHRoYXQgY29udGFpbnNcbiAqIGNhcHR1cmluZyBncm91cHMsIGJhY2tyZWZlcmVuY2VzIGFyZSBzcGxpY2VkIGludG8gdGhlIHJlc3VsdCBlYWNoIHRpbWUgYHNlcGFyYXRvcmAgaXMgbWF0Y2hlZC5cbiAqIEZpeGVzIGJyb3dzZXIgYnVncyBjb21wYXJlZCB0byB0aGUgbmF0aXZlIGBTdHJpbmcucHJvdG90eXBlLnNwbGl0YCBhbmQgY2FuIGJlIHVzZWQgcmVsaWFibHlcbiAqIGNyb3NzLWJyb3dzZXIuXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFN0cmluZyB0byBzcGxpdC5cbiAqIEBwYXJhbSB7UmVnRXhwfFN0cmluZ30gc2VwYXJhdG9yIFJlZ2V4IG9yIHN0cmluZyB0byB1c2UgZm9yIHNlcGFyYXRpbmcgdGhlIHN0cmluZy5cbiAqIEBwYXJhbSB7TnVtYmVyfSBbbGltaXRdIE1heGltdW0gbnVtYmVyIG9mIGl0ZW1zIHRvIGluY2x1ZGUgaW4gdGhlIHJlc3VsdCBhcnJheS5cbiAqIEByZXR1cm5zIHtBcnJheX0gQXJyYXkgb2Ygc3Vic3RyaW5ncy5cbiAqIEBleGFtcGxlXG4gKlxuICogLy8gQmFzaWMgdXNlXG4gKiBzcGxpdCgnYSBiIGMgZCcsICcgJyk7XG4gKiAvLyAtPiBbJ2EnLCAnYicsICdjJywgJ2QnXVxuICpcbiAqIC8vIFdpdGggbGltaXRcbiAqIHNwbGl0KCdhIGIgYyBkJywgJyAnLCAyKTtcbiAqIC8vIC0+IFsnYScsICdiJ11cbiAqXG4gKiAvLyBCYWNrcmVmZXJlbmNlcyBpbiByZXN1bHQgYXJyYXlcbiAqIHNwbGl0KCcuLndvcmQxIHdvcmQyLi4nLCAvKFthLXpdKykoXFxkKykvaSk7XG4gKiAvLyAtPiBbJy4uJywgJ3dvcmQnLCAnMScsICcgJywgJ3dvcmQnLCAnMicsICcuLiddXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uIHNwbGl0KHVuZGVmKSB7XG5cbiAgdmFyIG5hdGl2ZVNwbGl0ID0gU3RyaW5nLnByb3RvdHlwZS5zcGxpdCxcbiAgICBjb21wbGlhbnRFeGVjTnBjZyA9IC8oKT8/Ly5leGVjKFwiXCIpWzFdID09PSB1bmRlZixcbiAgICAvLyBOUENHOiBub25wYXJ0aWNpcGF0aW5nIGNhcHR1cmluZyBncm91cFxuICAgIHNlbGY7XG5cbiAgc2VsZiA9IGZ1bmN0aW9uKHN0ciwgc2VwYXJhdG9yLCBsaW1pdCkge1xuICAgIC8vIElmIGBzZXBhcmF0b3JgIGlzIG5vdCBhIHJlZ2V4LCB1c2UgYG5hdGl2ZVNwbGl0YFxuICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoc2VwYXJhdG9yKSAhPT0gXCJbb2JqZWN0IFJlZ0V4cF1cIikge1xuICAgICAgcmV0dXJuIG5hdGl2ZVNwbGl0LmNhbGwoc3RyLCBzZXBhcmF0b3IsIGxpbWl0KTtcbiAgICB9XG4gICAgdmFyIG91dHB1dCA9IFtdLFxuICAgICAgZmxhZ3MgPSAoc2VwYXJhdG9yLmlnbm9yZUNhc2UgPyBcImlcIiA6IFwiXCIpICsgKHNlcGFyYXRvci5tdWx0aWxpbmUgPyBcIm1cIiA6IFwiXCIpICsgKHNlcGFyYXRvci5leHRlbmRlZCA/IFwieFwiIDogXCJcIikgKyAvLyBQcm9wb3NlZCBmb3IgRVM2XG4gICAgICAoc2VwYXJhdG9yLnN0aWNreSA/IFwieVwiIDogXCJcIiksXG4gICAgICAvLyBGaXJlZm94IDMrXG4gICAgICBsYXN0TGFzdEluZGV4ID0gMCxcbiAgICAgIC8vIE1ha2UgYGdsb2JhbGAgYW5kIGF2b2lkIGBsYXN0SW5kZXhgIGlzc3VlcyBieSB3b3JraW5nIHdpdGggYSBjb3B5XG4gICAgICBzZXBhcmF0b3IgPSBuZXcgUmVnRXhwKHNlcGFyYXRvci5zb3VyY2UsIGZsYWdzICsgXCJnXCIpLFxuICAgICAgc2VwYXJhdG9yMiwgbWF0Y2gsIGxhc3RJbmRleCwgbGFzdExlbmd0aDtcbiAgICBzdHIgKz0gXCJcIjsgLy8gVHlwZS1jb252ZXJ0XG4gICAgaWYgKCFjb21wbGlhbnRFeGVjTnBjZykge1xuICAgICAgLy8gRG9lc24ndCBuZWVkIGZsYWdzIGd5LCBidXQgdGhleSBkb24ndCBodXJ0XG4gICAgICBzZXBhcmF0b3IyID0gbmV3IFJlZ0V4cChcIl5cIiArIHNlcGFyYXRvci5zb3VyY2UgKyBcIiQoPyFcXFxccylcIiwgZmxhZ3MpO1xuICAgIH1cbiAgICAvKiBWYWx1ZXMgZm9yIGBsaW1pdGAsIHBlciB0aGUgc3BlYzpcbiAgICAgKiBJZiB1bmRlZmluZWQ6IDQyOTQ5NjcyOTUgLy8gTWF0aC5wb3coMiwgMzIpIC0gMVxuICAgICAqIElmIDAsIEluZmluaXR5LCBvciBOYU46IDBcbiAgICAgKiBJZiBwb3NpdGl2ZSBudW1iZXI6IGxpbWl0ID0gTWF0aC5mbG9vcihsaW1pdCk7IGlmIChsaW1pdCA+IDQyOTQ5NjcyOTUpIGxpbWl0IC09IDQyOTQ5NjcyOTY7XG4gICAgICogSWYgbmVnYXRpdmUgbnVtYmVyOiA0Mjk0OTY3Mjk2IC0gTWF0aC5mbG9vcihNYXRoLmFicyhsaW1pdCkpXG4gICAgICogSWYgb3RoZXI6IFR5cGUtY29udmVydCwgdGhlbiB1c2UgdGhlIGFib3ZlIHJ1bGVzXG4gICAgICovXG4gICAgbGltaXQgPSBsaW1pdCA9PT0gdW5kZWYgPyAtMSA+Pj4gMCA6IC8vIE1hdGgucG93KDIsIDMyKSAtIDFcbiAgICBsaW1pdCA+Pj4gMDsgLy8gVG9VaW50MzIobGltaXQpXG4gICAgd2hpbGUgKG1hdGNoID0gc2VwYXJhdG9yLmV4ZWMoc3RyKSkge1xuICAgICAgLy8gYHNlcGFyYXRvci5sYXN0SW5kZXhgIGlzIG5vdCByZWxpYWJsZSBjcm9zcy1icm93c2VyXG4gICAgICBsYXN0SW5kZXggPSBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aDtcbiAgICAgIGlmIChsYXN0SW5kZXggPiBsYXN0TGFzdEluZGV4KSB7XG4gICAgICAgIG91dHB1dC5wdXNoKHN0ci5zbGljZShsYXN0TGFzdEluZGV4LCBtYXRjaC5pbmRleCkpO1xuICAgICAgICAvLyBGaXggYnJvd3NlcnMgd2hvc2UgYGV4ZWNgIG1ldGhvZHMgZG9uJ3QgY29uc2lzdGVudGx5IHJldHVybiBgdW5kZWZpbmVkYCBmb3JcbiAgICAgICAgLy8gbm9ucGFydGljaXBhdGluZyBjYXB0dXJpbmcgZ3JvdXBzXG4gICAgICAgIGlmICghY29tcGxpYW50RXhlY05wY2cgJiYgbWF0Y2gubGVuZ3RoID4gMSkge1xuICAgICAgICAgIG1hdGNoWzBdLnJlcGxhY2Uoc2VwYXJhdG9yMiwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGggLSAyOyBpKyspIHtcbiAgICAgICAgICAgICAgaWYgKGFyZ3VtZW50c1tpXSA9PT0gdW5kZWYpIHtcbiAgICAgICAgICAgICAgICBtYXRjaFtpXSA9IHVuZGVmO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoLmxlbmd0aCA+IDEgJiYgbWF0Y2guaW5kZXggPCBzdHIubGVuZ3RoKSB7XG4gICAgICAgICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkob3V0cHV0LCBtYXRjaC5zbGljZSgxKSk7XG4gICAgICAgIH1cbiAgICAgICAgbGFzdExlbmd0aCA9IG1hdGNoWzBdLmxlbmd0aDtcbiAgICAgICAgbGFzdExhc3RJbmRleCA9IGxhc3RJbmRleDtcbiAgICAgICAgaWYgKG91dHB1dC5sZW5ndGggPj0gbGltaXQpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHNlcGFyYXRvci5sYXN0SW5kZXggPT09IG1hdGNoLmluZGV4KSB7XG4gICAgICAgIHNlcGFyYXRvci5sYXN0SW5kZXgrKzsgLy8gQXZvaWQgYW4gaW5maW5pdGUgbG9vcFxuICAgICAgfVxuICAgIH1cbiAgICBpZiAobGFzdExhc3RJbmRleCA9PT0gc3RyLmxlbmd0aCkge1xuICAgICAgaWYgKGxhc3RMZW5ndGggfHwgIXNlcGFyYXRvci50ZXN0KFwiXCIpKSB7XG4gICAgICAgIG91dHB1dC5wdXNoKFwiXCIpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBvdXRwdXQucHVzaChzdHIuc2xpY2UobGFzdExhc3RJbmRleCkpO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0Lmxlbmd0aCA+IGxpbWl0ID8gb3V0cHV0LnNsaWNlKDAsIGxpbWl0KSA6IG91dHB1dDtcbiAgfTtcblxuICByZXR1cm4gc2VsZjtcbn0pKCk7XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4hZnVuY3Rpb24oZSl7aWYoXCJvYmplY3RcIj09dHlwZW9mIGV4cG9ydHMmJlwidW5kZWZpbmVkXCIhPXR5cGVvZiBtb2R1bGUpbW9kdWxlLmV4cG9ydHM9ZSgpO2Vsc2UgaWYoXCJmdW5jdGlvblwiPT10eXBlb2YgZGVmaW5lJiZkZWZpbmUuYW1kKWRlZmluZShbXSxlKTtlbHNle3ZhciBmO1widW5kZWZpbmVkXCIhPXR5cGVvZiB3aW5kb3c/Zj13aW5kb3c6XCJ1bmRlZmluZWRcIiE9dHlwZW9mIGdsb2JhbD9mPWdsb2JhbDpcInVuZGVmaW5lZFwiIT10eXBlb2Ygc2VsZiYmKGY9c2VsZiksZi5FUEVHPWUoKX19KGZ1bmN0aW9uKCl7dmFyIGRlZmluZSxtb2R1bGUsZXhwb3J0cztyZXR1cm4gKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkoezE6W2Z1bmN0aW9uKHJlcXVpcmUsbW9kdWxlLGV4cG9ydHMpe1xuLypcbiAgSmF2YVNjcmlwdCBpbXBsZW1lbnRhdGlvbiBvZiBhIFBhY2tyYXQgUGFyc2VycyB3aXRoIGxlZnQgUmVjdXJzaW9uIFN1cHBvcnRcbiAgaHR0cDovL3d3dy52cHJpLm9yZy9wZGYvdHIyMDA3MDAyX3BhY2tyYXQucGRmXG5cbiAgTm8gSW5kaXJlY3QgTGVmdCBSZWN1cnNpb24geWV0IDotKFxuXG4gIEJhdGlzdGUgQmllbGVyIDIwMTRcbiovXG5cInVzZSBzdHJpY3RcIjtcblxuZnVuY3Rpb24gdG9rZW5pemUoaW5wdXQsIGdyYW0pIHtcbiAgdmFyIGtleXMgPSBncmFtLnRva2VuS2V5cztcbiAgdmFyIHRva2VucyA9IGdyYW0udG9rZW5NYXA7XG4gIHZhciBzdHJlYW0gPSBbXTtcbiAgdmFyIGxlbiA9IGlucHV0Lmxlbmd0aCwgY2FuZGlkYXRlLCBpLCBrZXksIGNvcHkgPSBpbnB1dCwgbGFzdFRva2VuID0gbnVsbDtcbiAgdmFyIHBvaW50ZXIgPSAwO1xuICB2YXIgbGluZSA9IDA7XG4gIHZhciBjb2x1bW4gPSAwO1xuXG4gIHdoaWxlKHBvaW50ZXIgPCBsZW4pIHtcbiAgICBjYW5kaWRhdGUgPSBudWxsO1xuICAgIGZvcihpPTA7IGk8a2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAga2V5ID0ga2V5c1tpXTtcbiAgICAgIHZhciB0b2tlbiA9IHRva2Vuc1trZXldLCBtYXRjaDtcbiAgICAgIGlmKHRva2VuLmZ1bmMpIHtcbiAgICAgICAgbWF0Y2ggPSB0b2tlbi5mdW5jKGlucHV0LCBzdHJlYW0pO1xuICAgICAgICBpZihtYXRjaCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY2FuZGlkYXRlID0gbWF0Y2g7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZih0b2tlbi5yZWcpe1xuICAgICAgICBtYXRjaCA9IGlucHV0Lm1hdGNoKHRva2VuLnJlZyk7XG4gICAgICAgIGlmKG1hdGNoICE9PSBudWxsKSB7XG4gICAgICAgICAgY2FuZGlkYXRlID0gbWF0Y2hbMF07XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZih0b2tlbi5zdHIpe1xuICAgICAgICBtYXRjaCA9IGlucHV0LmluZGV4T2YodG9rZW4uc3RyKTtcbiAgICAgICAgaWYobWF0Y2ggPT09IDApIHtcbiAgICAgICAgICBjYW5kaWRhdGUgPSB0b2tlbi5zdHI7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlRva2VuaXplciBlcnJvcjogSW52YWxpZCB0b2tlbiBcIiArIGtleSArIFwiIHdpdGhvdXQgYSByZWcsIHN0ciBvciBmdW5jIHByb3BlcnR5XCIpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZihjYW5kaWRhdGUgIT09IG51bGwpIHtcbiAgICAgIGxhc3RUb2tlbiA9IHt0eXBlOmtleSwgdmFsdWU6Y2FuZGlkYXRlLCBwb2ludGVyOnBvaW50ZXIsIGxpbmU6bGluZSsxLCBjb2x1bW46Y29sdW1uKzF9O1xuICAgICAgc3RyZWFtLnB1c2gobGFzdFRva2VuKTtcbiAgICAgIHZhciBsaW5lX2JyZWFrc19jb3VudCA9IGNvdW50TGluZUJyZWFrKGNhbmRpZGF0ZSk7XG4gICAgICBsaW5lICs9IGxpbmVfYnJlYWtzX2NvdW50O1xuICAgICAgaWYobGluZV9icmVha3NfY291bnQgPiAwKSB7XG4gICAgICAgIGNvbHVtbiA9IDA7XG4gICAgICB9XG4gICAgICBjb2x1bW4gKz0gY291bnRDb2x1bW4oY2FuZGlkYXRlKTtcbiAgICAgIHBvaW50ZXIgKz0gY2FuZGlkYXRlLmxlbmd0aDtcbiAgICAgIGlucHV0ID0gaW5wdXQuc3Vic3RyKGNhbmRpZGF0ZS5sZW5ndGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZihzdHJlYW0ubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlRva2VuaXplciBlcnJvcjogdG90YWwgbWF0Y2ggZmFpbHVyZVwiKTtcbiAgICAgIH1cbiAgICAgIGlmKGxhc3RUb2tlbilcbiAgICAgICAgbGFzdFRva2VuLnBvaW50ZXIgKz0gbGFzdFRva2VuLnZhbHVlLmxlbmd0aDtcbiAgICAgIHZhciBtc2cgPSBlcnJvck1zZyhjb3B5LCBzdHJlYW1bc3RyZWFtLmxlbmd0aCAtIDFdLCBcIlRva2VuaXplciBlcnJvclwiLCBcIk5vIG1hdGNoaW5nIHRva2VuIGZvdW5kXCIpO1xuICAgICAgaWYobGFzdFRva2VuKVxuICAgICAgICBtc2cgKz0gXCJcXG5cIiArIFwiQmVmb3JlIHRva2VuIG9mIHR5cGUgXCIgKyBsYXN0VG9rZW4udHlwZSArIFwiOiBcIiArIGxhc3RUb2tlbi52YWx1ZTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihtc2cpO1xuICAgIH1cbiAgfVxuICBzdHJlYW0ucHVzaCh7dHlwZTonRU9GJywgdmFsdWU6XCJcIn0pO1xuICByZXR1cm4gc3RyZWFtO1xufVxuXG5mdW5jdGlvbiBjb3VudExpbmVCcmVhayhzdHIpIHtcbiAgdmFyIG0gPSBzdHIuc3BsaXQoL1xcbi9nKTtcbiAgcmV0dXJuIG0ubGVuZ3RoIC0gMTtcbn1cblxuZnVuY3Rpb24gY291bnRDb2x1bW4oc3RyKSB7XG4gIHZhciBtID0gc3RyLnNwbGl0KC9cXG4vZyk7XG4gIHJldHVybiBtW20ubGVuZ3RoLTFdLmxlbmd0aDtcbn1cblxuZnVuY3Rpb24gY29weVRva2VuKHN0b2tlbiwgcnRva2VuKSB7XG4gIHZhciB0ID0ge1xuICAgIHR5cGU6c3Rva2VuLnR5cGUsXG4gICAgdmFsdWU6c3Rva2VuLnZhbHVlLFxuICAgIHJlcGVhdDpydG9rZW4ucmVwZWF0LFxuICAgIGxpbmU6c3Rva2VuLmxpbmUsXG4gICAgY29sdW1uOnN0b2tlbi5jb2x1bW5cbiAgfTtcbiAgaWYocnRva2VuLm5hbWUpIHtcbiAgICB0Lm5hbWUgPSBydG9rZW4ubmFtZTtcbiAgfVxuICByZXR1cm4gdDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlUGFyYW1zKHRva2Vucykge1xuICB2YXIgcGFyYW1zID0ge307XG4gIHZhciBqID0gMDtcbiAgdG9rZW5zLm1hcChmdW5jdGlvbihpKSB7XG4gICAgaWYoaS5uYW1lKSB7XG4gICAgICBpZihpLnJlcGVhdCA9PSAnKicgfHwgaS5yZXBlYXQgPT0gJysnKSB7XG4gICAgICAgIGlmKCFwYXJhbXNbaS5uYW1lXSkge1xuICAgICAgICAgIHBhcmFtc1tpLm5hbWVdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgcGFyYW1zW2kubmFtZV0ucHVzaChpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBhcmFtc1tpLm5hbWVdID0gaTtcbiAgICAgIH1cbiAgICB9XG4gICAgcGFyYW1zWyckJytqXSA9IGk7XG4gICAgaisrO1xuICB9KTtcbiAgcmV0dXJuIHBhcmFtcztcbn1cblxuZnVuY3Rpb24gZ3Jvd0xSKGdyYW1tYXIsIHJ1bGUsIHN0cmVhbSwgcG9zLCBtZW1vKSB7XG4gIHZhciBzcCwgcmVzdWx0LCBwcm9ncmVzcyA9IGZhbHNlO1xuICB2YXIgaG9vayA9IGdyYW1tYXJbcnVsZS5rZXldLmhvb2tzW3J1bGUuaW5kZXhdO1xuXG4gIHdoaWxlKHRydWUpIHtcbiAgICBzcCA9IHBvcztcblxuICAgIHJlc3VsdCA9IGV2YWxSdWxlQm9keShncmFtbWFyLCBydWxlLCBzdHJlYW0sIHNwKTtcblxuICAgIC8vIGVuc3VyZSBzb21lIHByb2dyZXNzIGlzIG1hZGVcbiAgICBpZihyZXN1bHQgPT09IGZhbHNlIHx8IHJlc3VsdC5zcCA8PSBtZW1vLnNwKSB7XG4gICAgICByZXR1cm4gcHJvZ3Jlc3M7XG4gICAgfVxuXG4gICAgcmVzdWx0Lmhvb2sgPSBob29rO1xuXG4gICAgLy8gaXQncyB2ZXJ5IGltcG9ydGFudCB0byB1cGRhdGUgdGhlIG1lbW9pemVkIHZhbHVlXG4gICAgLy8gdGhpcyBpcyBhY3R1YWxseSBncm93aW5nIHRoZSBzZWVkIGluIHRoZSBtZW1vaXphdGlvblxuICAgIG1lbW8uY2hpbGRyZW4gPSByZXN1bHQuY2hpbGRyZW47XG4gICAgbWVtby5zcCA9IHJlc3VsdC5zcDtcbiAgICBtZW1vLmxpbmUgPSByZXN1bHQubGluZTtcbiAgICBtZW1vLmNvbHVtbiA9IHJlc3VsdC5jb2x1bW47XG4gICAgbWVtby5zdGFydCA9IHJlc3VsdC5zdGFydDtcbiAgICBtZW1vLmhvb2tlZCA9IHJlc3VsdC5ob29rZWQ7XG4gICAgbWVtby5ob29rID0gcmVzdWx0Lmhvb2s7XG4gICAgcHJvZ3Jlc3MgPSByZXN1bHQ7XG4gIH1cbiAgcmV0dXJuIHByb2dyZXNzO1xufVxuXG5mdW5jdGlvbiBtZW1vRXZhbChncmFtbWFyLCBydWxlLCBzdHJlYW0sIHBvaW50ZXIpIHtcblxuICB2YXIga2V5ID0gcnVsZS5rZXkrJzsnK3BvaW50ZXIrJzsnK3J1bGUuaW5kZXg7XG5cbiAgLy8gYXZvaWQgaW5maW5pdGUgcmVjdXJzaW9uXG4gIC8vIFRoaXMgaXMgZmFzdGVyIHRoYW4gZmlsdGVyXG4gIHZhciBpID0gc3RhY2subGVuZ3RoIC0gMTtcbiAgd2hpbGUoaSA+PSAwKSB7XG4gICAgaWYoc3RhY2tbaV1bMF0gPT0ga2V5KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGkgPSBpLTE7XG4gIH1cblxuICB2YXIgbWVtb19lbnRyeSA9IG1lbW9pemF0aW9uW3J1bGUua2V5Kyc7Jytwb2ludGVyXTtcbiAgaWYobWVtb19lbnRyeSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG1lbW9fZW50cnk7XG4gIH1cblxuICBzdGFjay5wdXNoKFtrZXksIHJ1bGVdKTtcbiAgdmFyIHJlc3VsdCA9IGV2YWxSdWxlQm9keShncmFtbWFyLCBydWxlLCBzdHJlYW0sIHBvaW50ZXIpO1xuICBzdGFjay5wb3AoKTtcblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBjYW5GYWlsKHRva2VuLCBub2RlKSB7XG4gIGlmKHRva2VuLnJlcGVhdCA9PT0gJyonIHx8IHRva2VuLnJlcGVhdCA9PT0gJz8nKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgaWYodG9rZW4ucmVwZWF0ID09PSAnKycgJiYgbm9kZS5jaGlsZHJlbi5sZW5ndGggJiYgbm9kZS5jaGlsZHJlbltub2RlLmNoaWxkcmVuLmxlbmd0aCAtIDFdLnR5cGUgPT0gdG9rZW4udHlwZSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gY2FuUmVwZWF0KHRva2VuKSB7XG4gIHJldHVybiB0b2tlbi5yZXBlYXQgPT09ICcqJyB8fCB0b2tlbi5yZXBlYXQgPT09ICcrJztcbn1cblxuZnVuY3Rpb24gZXZhbFJ1bGVCb2R5KGdyYW1tYXIsIHJ1bGUsIHN0cmVhbSwgcG9pbnRlcikge1xuXG4gIHZhciBzcCA9IHBvaW50ZXI7IC8vIHN0cmVhbSBwb2ludGVyXG4gIHZhciBycCA9IDA7ICAgICAgIC8vIHJ1bGUgcG9pbnRlclxuICB2YXIgaiwgcmVzdWx0O1xuXG4gIHZhciBydG9rZW4gPSBydWxlLnRva2Vuc1tycF07XG4gIHZhciBzdG9rZW4gPSBzdHJlYW1bc3BdO1xuXG4gIHZhciBjdXJyZW50Tm9kZSA9IHtcbiAgICB0eXBlOiBydWxlLmtleSwgXG4gICAgY2hpbGRyZW46W10sIFxuICAgIHN0YXJ0OnBvaW50ZXIsIFxuICAgIG5hbWU6cnVsZS5uYW1lLCBcbiAgICBsaW5lOnN0b2tlbi5saW5lLCBcbiAgICBjb2x1bW46c3Rva2VuLmNvbHVtblxuICB9O1xuXG4gIHdoaWxlKHJ0b2tlbiAmJiBzdG9rZW4pIHtcblxuICAgIC8vIENhc2Ugb25lOiB3ZSBoYXZlIGEgcnVsZSB3ZSBuZWVkIHRvIGRldmVsb3BcbiAgICBpZihncmFtbWFyW3J0b2tlbi50eXBlXSkge1xuXG4gICAgICB2YXIgZXhwYW5kX3J1bGVzID0gZ3JhbW1hcltydG9rZW4udHlwZV0ucnVsZXM7XG4gICAgICB2YXIgaG9va3MgPSBncmFtbWFyW3J0b2tlbi50eXBlXS5ob29rcztcbiAgICAgIHJlc3VsdCA9IGZhbHNlO1xuXG4gICAgICB2YXIgbSA9IG1lbW9pemF0aW9uW3J0b2tlbi50eXBlKyc7JytzcF07XG4gICAgICBpZihtKSB7XG4gICAgICAgIHJlc3VsdCA9IG07XG4gICAgICB9XG5cbiAgICAgIGlmKCFyZXN1bHQpIHtcbiAgICAgICAgZm9yKGo9MDsgajxleHBhbmRfcnVsZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICB2YXIgciA9IGV4cGFuZF9ydWxlc1tqXSwgaG9vayA9IGhvb2tzW2pdO1xuXG4gICAgICAgICAgcmVzdWx0ID0gbWVtb0V2YWwoZ3JhbW1hciwgciwgc3RyZWFtLCBzcCk7XG5cbiAgICAgICAgICBpZihyZXN1bHQpIHtcblxuICAgICAgICAgICAgcmVzdWx0Lmhvb2sgPSBob29rO1xuXG4gICAgICAgICAgICBtZW1vaXphdGlvbltyLmtleSsnOycrc3BdID0gcmVzdWx0O1xuXG4gICAgICAgICAgICBpZihydG9rZW4ucmVwZWF0ID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICB2YXIgbl9yZXN1bHQgPSBncm93TFIoZ3JhbW1hciwgcnVsZSwgc3RyZWFtLCBzcCwgcmVzdWx0KTtcbiAgICAgICAgICAgICAgaWYobl9yZXN1bHQgIT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5fcmVzdWx0O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYocmVzdWx0KSB7XG4gICAgICAgIHNwID0gcmVzdWx0LnNwO1xuICAgICAgICBjdXJyZW50Tm9kZS5jaGlsZHJlbi5wdXNoKHtcbiAgICAgICAgICAgIHR5cGU6IHJ0b2tlbi50eXBlLFxuICAgICAgICAgICAgY2hpbGRyZW46IHJlc3VsdC5jaGlsZHJlbixcbiAgICAgICAgICAgIHNwOnJlc3VsdC5zcCxcbiAgICAgICAgICAgIGxpbmU6IHJlc3VsdC5saW5lLFxuICAgICAgICAgICAgY29sdW1uOiByZXN1bHQuY29sdW1uLFxuICAgICAgICAgICAgaG9vazogcmVzdWx0Lmhvb2ssXG4gICAgICAgICAgICBuYW1lOiBydG9rZW4ubmFtZSxcbiAgICAgICAgICAgIHJlcGVhdDogcnRva2VuLnJlcGVhdFxuICAgICAgICAgIH0pO1xuICAgICAgICBpZighY2FuUmVwZWF0KHJ0b2tlbikpIHtcbiAgICAgICAgICBycCsrO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZighY2FuRmFpbChydG9rZW4sIGN1cnJlbnROb2RlKSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBycCsrO1xuICAgICAgfVxuXG4gICAgLy8gQ2FzZSB0d286IHdlIGhhdmUgYSBwcm9wZXIgdG9rZW5cbiAgICB9IGVsc2Uge1xuICAgICAgaWYoc3Rva2VuLnR5cGUgPT09IHJ0b2tlbi50eXBlKSB7XG4gICAgICAgIC8vY3VycmVudE5vZGUuY2hpbGRyZW4ucHVzaChjb3B5VG9rZW4oc3Rva2VuLCBydG9rZW4pKTtcbiAgICAgICAgaWYoIXJ0b2tlbi5ub25DYXB0dXJpbmcpIHtcbiAgICAgICAgICBjdXJyZW50Tm9kZS5jaGlsZHJlbi5wdXNoKGNvcHlUb2tlbihzdG9rZW4sIHJ0b2tlbikpO1xuICAgICAgICAgIHNwKys7XG4gICAgICAgIH1cbiAgICAgICAgaWYoIWNhblJlcGVhdChydG9rZW4pKSB7XG4gICAgICAgICAgcnArKztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYoIWNhbkZhaWwocnRva2VuLCBjdXJyZW50Tm9kZSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcnArKztcbiAgICAgIH1cblxuICAgIH1cblxuICAgIC8vIGluZm9ybWF0aW9uIHVzZWQgZm9yIGRlYnVnZ2luZyBwdXJwb3NlXG4gICAgaWYoYmVzdF9wID09PSBzcCkge1xuICAgICAgYmVzdF9wYXJzZS5jYW5kaWRhdGVzLnB1c2goW3J1bGUsIHJ1bGUudG9rZW5zW3JwXV0pO1xuICAgIH1cbiAgICBpZihiZXN0X3AgPCBzcCkge1xuICAgICAgYmVzdF9wYXJzZSA9IHtzcDpzcCwgY2FuZGlkYXRlczpbW3J1bGUsIHJ1bGUudG9rZW5zW3JwXV1dfTtcbiAgICAgIGJlc3RfcCA9IHNwO1xuICAgIH1cblxuICAgIC8vIGZldGNoIG5leHQgcnVsZSBhbmQgc3RyZWFtIHRva2VuXG4gICAgcnRva2VuID0gcnVsZS50b2tlbnNbcnBdO1xuICAgIHN0b2tlbiA9IHN0cmVhbVtzcF07XG5cbiAgICAvLyBydWxlIHNhdGlzZmllZFxuICAgIGlmKHJ0b2tlbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBjdXJyZW50Tm9kZS5zcCA9IHNwO1xuICAgICAgY3VycmVudE5vZGUucnAgPSBycDtcbiAgICAgIHJldHVybiBjdXJyZW50Tm9kZTtcbiAgICB9XG5cbiAgICAvLyBubyBtb3JlIHRva2Vuc1xuICAgIGlmKHN0b2tlbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZihjYW5GYWlsKHJ0b2tlbiwgY3VycmVudE5vZGUpKSB7XG4gICAgICAgIC8vIFRoaXMgZG9lcyBub3QgaGFwcGVuIG9mdGVuIGJlY2F1c2Ugb2YgRU9GLFxuICAgICAgICAvLyBBcyBpdCBzdGFuZHMgdGhlIGxhc3QgdG9rZW4gYXMgYWx3YXlzIHRvIGJlIEVPRlxuICAgICAgICBjdXJyZW50Tm9kZS5zcCA9IHNwO1xuICAgICAgICBjdXJyZW50Tm9kZS5ycCA9IHJwO1xuICAgICAgICByZXR1cm4gY3VycmVudE5vZGU7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gIH0gLy8gZW5kIHJ1bGUgYm9keSBsb29wXG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBzcGxpdFRyaW0obCwgc3BsaXQpIHtcbiAgcmV0dXJuIGwuc3BsaXQoc3BsaXQpLm1hcChmdW5jdGlvbihpKXsgcmV0dXJuIGkudHJpbSgpOyB9KTtcbn1cblxuZnVuY3Rpb24gZ3JhbW1hclRva2VuKHRva2VuKSB7XG4gIHZhciBub25DYXB0dXJpbmcgPSB0b2tlbi5jaGFyQXQoMCkgPT09ICchJztcbiAgaWYobm9uQ2FwdHVyaW5nKSB7XG4gICAgdG9rZW4gPSB0b2tlbi5zdWJzdHIoMSk7XG4gIH1cbiAgdmFyIHJlcGVhdCA9IHRva2VuLmNoYXJBdCh0b2tlbi5sZW5ndGggLSAxKTtcbiAgaWYocmVwZWF0ID09PSAnKicgfHwgcmVwZWF0ID09PSAnPycgfHwgcmVwZWF0ID09PSAnKycpIHtcbiAgICB0b2tlbiA9IHRva2VuLnN1YnN0cigwLCB0b2tlbi5sZW5ndGggLSAxKTtcbiAgfSBlbHNlIHtcbiAgICByZXBlYXQgPSBmYWxzZTtcbiAgfVxuICB2YXIgbmFtZWQgPSB0b2tlbi5zcGxpdChcIjpcIiksIHQ7XG4gIGlmKG5hbWVkLmxlbmd0aCA9PT0gMikge1xuICAgIHQgPSB7XG4gICAgICAndHlwZSc6IG5hbWVkWzFdLFxuICAgICAgJ25hbWUnIDpuYW1lZFswXVxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgdCA9IHsndHlwZSc6IHRva2VuIH07XG4gIH1cbiAgdC5yZXBlYXQgPSByZXBlYXQ7XG4gIGlmKChyZXBlYXQgPT09ICcqJyB8fCByZXBlYXQgPT09ICcrJykgJiYgbm9uQ2FwdHVyaW5nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiSW1wb3NzaWJsZSB0byBoYXZlIG5vbiBjYXB0dXJpbmcgdG9rZW4gdGhhdCByZXBlYXRzXCIpO1xuICB9XG4gIGlmKG5vbkNhcHR1cmluZykge1xuICAgIHQubm9uQ2FwdHVyaW5nID0gbm9uQ2FwdHVyaW5nO1xuICB9XG4gIHJldHVybiB0O1xufVxuXG5mdW5jdGlvbiBjb21waWxlR3JhbW1hcihncmFtbWFyLCB0b2tlbkRlZikge1xuICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGdyYW1tYXIpLCBpLCBqLCBrO1xuICB2YXIgZ3JhbSA9IHt9LCBvcHRpb25hbCwgbm9uQ2FwdHVyaW5nO1xuXG4gIGdyYW0udG9rZW5EZWYgPSB0b2tlbkRlZjtcbiAgZ3JhbS50b2tlbktleXMgPSBbXTtcbiAgZ3JhbS50b2tlbk1hcCA9IHt9O1xuICB0b2tlbkRlZi5tYXAoZnVuY3Rpb24odCkge1xuICAgIGdyYW0udG9rZW5NYXBbdC5rZXldID0gdDtcbiAgICBncmFtLnRva2VuS2V5cy5wdXNoKHQua2V5KTtcbiAgfSk7XG5cbiAgdmFyIGFsbFZhbGlkS2V5cyA9IGtleXMuY29uY2F0KGdyYW0udG9rZW5LZXlzKTtcblxuICBmb3IoaT0wOyBpPGtleXMubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgbGluZSA9IGdyYW1tYXJba2V5c1tpXV07XG4gICAgdmFyIGtleSA9IGtleXNbaV07XG4gICAgdmFyIHJ1bGVzID0gbGluZS5ydWxlcztcbiAgICB2YXIgaG9va3MgPSBbXTtcblxuICAgIHZhciBzcGxpdHRlZF9ydWxlcyA9IFtdO1xuXG4gICAgZm9yKGo9MDsgajxydWxlcy5sZW5ndGg7IGorKykge1xuICAgICAgdmFyIHRva2VucyA9IHNwbGl0VHJpbShydWxlc1tqXSwgJyAnKTtcbiAgICAgIG9wdGlvbmFsID0gMDtcbiAgICAgIGZvcihrPTA7IGs8dG9rZW5zLmxlbmd0aDsgaysrKSB7XG4gICAgICAgIHZhciB0b2tlbiA9IHRva2Vuc1trXSA9IGdyYW1tYXJUb2tlbih0b2tlbnNba10pO1xuICAgICAgICBpZihhbGxWYWxpZEtleXMuaW5kZXhPZih0b2tlbi50eXBlKSA9PT0gLTEgJiYgdG9rZW4udHlwZSAhPT0gJ0VPRicpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHRva2VuIHR5cGUgdXNlZCBpbiB0aGUgZ3JhbW1hciBydWxlIFwiK2tleStcIjogXCIgKyB0b2tlbi50eXBlICsgJywgdmFsaWQgdG9rZW5zIGFyZTogJythbGxWYWxpZEtleXMuam9pbignLCAnKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYodG9rZW4ucmVwZWF0ID09PSAnKicpIHtcbiAgICAgICAgICBvcHRpb25hbCArPSAxO1xuICAgICAgICB9XG4gICAgICAgIGlmKHRva2VuLm5vbkNhcHR1cmluZykge1xuICAgICAgICAgIGlmKHRva2Vuc1t0b2tlbnMubGVuZ3RoIC0gMV0gIT0gdG9rZW5zW2tdKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBIG5vbiBjYXB0dXJpbmcgdG9rZW4gY2FuIG9ubHkgYmUgdGhlIGxhc3Qgb25lIGluIHRoZSBydWxlOiBcIiArIHRva2VuLnR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYob3B0aW9uYWwgPT09IHRva2Vucy5sZW5ndGgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUnVsZSBcIiArIHJ1bGVzW2pdICsgXCIgb25seSBoYXMgb3B0aW9uYWwgZ3JlZWR5IHRva2Vucy5cIik7XG4gICAgICB9XG4gICAgICBzcGxpdHRlZF9ydWxlcy5wdXNoKHtrZXk6IGtleSwgaW5kZXg6aiwgdG9rZW5zOnRva2Vuc30pO1xuICAgICAgaWYodHlwZW9mIGxpbmUuaG9va3MgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICBob29rcy5wdXNoKGxpbmUuaG9va3MpO1xuICAgICAgfSBlbHNlIGlmKGxpbmUuaG9va3MpIHtcbiAgICAgICAgaWYobGluZS5ob29rc1tqXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW5jb3JyZWN0IG51bWJlciBvZiBob29rcyBhciBydWxlIFwiICsga2V5c1tpXSk7IFxuICAgICAgICB9XG4gICAgICAgIGhvb2tzLnB1c2gobGluZS5ob29rc1tqXSk7XG4gICAgICB9XG4gICAgfVxuICAgIGdyYW1ba2V5XSA9IHtydWxlczogc3BsaXR0ZWRfcnVsZXMsIGhvb2tzOiBob29rcyB8fCBbXSwgdmVyYm9zZTpsaW5lLnZlcmJvc2V9O1xuICB9XG4gIGdyYW0ucGFyc2UgPSBmdW5jdGlvbihzdHJlYW0pIHtcbiAgICByZXR1cm4gcGFyc2Uoc3RyZWFtLCBncmFtKTtcbiAgfTtcbiAgcmV0dXJuIGdyYW07XG59XG5cbmZ1bmN0aW9uIHNwYWNlcihuKSB7XG4gIHZhciBvdXQgPSBcIlwiO1xuICBmb3IodmFyIGk9MDsgaTxuOyBpKyspIHtcbiAgICBvdXQgKz0gXCIgXCI7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cblxuZnVuY3Rpb24gZXJyb3JNc2coaW5wdXQsIHRva2VuLCBlcnJvclR5cGUsIG0pIHtcblxuICB2YXIgY2hhcm4gPSB0b2tlbi5wb2ludGVyIHx8IDA7XG4gIHZhciBsaW5lcyA9IGlucHV0LnNwbGl0KFwiXFxuXCIpLCBpLCBjaGFyQ291bnRlciA9IDAsIGNoYXJPbkxpbmUgPSAwO1xuXG4gIGZvcihpPTA7IGk8bGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjaGFyQ291bnRlciArPSBsaW5lc1tpXS5sZW5ndGggKyAxO1xuICAgIGlmKGNoYXJDb3VudGVyID49IGNoYXJuKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY2hhck9uTGluZSArPSBsaW5lc1tpXS5sZW5ndGggKyAxO1xuICB9XG5cbiAgdmFyIGxuID0gTWF0aC5tYXgoMCwgaSk7IC8vIGxpbmUgbnVtYmVyXG4gIHZhciBtc2cgPSBlcnJvclR5cGUgKyBcIiBhdCBsaW5lIFwiKyhsbisxKStcIiBjaGFyIFwiKyAoY2hhcm4gLSBjaGFyT25MaW5lKSArXCI6IFwiO1xuICB2YXIgaW5kaWNhdG9yID0gXCJcXG5cIiArIHNwYWNlcigoY2hhcm4gLSBjaGFyT25MaW5lKSArICgobG4pICsgJzogJykubGVuZ3RoKTtcblxuICBpZihsaW5lc1tsbi0xXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgbXNnID0gbXNnICsgXCJcXG5cIiArIChsbikgKyAnOiAnICsgbGluZXNbbG4tMV07XG4gIH1cbiAgbXNnID0gbXNnICsgXCJcXG5cIiArIChsbisxKSArICc6ICcgKyBsaW5lc1tsbl0gKyBpbmRpY2F0b3I7XG4gIG1zZyA9IG1zZyArIFwiXi0tIFwiICsgbTtcblxuICBpZihsaW5lc1tsbisxXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgbXNnID0gbXNnICsgXCJcXG5cIiArIChsbisyKSArICc6ICcgKyBsaW5lc1tsbisxXTtcbiAgfVxuXG4gIHJldHVybiBtc2c7XG59XG5cbmZ1bmN0aW9uIHZlcmJvc2VOYW1lKGdyYW1tYXIsIHR5cGUpIHtcbiAgdmFyIHRva2VuZGVmID0gZ3JhbW1hci50b2tlbk1hcFt0eXBlXTtcbiAgaWYodG9rZW5kZWYgJiYgdG9rZW5kZWYudmVyYm9zZSkge1xuICAgIHJldHVybiB0b2tlbmRlZi52ZXJib3NlO1xuICB9XG4gIGlmKGdyYW1tYXJbdHlwZV0gJiYgZ3JhbW1hclt0eXBlXS52ZXJib3NlKSB7XG4gICAgcmV0dXJuIGdyYW1tYXJbdHlwZV0udmVyYm9zZTtcbiAgfVxuICByZXR1cm4gdHlwZTtcbn1cblxuZnVuY3Rpb24gaGludChpbnB1dCwgc3RyZWFtLCBiZXN0X3BhcnNlLCBncmFtbWFyKSB7XG4gIGlmKCFiZXN0X3BhcnNlIHx8ICFiZXN0X3BhcnNlLmNhbmRpZGF0ZXNbMF0pIHtcbiAgICByZXR1cm4gXCJDb21wbGV0ZSBmYWlsdXJlIHRvIHBhcnNlXCI7XG4gIH1cbiAgdmFyIHJ1bGUgPSBiZXN0X3BhcnNlLmNhbmRpZGF0ZXNbMF1bMF07XG5cbiAgdmFyIGFycmF5ID0gW107XG4gIGJlc3RfcGFyc2UuY2FuZGlkYXRlcy5tYXAoZnVuY3Rpb24ocikge1xuICAgIGlmKCFyWzFdKSB7IHJldHVybjsgfVxuICAgIHZhciBuYW1lID0gdmVyYm9zZU5hbWUoZ3JhbW1hciwgclsxXS50eXBlKTtcbiAgICBpZihhcnJheS5pbmRleE9mKG5hbWUpID09PSAtMSkge1xuICAgICAgYXJyYXkucHVzaChuYW1lKTtcbiAgICB9XG4gIH0pO1xuICB2YXIgY2FuZGlkYXRlcyA9IGFycmF5LmpvaW4oJyBvciAnKTtcblxuICB2YXIgbXNnID0gZXJyb3JNc2coaW5wdXQsIHN0cmVhbVtiZXN0X3BhcnNlLnNwXSwgXCJQYXJzZXIgZXJyb3JcIiwgXCJSdWxlIFwiICsgdmVyYm9zZU5hbWUoZ3JhbW1hciwgcnVsZS5rZXkpKTtcbiAgbXNnID0gbXNnICsgXCJcXG5FeHBlY3QgXCIgKyBjYW5kaWRhdGVzO1xuICB2YXIgbGFzdFRva2VuID0gc3RyZWFtW2Jlc3RfcGFyc2Uuc3BdIHx8IHt0eXBlOlwiRU9GXCJ9O1xuICBtc2cgPSBtc2cgKyBcIlxcbkJ1dCBnb3QgXCIgKyB2ZXJib3NlTmFtZShncmFtbWFyLCBsYXN0VG9rZW4udHlwZSkgKyBcIiBpbnN0ZWFkXCI7XG5cbiAgcmV0dXJuIG1zZztcbn1cblxuLy8gdGhvc2UgYXJlIG1vZHVsZSBnbG9iYWxzXG52YXIgc3RhY2sgPSBbXTtcbnZhciBtZW1vaXphdGlvbiA9IHt9O1xudmFyIGJlc3RfcGFyc2UgPSBudWxsO1xudmFyIGJlc3RfcCA9IDA7XG5cbmZ1bmN0aW9uIGhvb2tUcmVlKG5vZGUpIHtcbiAgaWYoIW5vZGUuY2hpbGRyZW4pIHtcbiAgICByZXR1cm47XG4gIH1cbiAgZm9yKHZhciBpPTA7IGk8bm9kZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgIGhvb2tUcmVlKG5vZGUuY2hpbGRyZW5baV0pO1xuICB9XG4gIGlmKG5vZGUuaG9vaykge1xuICAgIG5vZGUuY2hpbGRyZW4gPSBub2RlLmhvb2soY3JlYXRlUGFyYW1zKG5vZGUuY2hpbGRyZW4pKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwYXJzZShpbnB1dCwgZ3JhbW1hcikge1xuICB2YXIgYmVzdFJlc3VsdCA9IHt0eXBlOidTVEFSVCcsIHNwOjAsIGNvbXBsZXRlOmZhbHNlfSwgaSwgcmVzdWx0LCBzdHJlYW07XG4gIC8vaWYodHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJykge1xuICBzdHJlYW0gPSB0b2tlbml6ZShpbnB1dCwgZ3JhbW1hcik7XG4gIC8vfVxuICBiZXN0X3BhcnNlID0ge3NwOjAsIGNhbmRpZGF0ZXM6W119O1xuICBiZXN0X3AgPSAwO1xuICBmb3IoaT0wOyBpPGdyYW1tYXIuU1RBUlQucnVsZXMubGVuZ3RoOyBpKyspIHtcbiAgICBzdGFjayA9IFtdO1xuICAgIG1lbW9pemF0aW9uID0ge307XG4gICAgcmVzdWx0ID0gbWVtb0V2YWwoZ3JhbW1hciwgZ3JhbW1hci5TVEFSVC5ydWxlc1tpXSwgc3RyZWFtLCAwKTtcbiAgICBpZihyZXN1bHQgJiYgcmVzdWx0LnNwID4gYmVzdFJlc3VsdC5zcCkge1xuICAgICAgYmVzdFJlc3VsdCA9IHtcbiAgICAgICAgdHlwZTonU1RBUlQnLFxuICAgICAgICBjaGlsZHJlbjpyZXN1bHQuY2hpbGRyZW4sXG4gICAgICAgIHNwOiByZXN1bHQuc3AsXG4gICAgICAgIGxpbmU6IDEsXG4gICAgICAgIGNvbHVtbjogMSxcbiAgICAgICAgY29tcGxldGU6cmVzdWx0LnNwID09PSBzdHJlYW0ubGVuZ3RoLFxuICAgICAgICBpbnB1dExlbmd0aDpzdHJlYW0ubGVuZ3RoLFxuICAgICAgfTtcbiAgICB9XG4gIH1cbiAgYmVzdFJlc3VsdC5iZXN0UGFyc2UgPSBiZXN0X3BhcnNlO1xuICBob29rVHJlZShiZXN0UmVzdWx0KTtcbiAgaWYoYmVzdF9wYXJzZSAmJiAhYmVzdFJlc3VsdC5jb21wbGV0ZSkge1xuICAgIGJlc3RSZXN1bHQuaGludCA9IGhpbnQoaW5wdXQsIHN0cmVhbSwgYmVzdF9wYXJzZSwgZ3JhbW1hcik7XG4gIH1cbiAgcmV0dXJuIGJlc3RSZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBwYXJzZTogcGFyc2UsXG4gIHN0YWNrOiBzdGFjayxcbiAgY29tcGlsZUdyYW1tYXI6IGNvbXBpbGVHcmFtbWFyLFxuICB0b2tlbml6ZTogdG9rZW5pemUsXG4gIG1lbW9pemF0aW9uOiBtZW1vaXphdGlvblxufTtcblxufSx7fV19LHt9LFsxXSkoMSlcbn0pO1xuXG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW01dlpHVmZiVzlrZFd4bGN5OWxjR1ZuYW5NdlpHbHpkQzl1YjJSbFgyMXZaSFZzWlhNdlluSnZkM05sY21sbWVTOXViMlJsWDIxdlpIVnNaWE12WW5KdmQzTmxjaTF3WVdOckwxOXdjbVZzZFdSbExtcHpJaXdpYm05a1pWOXRiMlIxYkdWekwyVndaV2RxY3k5a2FYTjBMMFZRUlVjdWFuTWlYU3dpYm1GdFpYTWlPbHRkTENKdFlYQndhVzVuY3lJNklqdEJRVUZCTzBGRFFVRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRU0lzSW1acGJHVWlPaUpuWlc1bGNtRjBaV1F1YW5NaUxDSnpiM1Z5WTJWU2IyOTBJam9pSWl3aWMyOTFjbU5sYzBOdmJuUmxiblFpT2xzaUtHWjFibU4wYVc5dUlHVW9kQ3h1TEhJcGUyWjFibU4wYVc5dUlITW9ieXgxS1h0cFppZ2hibHR2WFNsN2FXWW9JWFJiYjEwcGUzWmhjaUJoUFhSNWNHVnZaaUJ5WlhGMWFYSmxQVDFjSW1aMWJtTjBhVzl1WENJbUpuSmxjWFZwY21VN2FXWW9JWFVtSm1FcGNtVjBkWEp1SUdFb2J5d2hNQ2s3YVdZb2FTbHlaWFIxY200Z2FTaHZMQ0V3S1R0MllYSWdaajF1WlhjZ1JYSnliM0lvWENKRFlXNXViM1FnWm1sdVpDQnRiMlIxYkdVZ0oxd2lLMjhyWENJblhDSXBPM1JvY205M0lHWXVZMjlrWlQxY0lrMVBSRlZNUlY5T1QxUmZSazlWVGtSY0lpeG1mWFpoY2lCc1BXNWJiMTA5ZTJWNGNHOXlkSE02ZTMxOU8zUmJiMTFiTUYwdVkyRnNiQ2hzTG1WNGNHOXlkSE1zWm5WdVkzUnBiMjRvWlNsN2RtRnlJRzQ5ZEZ0dlhWc3hYVnRsWFR0eVpYUjFjbTRnY3lodVAyNDZaU2w5TEd3c2JDNWxlSEJ2Y25SekxHVXNkQ3h1TEhJcGZYSmxkSFZ5YmlCdVcyOWRMbVY0Y0c5eWRITjlkbUZ5SUdrOWRIbHdaVzltSUhKbGNYVnBjbVU5UFZ3aVpuVnVZM1JwYjI1Y0lpWW1jbVZ4ZFdseVpUdG1iM0lvZG1GeUlHODlNRHR2UEhJdWJHVnVaM1JvTzI4ckt5bHpLSEpiYjEwcE8zSmxkSFZ5YmlCemZTa2lMQ0l2S2x4dUlDQktZWFpoVTJOeWFYQjBJR2x0Y0d4bGJXVnVkR0YwYVc5dUlHOW1JR0VnVUdGamEzSmhkQ0JRWVhKelpYSnpJSGRwZEdnZ2JHVm1kQ0JTWldOMWNuTnBiMjRnVTNWd2NHOXlkRnh1SUNCb2RIUndPaTh2ZDNkM0xuWndjbWt1YjNKbkwzQmtaaTkwY2pJd01EY3dNREpmY0dGamEzSmhkQzV3WkdaY2JseHVJQ0JPYnlCSmJtUnBjbVZqZENCTVpXWjBJRkpsWTNWeWMybHZiaUI1WlhRZ09pMG9YRzVjYmlBZ1FtRjBhWE4wWlNCQ2FXVnNaWElnTWpBeE5GeHVLaTljYmx3aWRYTmxJSE4wY21samRGd2lPMXh1WEc1bWRXNWpkR2x2YmlCMGIydGxibWw2WlNocGJuQjFkQ3dnWjNKaGJTa2dlMXh1SUNCMllYSWdhMlY1Y3lBOUlHZHlZVzB1ZEc5clpXNUxaWGx6TzF4dUlDQjJZWElnZEc5clpXNXpJRDBnWjNKaGJTNTBiMnRsYmsxaGNEdGNiaUFnZG1GeUlITjBjbVZoYlNBOUlGdGRPMXh1SUNCMllYSWdiR1Z1SUQwZ2FXNXdkWFF1YkdWdVozUm9MQ0JqWVc1a2FXUmhkR1VzSUdrc0lHdGxlU3dnWTI5d2VTQTlJR2x1Y0hWMExDQnNZWE4wVkc5clpXNGdQU0J1ZFd4c08xeHVJQ0IyWVhJZ2NHOXBiblJsY2lBOUlEQTdYRzRnSUhaaGNpQnNhVzVsSUQwZ01EdGNiaUFnZG1GeUlHTnZiSFZ0YmlBOUlEQTdYRzVjYmlBZ2QyaHBiR1VvY0c5cGJuUmxjaUE4SUd4bGJpa2dlMXh1SUNBZ0lHTmhibVJwWkdGMFpTQTlJRzUxYkd3N1hHNGdJQ0FnWm05eUtHazlNRHNnYVR4clpYbHpMbXhsYm1kMGFEc2dhU3NyS1NCN1hHNGdJQ0FnSUNCclpYa2dQU0JyWlhselcybGRPMXh1SUNBZ0lDQWdkbUZ5SUhSdmEyVnVJRDBnZEc5clpXNXpXMnRsZVYwc0lHMWhkR05vTzF4dUlDQWdJQ0FnYVdZb2RHOXJaVzR1Wm5WdVl5a2dlMXh1SUNBZ0lDQWdJQ0J0WVhSamFDQTlJSFJ2YTJWdUxtWjFibU1vYVc1d2RYUXNJSE4wY21WaGJTazdYRzRnSUNBZ0lDQWdJR2xtS0cxaGRHTm9JQ0U5UFNCMWJtUmxabWx1WldRcElIdGNiaUFnSUNBZ0lDQWdJQ0JqWVc1a2FXUmhkR1VnUFNCdFlYUmphRHRjYmlBZ0lDQWdJQ0FnSUNCaWNtVmhhenRjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnZlNCbGJITmxJR2xtS0hSdmEyVnVMbkpsWnlsN1hHNGdJQ0FnSUNBZ0lHMWhkR05vSUQwZ2FXNXdkWFF1YldGMFkyZ29kRzlyWlc0dWNtVm5LVHRjYmlBZ0lDQWdJQ0FnYVdZb2JXRjBZMmdnSVQwOUlHNTFiR3dwSUh0Y2JpQWdJQ0FnSUNBZ0lDQmpZVzVrYVdSaGRHVWdQU0J0WVhSamFGc3dYVHRjYmlBZ0lDQWdJQ0FnSUNCaWNtVmhhenRjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnZlNCbGJITmxJR2xtS0hSdmEyVnVMbk4wY2lsN1hHNGdJQ0FnSUNBZ0lHMWhkR05vSUQwZ2FXNXdkWFF1YVc1a1pYaFBaaWgwYjJ0bGJpNXpkSElwTzF4dUlDQWdJQ0FnSUNCcFppaHRZWFJqYUNBOVBUMGdNQ2tnZTF4dUlDQWdJQ0FnSUNBZ0lHTmhibVJwWkdGMFpTQTlJSFJ2YTJWdUxuTjBjanRjYmlBZ0lDQWdJQ0FnSUNCaWNtVmhhenRjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnZlNCbGJITmxJSHRjYmlBZ0lDQWdJQ0FnZEdoeWIzY2dibVYzSUVWeWNtOXlLRndpVkc5clpXNXBlbVZ5SUdWeWNtOXlPaUJKYm5aaGJHbGtJSFJ2YTJWdUlGd2lJQ3NnYTJWNUlDc2dYQ0lnZDJsMGFHOTFkQ0JoSUhKbFp5d2djM1J5SUc5eUlHWjFibU1nY0hKdmNHVnlkSGxjSWlrN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnZlZ4dUlDQWdJR2xtS0dOaGJtUnBaR0YwWlNBaFBUMGdiblZzYkNrZ2UxeHVJQ0FnSUNBZ2JHRnpkRlJ2YTJWdUlEMGdlM1I1Y0dVNmEyVjVMQ0IyWVd4MVpUcGpZVzVrYVdSaGRHVXNJSEJ2YVc1MFpYSTZjRzlwYm5SbGNpd2diR2x1WlRwc2FXNWxLekVzSUdOdmJIVnRianBqYjJ4MWJXNHJNWDA3WEc0Z0lDQWdJQ0J6ZEhKbFlXMHVjSFZ6YUNoc1lYTjBWRzlyWlc0cE8xeHVJQ0FnSUNBZ2RtRnlJR3hwYm1WZlluSmxZV3R6WDJOdmRXNTBJRDBnWTI5MWJuUk1hVzVsUW5KbFlXc29ZMkZ1Wkdsa1lYUmxLVHRjYmlBZ0lDQWdJR3hwYm1VZ0t6MGdiR2x1WlY5aWNtVmhhM05mWTI5MWJuUTdYRzRnSUNBZ0lDQnBaaWhzYVc1bFgySnlaV0ZyYzE5amIzVnVkQ0ErSURBcElIdGNiaUFnSUNBZ0lDQWdZMjlzZFcxdUlEMGdNRHRjYmlBZ0lDQWdJSDFjYmlBZ0lDQWdJR052YkhWdGJpQXJQU0JqYjNWdWRFTnZiSFZ0YmloallXNWthV1JoZEdVcE8xeHVJQ0FnSUNBZ2NHOXBiblJsY2lBclBTQmpZVzVrYVdSaGRHVXViR1Z1WjNSb08xeHVJQ0FnSUNBZ2FXNXdkWFFnUFNCcGJuQjFkQzV6ZFdKemRISW9ZMkZ1Wkdsa1lYUmxMbXhsYm1kMGFDazdYRzRnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUdsbUtITjBjbVZoYlM1c1pXNW5kR2dnUFQwOUlEQXBJSHRjYmlBZ0lDQWdJQ0FnZEdoeWIzY2dibVYzSUVWeWNtOXlLRndpVkc5clpXNXBlbVZ5SUdWeWNtOXlPaUIwYjNSaGJDQnRZWFJqYUNCbVlXbHNkWEpsWENJcE8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2FXWW9iR0Z6ZEZSdmEyVnVLVnh1SUNBZ0lDQWdJQ0JzWVhOMFZHOXJaVzR1Y0c5cGJuUmxjaUFyUFNCc1lYTjBWRzlyWlc0dWRtRnNkV1V1YkdWdVozUm9PMXh1SUNBZ0lDQWdkbUZ5SUcxelp5QTlJR1Z5Y205eVRYTm5LR052Y0hrc0lITjBjbVZoYlZ0emRISmxZVzB1YkdWdVozUm9JQzBnTVYwc0lGd2lWRzlyWlc1cGVtVnlJR1Z5Y205eVhDSXNJRndpVG04Z2JXRjBZMmhwYm1jZ2RHOXJaVzRnWm05MWJtUmNJaWs3WEc0Z0lDQWdJQ0JwWmloc1lYTjBWRzlyWlc0cFhHNGdJQ0FnSUNBZ0lHMXpaeUFyUFNCY0lseGNibHdpSUNzZ1hDSkNaV1p2Y21VZ2RHOXJaVzRnYjJZZ2RIbHdaU0JjSWlBcklHeGhjM1JVYjJ0bGJpNTBlWEJsSUNzZ1hDSTZJRndpSUNzZ2JHRnpkRlJ2YTJWdUxuWmhiSFZsTzF4dUlDQWdJQ0FnZEdoeWIzY2dibVYzSUVWeWNtOXlLRzF6WnlrN1hHNGdJQ0FnZlZ4dUlDQjlYRzRnSUhOMGNtVmhiUzV3ZFhOb0tIdDBlWEJsT2lkRlQwWW5MQ0IyWVd4MVpUcGNJbHdpZlNrN1hHNGdJSEpsZEhWeWJpQnpkSEpsWVcwN1hHNTlYRzVjYm1aMWJtTjBhVzl1SUdOdmRXNTBUR2x1WlVKeVpXRnJLSE4wY2lrZ2UxeHVJQ0IyWVhJZ2JTQTlJSE4wY2k1emNHeHBkQ2d2WEZ4dUwyY3BPMXh1SUNCeVpYUjFjbTRnYlM1c1pXNW5kR2dnTFNBeE8xeHVmVnh1WEc1bWRXNWpkR2x2YmlCamIzVnVkRU52YkhWdGJpaHpkSElwSUh0Y2JpQWdkbUZ5SUcwZ1BTQnpkSEl1YzNCc2FYUW9MMXhjYmk5bktUdGNiaUFnY21WMGRYSnVJRzFiYlM1c1pXNW5kR2d0TVYwdWJHVnVaM1JvTzF4dWZWeHVYRzVtZFc1amRHbHZiaUJqYjNCNVZHOXJaVzRvYzNSdmEyVnVMQ0J5ZEc5clpXNHBJSHRjYmlBZ2RtRnlJSFFnUFNCN1hHNGdJQ0FnZEhsd1pUcHpkRzlyWlc0dWRIbHdaU3hjYmlBZ0lDQjJZV3gxWlRwemRHOXJaVzR1ZG1Gc2RXVXNYRzRnSUNBZ2NtVndaV0YwT25KMGIydGxiaTV5WlhCbFlYUXNYRzRnSUNBZ2JHbHVaVHB6ZEc5clpXNHViR2x1WlN4Y2JpQWdJQ0JqYjJ4MWJXNDZjM1J2YTJWdUxtTnZiSFZ0Ymx4dUlDQjlPMXh1SUNCcFppaHlkRzlyWlc0dWJtRnRaU2tnZTF4dUlDQWdJSFF1Ym1GdFpTQTlJSEowYjJ0bGJpNXVZVzFsTzF4dUlDQjlYRzRnSUhKbGRIVnliaUIwTzF4dWZWeHVYRzVtZFc1amRHbHZiaUJqY21WaGRHVlFZWEpoYlhNb2RHOXJaVzV6S1NCN1hHNGdJSFpoY2lCd1lYSmhiWE1nUFNCN2ZUdGNiaUFnZG1GeUlHb2dQU0F3TzF4dUlDQjBiMnRsYm5NdWJXRndLR1oxYm1OMGFXOXVLR2twSUh0Y2JpQWdJQ0JwWmlocExtNWhiV1VwSUh0Y2JpQWdJQ0FnSUdsbUtHa3VjbVZ3WldGMElEMDlJQ2NxSnlCOGZDQnBMbkpsY0dWaGRDQTlQU0FuS3ljcElIdGNiaUFnSUNBZ0lDQWdhV1lvSVhCaGNtRnRjMXRwTG01aGJXVmRLU0I3WEc0Z0lDQWdJQ0FnSUNBZ2NHRnlZVzF6VzJrdWJtRnRaVjBnUFNCYlhUdGNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0J3WVhKaGJYTmJhUzV1WVcxbFhTNXdkWE5vS0drcE8xeHVJQ0FnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ2NHRnlZVzF6VzJrdWJtRnRaVjBnUFNCcE8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgxY2JpQWdJQ0J3WVhKaGJYTmJKeVFuSzJwZElEMGdhVHRjYmlBZ0lDQnFLeXM3WEc0Z0lIMHBPMXh1SUNCeVpYUjFjbTRnY0dGeVlXMXpPMXh1ZlZ4dVhHNW1kVzVqZEdsdmJpQm5jbTkzVEZJb1ozSmhiVzFoY2l3Z2NuVnNaU3dnYzNSeVpXRnRMQ0J3YjNNc0lHMWxiVzhwSUh0Y2JpQWdkbUZ5SUhOd0xDQnlaWE4xYkhRc0lIQnliMmR5WlhOeklEMGdabUZzYzJVN1hHNGdJSFpoY2lCb2IyOXJJRDBnWjNKaGJXMWhjbHR5ZFd4bExtdGxlVjB1YUc5dmEzTmJjblZzWlM1cGJtUmxlRjA3WEc1Y2JpQWdkMmhwYkdVb2RISjFaU2tnZTF4dUlDQWdJSE53SUQwZ2NHOXpPMXh1WEc0Z0lDQWdjbVZ6ZFd4MElEMGdaWFpoYkZKMWJHVkNiMlI1S0dkeVlXMXRZWElzSUhKMWJHVXNJSE4wY21WaGJTd2djM0FwTzF4dVhHNGdJQ0FnTHk4Z1pXNXpkWEpsSUhOdmJXVWdjSEp2WjNKbGMzTWdhWE1nYldGa1pWeHVJQ0FnSUdsbUtISmxjM1ZzZENBOVBUMGdabUZzYzJVZ2ZId2djbVZ6ZFd4MExuTndJRHc5SUcxbGJXOHVjM0FwSUh0Y2JpQWdJQ0FnSUhKbGRIVnliaUJ3Y205bmNtVnpjenRjYmlBZ0lDQjlYRzVjYmlBZ0lDQnlaWE4xYkhRdWFHOXZheUE5SUdodmIyczdYRzVjYmlBZ0lDQXZMeUJwZENkeklIWmxjbmtnYVcxd2IzSjBZVzUwSUhSdklIVndaR0YwWlNCMGFHVWdiV1Z0YjJsNlpXUWdkbUZzZFdWY2JpQWdJQ0F2THlCMGFHbHpJR2x6SUdGamRIVmhiR3g1SUdkeWIzZHBibWNnZEdobElITmxaV1FnYVc0Z2RHaGxJRzFsYlc5cGVtRjBhVzl1WEc0Z0lDQWdiV1Z0Ynk1amFHbHNaSEpsYmlBOUlISmxjM1ZzZEM1amFHbHNaSEpsYmp0Y2JpQWdJQ0J0WlcxdkxuTndJRDBnY21WemRXeDBMbk53TzF4dUlDQWdJRzFsYlc4dWJHbHVaU0E5SUhKbGMzVnNkQzVzYVc1bE8xeHVJQ0FnSUcxbGJXOHVZMjlzZFcxdUlEMGdjbVZ6ZFd4MExtTnZiSFZ0Ymp0Y2JpQWdJQ0J0WlcxdkxuTjBZWEowSUQwZ2NtVnpkV3gwTG5OMFlYSjBPMXh1SUNBZ0lHMWxiVzh1YUc5dmEyVmtJRDBnY21WemRXeDBMbWh2YjJ0bFpEdGNiaUFnSUNCdFpXMXZMbWh2YjJzZ1BTQnlaWE4xYkhRdWFHOXZhenRjYmlBZ0lDQndjbTluY21WemN5QTlJSEpsYzNWc2REdGNiaUFnZlZ4dUlDQnlaWFIxY200Z2NISnZaM0psYzNNN1hHNTlYRzVjYm1aMWJtTjBhVzl1SUcxbGJXOUZkbUZzS0dkeVlXMXRZWElzSUhKMWJHVXNJSE4wY21WaGJTd2djRzlwYm5SbGNpa2dlMXh1WEc0Z0lIWmhjaUJyWlhrZ1BTQnlkV3hsTG10bGVTc25PeWNyY0c5cGJuUmxjaXNuT3ljcmNuVnNaUzVwYm1SbGVEdGNibHh1SUNBdkx5QmhkbTlwWkNCcGJtWnBibWwwWlNCeVpXTjFjbk5wYjI1Y2JpQWdMeThnVkdocGN5QnBjeUJtWVhOMFpYSWdkR2hoYmlCbWFXeDBaWEpjYmlBZ2RtRnlJR2tnUFNCemRHRmpheTVzWlc1bmRHZ2dMU0F4TzF4dUlDQjNhR2xzWlNocElENDlJREFwSUh0Y2JpQWdJQ0JwWmloemRHRmphMXRwWFZzd1hTQTlQU0JyWlhrcElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlCbVlXeHpaVHRjYmlBZ0lDQjlYRzRnSUNBZ2FTQTlJR2t0TVR0Y2JpQWdmVnh1WEc0Z0lIWmhjaUJ0WlcxdlgyVnVkSEo1SUQwZ2JXVnRiMmw2WVhScGIyNWJjblZzWlM1clpYa3JKenNuSzNCdmFXNTBaWEpkTzF4dUlDQnBaaWh0WlcxdlgyVnVkSEo1SUNFOVBTQjFibVJsWm1sdVpXUXBJSHRjYmlBZ0lDQnlaWFIxY200Z2JXVnRiMTlsYm5SeWVUdGNiaUFnZlZ4dVhHNGdJSE4wWVdOckxuQjFjMmdvVzJ0bGVTd2djblZzWlYwcE8xeHVJQ0IyWVhJZ2NtVnpkV3gwSUQwZ1pYWmhiRkoxYkdWQ2IyUjVLR2R5WVcxdFlYSXNJSEoxYkdVc0lITjBjbVZoYlN3Z2NHOXBiblJsY2lrN1hHNGdJSE4wWVdOckxuQnZjQ2dwTzF4dVhHNGdJSEpsZEhWeWJpQnlaWE4xYkhRN1hHNTlYRzVjYm1aMWJtTjBhVzl1SUdOaGJrWmhhV3dvZEc5clpXNHNJRzV2WkdVcElIdGNiaUFnYVdZb2RHOXJaVzR1Y21Wd1pXRjBJRDA5UFNBbktpY2dmSHdnZEc5clpXNHVjbVZ3WldGMElEMDlQU0FuUHljcElIdGNiaUFnSUNCeVpYUjFjbTRnZEhKMVpUdGNiaUFnZlZ4dUlDQnBaaWgwYjJ0bGJpNXlaWEJsWVhRZ1BUMDlJQ2NySnlBbUppQnViMlJsTG1Ob2FXeGtjbVZ1TG14bGJtZDBhQ0FtSmlCdWIyUmxMbU5vYVd4a2NtVnVXMjV2WkdVdVkyaHBiR1J5Wlc0dWJHVnVaM1JvSUMwZ01WMHVkSGx3WlNBOVBTQjBiMnRsYmk1MGVYQmxLU0I3WEc0Z0lDQWdjbVYwZFhKdUlIUnlkV1U3WEc0Z0lIMWNiaUFnY21WMGRYSnVJR1poYkhObE8xeHVmVnh1WEc1bWRXNWpkR2x2YmlCallXNVNaWEJsWVhRb2RHOXJaVzRwSUh0Y2JpQWdjbVYwZFhKdUlIUnZhMlZ1TG5KbGNHVmhkQ0E5UFQwZ0p5b25JSHg4SUhSdmEyVnVMbkpsY0dWaGRDQTlQVDBnSnlzbk8xeHVmVnh1WEc1bWRXNWpkR2x2YmlCbGRtRnNVblZzWlVKdlpIa29aM0poYlcxaGNpd2djblZzWlN3Z2MzUnlaV0Z0TENCd2IybHVkR1Z5S1NCN1hHNWNiaUFnZG1GeUlITndJRDBnY0c5cGJuUmxjanNnTHk4Z2MzUnlaV0Z0SUhCdmFXNTBaWEpjYmlBZ2RtRnlJSEp3SUQwZ01Ec2dJQ0FnSUNBZ0x5OGdjblZzWlNCd2IybHVkR1Z5WEc0Z0lIWmhjaUJxTENCeVpYTjFiSFE3WEc1Y2JpQWdkbUZ5SUhKMGIydGxiaUE5SUhKMWJHVXVkRzlyWlc1elczSndYVHRjYmlBZ2RtRnlJSE4wYjJ0bGJpQTlJSE4wY21WaGJWdHpjRjA3WEc1Y2JpQWdkbUZ5SUdOMWNuSmxiblJPYjJSbElEMGdlMXh1SUNBZ0lIUjVjR1U2SUhKMWJHVXVhMlY1TENCY2JpQWdJQ0JqYUdsc1pISmxianBiWFN3Z1hHNGdJQ0FnYzNSaGNuUTZjRzlwYm5SbGNpd2dYRzRnSUNBZ2JtRnRaVHB5ZFd4bExtNWhiV1VzSUZ4dUlDQWdJR3hwYm1VNmMzUnZhMlZ1TG14cGJtVXNJRnh1SUNBZ0lHTnZiSFZ0YmpwemRHOXJaVzR1WTI5c2RXMXVYRzRnSUgwN1hHNWNiaUFnZDJocGJHVW9jblJ2YTJWdUlDWW1JSE4wYjJ0bGJpa2dlMXh1WEc0Z0lDQWdMeThnUTJGelpTQnZibVU2SUhkbElHaGhkbVVnWVNCeWRXeGxJSGRsSUc1bFpXUWdkRzhnWkdWMlpXeHZjRnh1SUNBZ0lHbG1LR2R5WVcxdFlYSmJjblJ2YTJWdUxuUjVjR1ZkS1NCN1hHNWNiaUFnSUNBZ0lIWmhjaUJsZUhCaGJtUmZjblZzWlhNZ1BTQm5jbUZ0YldGeVczSjBiMnRsYmk1MGVYQmxYUzV5ZFd4bGN6dGNiaUFnSUNBZ0lIWmhjaUJvYjI5cmN5QTlJR2R5WVcxdFlYSmJjblJ2YTJWdUxuUjVjR1ZkTG1odmIydHpPMXh1SUNBZ0lDQWdjbVZ6ZFd4MElEMGdabUZzYzJVN1hHNWNiaUFnSUNBZ0lIWmhjaUJ0SUQwZ2JXVnRiMmw2WVhScGIyNWJjblJ2YTJWdUxuUjVjR1VySnpzbkszTndYVHRjYmlBZ0lDQWdJR2xtS0cwcElIdGNiaUFnSUNBZ0lDQWdjbVZ6ZFd4MElEMGdiVHRjYmlBZ0lDQWdJSDFjYmx4dUlDQWdJQ0FnYVdZb0lYSmxjM1ZzZENrZ2UxeHVJQ0FnSUNBZ0lDQm1iM0lvYWowd095QnFQR1Y0Y0dGdVpGOXlkV3hsY3k1c1pXNW5kR2c3SUdvckt5a2dlMXh1SUNBZ0lDQWdJQ0FnSUhaaGNpQnlJRDBnWlhod1lXNWtYM0oxYkdWelcycGRMQ0JvYjI5cklEMGdhRzl2YTNOYmFsMDdYRzVjYmlBZ0lDQWdJQ0FnSUNCeVpYTjFiSFFnUFNCdFpXMXZSWFpoYkNobmNtRnRiV0Z5TENCeUxDQnpkSEpsWVcwc0lITndLVHRjYmx4dUlDQWdJQ0FnSUNBZ0lHbG1LSEpsYzNWc2RDa2dlMXh1WEc0Z0lDQWdJQ0FnSUNBZ0lDQnlaWE4xYkhRdWFHOXZheUE5SUdodmIyczdYRzVjYmlBZ0lDQWdJQ0FnSUNBZ0lHMWxiVzlwZW1GMGFXOXVXM0l1YTJWNUt5YzdKeXR6Y0YwZ1BTQnlaWE4xYkhRN1hHNWNiaUFnSUNBZ0lDQWdJQ0FnSUdsbUtISjBiMnRsYmk1eVpYQmxZWFFnUFQwOUlHWmhiSE5sS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUhaaGNpQnVYM0psYzNWc2RDQTlJR2R5YjNkTVVpaG5jbUZ0YldGeUxDQnlkV3hsTENCemRISmxZVzBzSUhOd0xDQnlaWE4xYkhRcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNCcFppaHVYM0psYzNWc2RDQWhQVDBnWm1Gc2MyVXBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdibDl5WlhOMWJIUTdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJR0p5WldGck8xeHVJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnZlZ4dVhHNGdJQ0FnSUNCcFppaHlaWE4xYkhRcElIdGNiaUFnSUNBZ0lDQWdjM0FnUFNCeVpYTjFiSFF1YzNBN1hHNGdJQ0FnSUNBZ0lHTjFjbkpsYm5ST2IyUmxMbU5vYVd4a2NtVnVMbkIxYzJnb2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnZEhsd1pUb2djblJ2YTJWdUxuUjVjR1VzWEc0Z0lDQWdJQ0FnSUNBZ0lDQmphR2xzWkhKbGJqb2djbVZ6ZFd4MExtTm9hV3hrY21WdUxGeHVJQ0FnSUNBZ0lDQWdJQ0FnYzNBNmNtVnpkV3gwTG5Od0xGeHVJQ0FnSUNBZ0lDQWdJQ0FnYkdsdVpUb2djbVZ6ZFd4MExteHBibVVzWEc0Z0lDQWdJQ0FnSUNBZ0lDQmpiMngxYlc0NklISmxjM1ZzZEM1amIyeDFiVzRzWEc0Z0lDQWdJQ0FnSUNBZ0lDQm9iMjlyT2lCeVpYTjFiSFF1YUc5dmF5eGNiaUFnSUNBZ0lDQWdJQ0FnSUc1aGJXVTZJSEowYjJ0bGJpNXVZVzFsTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdjbVZ3WldGME9pQnlkRzlyWlc0dWNtVndaV0YwWEc0Z0lDQWdJQ0FnSUNBZ2ZTazdYRzRnSUNBZ0lDQWdJR2xtS0NGallXNVNaWEJsWVhRb2NuUnZhMlZ1S1NrZ2UxeHVJQ0FnSUNBZ0lDQWdJSEp3S3lzN1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNBZ0lHbG1LQ0ZqWVc1R1lXbHNLSEowYjJ0bGJpd2dZM1Z5Y21WdWRFNXZaR1VwS1NCN1hHNGdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlHWmhiSE5sTzF4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lISndLeXM3WEc0Z0lDQWdJQ0I5WEc1Y2JpQWdJQ0F2THlCRFlYTmxJSFIzYnpvZ2QyVWdhR0YyWlNCaElIQnliM0JsY2lCMGIydGxibHh1SUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNCcFppaHpkRzlyWlc0dWRIbHdaU0E5UFQwZ2NuUnZhMlZ1TG5SNWNHVXBJSHRjYmlBZ0lDQWdJQ0FnTHk5amRYSnlaVzUwVG05a1pTNWphR2xzWkhKbGJpNXdkWE5vS0dOdmNIbFViMnRsYmloemRHOXJaVzRzSUhKMGIydGxiaWtwTzF4dUlDQWdJQ0FnSUNCcFppZ2hjblJ2YTJWdUxtNXZia05oY0hSMWNtbHVaeWtnZTF4dUlDQWdJQ0FnSUNBZ0lHTjFjbkpsYm5ST2IyUmxMbU5vYVd4a2NtVnVMbkIxYzJnb1kyOXdlVlJ2YTJWdUtITjBiMnRsYml3Z2NuUnZhMlZ1S1NrN1hHNGdJQ0FnSUNBZ0lDQWdjM0FyS3p0Y2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQnBaaWdoWTJGdVVtVndaV0YwS0hKMGIydGxiaWtwSUh0Y2JpQWdJQ0FnSUNBZ0lDQnljQ3NyTzF4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnSUNCcFppZ2hZMkZ1Um1GcGJDaHlkRzlyWlc0c0lHTjFjbkpsYm5ST2IyUmxLU2tnZTF4dUlDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCbVlXeHpaVHRjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNCeWNDc3JPMXh1SUNBZ0lDQWdmVnh1WEc0Z0lDQWdmVnh1WEc0Z0lDQWdMeThnYVc1bWIzSnRZWFJwYjI0Z2RYTmxaQ0JtYjNJZ1pHVmlkV2RuYVc1bklIQjFjbkJ2YzJWY2JpQWdJQ0JwWmloaVpYTjBYM0FnUFQwOUlITndLU0I3WEc0Z0lDQWdJQ0JpWlhOMFgzQmhjbk5sTG1OaGJtUnBaR0YwWlhNdWNIVnphQ2hiY25Wc1pTd2djblZzWlM1MGIydGxibk5iY25CZFhTazdYRzRnSUNBZ2ZWeHVJQ0FnSUdsbUtHSmxjM1JmY0NBOElITndLU0I3WEc0Z0lDQWdJQ0JpWlhOMFgzQmhjbk5sSUQwZ2UzTndPbk53TENCallXNWthV1JoZEdWek9sdGJjblZzWlN3Z2NuVnNaUzUwYjJ0bGJuTmJjbkJkWFYxOU8xeHVJQ0FnSUNBZ1ltVnpkRjl3SUQwZ2MzQTdYRzRnSUNBZ2ZWeHVYRzRnSUNBZ0x5OGdabVYwWTJnZ2JtVjRkQ0J5ZFd4bElHRnVaQ0J6ZEhKbFlXMGdkRzlyWlc1Y2JpQWdJQ0J5ZEc5clpXNGdQU0J5ZFd4bExuUnZhMlZ1YzF0eWNGMDdYRzRnSUNBZ2MzUnZhMlZ1SUQwZ2MzUnlaV0Z0VzNOd1hUdGNibHh1SUNBZ0lDOHZJSEoxYkdVZ2MyRjBhWE5tYVdWa1hHNGdJQ0FnYVdZb2NuUnZhMlZ1SUQwOVBTQjFibVJsWm1sdVpXUXBJSHRjYmlBZ0lDQWdJR04xY25KbGJuUk9iMlJsTG5Od0lEMGdjM0E3WEc0Z0lDQWdJQ0JqZFhKeVpXNTBUbTlrWlM1eWNDQTlJSEp3TzF4dUlDQWdJQ0FnY21WMGRYSnVJR04xY25KbGJuUk9iMlJsTzF4dUlDQWdJSDFjYmx4dUlDQWdJQzh2SUc1dklHMXZjbVVnZEc5clpXNXpYRzRnSUNBZ2FXWW9jM1J2YTJWdUlEMDlQU0IxYm1SbFptbHVaV1FwSUh0Y2JpQWdJQ0FnSUdsbUtHTmhia1poYVd3b2NuUnZhMlZ1TENCamRYSnlaVzUwVG05a1pTa3BJSHRjYmlBZ0lDQWdJQ0FnTHk4Z1ZHaHBjeUJrYjJWeklHNXZkQ0JvWVhCd1pXNGdiMlowWlc0Z1ltVmpZWFZ6WlNCdlppQkZUMFlzWEc0Z0lDQWdJQ0FnSUM4dklFRnpJR2wwSUhOMFlXNWtjeUIwYUdVZ2JHRnpkQ0IwYjJ0bGJpQmhjeUJoYkhkaGVYTWdkRzhnWW1VZ1JVOUdYRzRnSUNBZ0lDQWdJR04xY25KbGJuUk9iMlJsTG5Od0lEMGdjM0E3WEc0Z0lDQWdJQ0FnSUdOMWNuSmxiblJPYjJSbExuSndJRDBnY25BN1hHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCamRYSnlaVzUwVG05a1pUdGNiaUFnSUNBZ0lIMWNiaUFnSUNBZ0lISmxkSFZ5YmlCbVlXeHpaVHRjYmlBZ0lDQjlYRzVjYmlBZ2ZTQXZMeUJsYm1RZ2NuVnNaU0JpYjJSNUlHeHZiM0JjYmx4dUlDQnlaWFIxY200Z1ptRnNjMlU3WEc1OVhHNWNibVoxYm1OMGFXOXVJSE53YkdsMFZISnBiU2hzTENCemNHeHBkQ2tnZTF4dUlDQnlaWFIxY200Z2JDNXpjR3hwZENoemNHeHBkQ2t1YldGd0tHWjFibU4wYVc5dUtHa3BleUJ5WlhSMWNtNGdhUzUwY21sdEtDazdJSDBwTzF4dWZWeHVYRzVtZFc1amRHbHZiaUJuY21GdGJXRnlWRzlyWlc0b2RHOXJaVzRwSUh0Y2JpQWdkbUZ5SUc1dmJrTmhjSFIxY21sdVp5QTlJSFJ2YTJWdUxtTm9ZWEpCZENnd0tTQTlQVDBnSnlFbk8xeHVJQ0JwWmlodWIyNURZWEIwZFhKcGJtY3BJSHRjYmlBZ0lDQjBiMnRsYmlBOUlIUnZhMlZ1TG5OMVluTjBjaWd4S1R0Y2JpQWdmVnh1SUNCMllYSWdjbVZ3WldGMElEMGdkRzlyWlc0dVkyaGhja0YwS0hSdmEyVnVMbXhsYm1kMGFDQXRJREVwTzF4dUlDQnBaaWh5WlhCbFlYUWdQVDA5SUNjcUp5QjhmQ0J5WlhCbFlYUWdQVDA5SUNjL0p5QjhmQ0J5WlhCbFlYUWdQVDA5SUNjckp5a2dlMXh1SUNBZ0lIUnZhMlZ1SUQwZ2RHOXJaVzR1YzNWaWMzUnlLREFzSUhSdmEyVnVMbXhsYm1kMGFDQXRJREVwTzF4dUlDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUhKbGNHVmhkQ0E5SUdaaGJITmxPMXh1SUNCOVhHNGdJSFpoY2lCdVlXMWxaQ0E5SUhSdmEyVnVMbk53YkdsMEtGd2lPbHdpS1N3Z2REdGNiaUFnYVdZb2JtRnRaV1F1YkdWdVozUm9JRDA5UFNBeUtTQjdYRzRnSUNBZ2RDQTlJSHRjYmlBZ0lDQWdJQ2QwZVhCbEp6b2dibUZ0WldSYk1WMHNYRzRnSUNBZ0lDQW5ibUZ0WlNjZ09tNWhiV1ZrV3pCZFhHNGdJQ0FnZlR0Y2JpQWdmU0JsYkhObElIdGNiaUFnSUNCMElEMGdleWQwZVhCbEp6b2dkRzlyWlc0Z2ZUdGNiaUFnZlZ4dUlDQjBMbkpsY0dWaGRDQTlJSEpsY0dWaGREdGNiaUFnYVdZb0tISmxjR1ZoZENBOVBUMGdKeW9uSUh4OElISmxjR1ZoZENBOVBUMGdKeXNuS1NBbUppQnViMjVEWVhCMGRYSnBibWNwSUh0Y2JpQWdJQ0IwYUhKdmR5QnVaWGNnUlhKeWIzSW9YQ0pKYlhCdmMzTnBZbXhsSUhSdklHaGhkbVVnYm05dUlHTmhjSFIxY21sdVp5QjBiMnRsYmlCMGFHRjBJSEpsY0dWaGRITmNJaWs3WEc0Z0lIMWNiaUFnYVdZb2JtOXVRMkZ3ZEhWeWFXNW5LU0I3WEc0Z0lDQWdkQzV1YjI1RFlYQjBkWEpwYm1jZ1BTQnViMjVEWVhCMGRYSnBibWM3WEc0Z0lIMWNiaUFnY21WMGRYSnVJSFE3WEc1OVhHNWNibVoxYm1OMGFXOXVJR052YlhCcGJHVkhjbUZ0YldGeUtHZHlZVzF0WVhJc0lIUnZhMlZ1UkdWbUtTQjdYRzRnSUhaaGNpQnJaWGx6SUQwZ1QySnFaV04wTG10bGVYTW9aM0poYlcxaGNpa3NJR2tzSUdvc0lHczdYRzRnSUhaaGNpQm5jbUZ0SUQwZ2UzMHNJRzl3ZEdsdmJtRnNMQ0J1YjI1RFlYQjBkWEpwYm1jN1hHNWNiaUFnWjNKaGJTNTBiMnRsYmtSbFppQTlJSFJ2YTJWdVJHVm1PMXh1SUNCbmNtRnRMblJ2YTJWdVMyVjVjeUE5SUZ0ZE8xeHVJQ0JuY21GdExuUnZhMlZ1VFdGd0lEMGdlMzA3WEc0Z0lIUnZhMlZ1UkdWbUxtMWhjQ2htZFc1amRHbHZiaWgwS1NCN1hHNGdJQ0FnWjNKaGJTNTBiMnRsYmsxaGNGdDBMbXRsZVYwZ1BTQjBPMXh1SUNBZ0lHZHlZVzB1ZEc5clpXNUxaWGx6TG5CMWMyZ29kQzVyWlhrcE8xeHVJQ0I5S1R0Y2JseHVJQ0IyWVhJZ1lXeHNWbUZzYVdSTFpYbHpJRDBnYTJWNWN5NWpiMjVqWVhRb1ozSmhiUzUwYjJ0bGJrdGxlWE1wTzF4dVhHNGdJR1p2Y2locFBUQTdJR2s4YTJWNWN5NXNaVzVuZEdnN0lHa3JLeWtnZTF4dUlDQWdJSFpoY2lCc2FXNWxJRDBnWjNKaGJXMWhjbHRyWlhselcybGRYVHRjYmlBZ0lDQjJZWElnYTJWNUlEMGdhMlY1YzF0cFhUdGNiaUFnSUNCMllYSWdjblZzWlhNZ1BTQnNhVzVsTG5KMWJHVnpPMXh1SUNBZ0lIWmhjaUJvYjI5cmN5QTlJRnRkTzF4dVhHNGdJQ0FnZG1GeUlITndiR2wwZEdWa1gzSjFiR1Z6SUQwZ1cxMDdYRzVjYmlBZ0lDQm1iM0lvYWowd095QnFQSEoxYkdWekxteGxibWQwYURzZ2Fpc3JLU0I3WEc0Z0lDQWdJQ0IyWVhJZ2RHOXJaVzV6SUQwZ2MzQnNhWFJVY21sdEtISjFiR1Z6VzJwZExDQW5JQ2NwTzF4dUlDQWdJQ0FnYjNCMGFXOXVZV3dnUFNBd08xeHVJQ0FnSUNBZ1ptOXlLR3M5TURzZ2F6eDBiMnRsYm5NdWJHVnVaM1JvT3lCckt5c3BJSHRjYmlBZ0lDQWdJQ0FnZG1GeUlIUnZhMlZ1SUQwZ2RHOXJaVzV6VzJ0ZElEMGdaM0poYlcxaGNsUnZhMlZ1S0hSdmEyVnVjMXRyWFNrN1hHNGdJQ0FnSUNBZ0lHbG1LR0ZzYkZaaGJHbGtTMlY1Y3k1cGJtUmxlRTltS0hSdmEyVnVMblI1Y0dVcElEMDlQU0F0TVNBbUppQjBiMnRsYmk1MGVYQmxJQ0U5UFNBblJVOUdKeWtnZTF4dUlDQWdJQ0FnSUNBZ0lIUm9jbTkzSUc1bGR5QkZjbkp2Y2loY0lrbHVkbUZzYVdRZ2RHOXJaVzRnZEhsd1pTQjFjMlZrSUdsdUlIUm9aU0JuY21GdGJXRnlJSEoxYkdVZ1hDSXJhMlY1SzF3aU9pQmNJaUFySUhSdmEyVnVMblI1Y0dVZ0t5QW5MQ0IyWVd4cFpDQjBiMnRsYm5NZ1lYSmxPaUFuSzJGc2JGWmhiR2xrUzJWNWN5NXFiMmx1S0Njc0lDY3BLVHRjYmlBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNCcFppaDBiMnRsYmk1eVpYQmxZWFFnUFQwOUlDY3FKeWtnZTF4dUlDQWdJQ0FnSUNBZ0lHOXdkR2x2Ym1Gc0lDczlJREU3WEc0Z0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ2FXWW9kRzlyWlc0dWJtOXVRMkZ3ZEhWeWFXNW5LU0I3WEc0Z0lDQWdJQ0FnSUNBZ2FXWW9kRzlyWlc1elczUnZhMlZ1Y3k1c1pXNW5kR2dnTFNBeFhTQWhQU0IwYjJ0bGJuTmJhMTBwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJSFJvY205M0lHNWxkeUJGY25KdmNpaGNJa0VnYm05dUlHTmhjSFIxY21sdVp5QjBiMnRsYmlCallXNGdiMjVzZVNCaVpTQjBhR1VnYkdGemRDQnZibVVnYVc0Z2RHaGxJSEoxYkdVNklGd2lJQ3NnZEc5clpXNHVkSGx3WlNrN1hHNGdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdJQ0JwWmlodmNIUnBiMjVoYkNBOVBUMGdkRzlyWlc1ekxteGxibWQwYUNrZ2UxeHVJQ0FnSUNBZ0lDQjBhSEp2ZHlCdVpYY2dSWEp5YjNJb1hDSlNkV3hsSUZ3aUlDc2djblZzWlhOYmFsMGdLeUJjSWlCdmJteDVJR2hoY3lCdmNIUnBiMjVoYkNCbmNtVmxaSGtnZEc5clpXNXpMbHdpS1R0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0FnSUhOd2JHbDBkR1ZrWDNKMWJHVnpMbkIxYzJnb2UydGxlVG9nYTJWNUxDQnBibVJsZURwcUxDQjBiMnRsYm5NNmRHOXJaVzV6ZlNrN1hHNGdJQ0FnSUNCcFppaDBlWEJsYjJZZ2JHbHVaUzVvYjI5cmN5QTlQVDBnWENKbWRXNWpkR2x2Ymx3aUtTQjdYRzRnSUNBZ0lDQWdJR2h2YjJ0ekxuQjFjMmdvYkdsdVpTNW9iMjlyY3lrN1hHNGdJQ0FnSUNCOUlHVnNjMlVnYVdZb2JHbHVaUzVvYjI5cmN5a2dlMXh1SUNBZ0lDQWdJQ0JwWmloc2FXNWxMbWh2YjJ0elcycGRJRDA5UFNCMWJtUmxabWx1WldRcElIdGNiaUFnSUNBZ0lDQWdJQ0IwYUhKdmR5QnVaWGNnUlhKeWIzSW9YQ0pKYm1OdmNuSmxZM1FnYm5WdFltVnlJRzltSUdodmIydHpJR0Z5SUhKMWJHVWdYQ0lnS3lCclpYbHpXMmxkS1RzZ1hHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdhRzl2YTNNdWNIVnphQ2hzYVc1bExtaHZiMnR6VzJwZEtUdGNiaUFnSUNBZ0lIMWNiaUFnSUNCOVhHNGdJQ0FnWjNKaGJWdHJaWGxkSUQwZ2UzSjFiR1Z6T2lCemNHeHBkSFJsWkY5eWRXeGxjeXdnYUc5dmEzTTZJR2h2YjJ0eklIeDhJRnRkTENCMlpYSmliM05sT214cGJtVXVkbVZ5WW05elpYMDdYRzRnSUgxY2JpQWdaM0poYlM1d1lYSnpaU0E5SUdaMWJtTjBhVzl1S0hOMGNtVmhiU2tnZTF4dUlDQWdJSEpsZEhWeWJpQndZWEp6WlNoemRISmxZVzBzSUdkeVlXMHBPMXh1SUNCOU8xeHVJQ0J5WlhSMWNtNGdaM0poYlR0Y2JuMWNibHh1Wm5WdVkzUnBiMjRnYzNCaFkyVnlLRzRwSUh0Y2JpQWdkbUZ5SUc5MWRDQTlJRndpWENJN1hHNGdJR1p2Y2loMllYSWdhVDB3T3lCcFBHNDdJR2tyS3lrZ2UxeHVJQ0FnSUc5MWRDQXJQU0JjSWlCY0lqdGNiaUFnZlZ4dUlDQnlaWFIxY200Z2IzVjBPMXh1ZlZ4dVhHNW1kVzVqZEdsdmJpQmxjbkp2Y2sxelp5aHBibkIxZEN3Z2RHOXJaVzRzSUdWeWNtOXlWSGx3WlN3Z2JTa2dlMXh1WEc0Z0lIWmhjaUJqYUdGeWJpQTlJSFJ2YTJWdUxuQnZhVzUwWlhJZ2ZId2dNRHRjYmlBZ2RtRnlJR3hwYm1WeklEMGdhVzV3ZFhRdWMzQnNhWFFvWENKY1hHNWNJaWtzSUdrc0lHTm9ZWEpEYjNWdWRHVnlJRDBnTUN3Z1kyaGhjazl1VEdsdVpTQTlJREE3WEc1Y2JpQWdabTl5S0drOU1Ec2dhVHhzYVc1bGN5NXNaVzVuZEdnN0lHa3JLeWtnZTF4dUlDQWdJR05vWVhKRGIzVnVkR1Z5SUNzOUlHeHBibVZ6VzJsZExteGxibWQwYUNBcklERTdYRzRnSUNBZ2FXWW9ZMmhoY2tOdmRXNTBaWElnUGowZ1kyaGhjbTRwSUh0Y2JpQWdJQ0FnSUdKeVpXRnJPMXh1SUNBZ0lIMWNiaUFnSUNCamFHRnlUMjVNYVc1bElDczlJR3hwYm1WelcybGRMbXhsYm1kMGFDQXJJREU3WEc0Z0lIMWNibHh1SUNCMllYSWdiRzRnUFNCTllYUm9MbTFoZUNnd0xDQnBLVHNnTHk4Z2JHbHVaU0J1ZFcxaVpYSmNiaUFnZG1GeUlHMXpaeUE5SUdWeWNtOXlWSGx3WlNBcklGd2lJR0YwSUd4cGJtVWdYQ0lyS0d4dUt6RXBLMXdpSUdOb1lYSWdYQ0lySUNoamFHRnliaUF0SUdOb1lYSlBia3hwYm1VcElDdGNJam9nWENJN1hHNGdJSFpoY2lCcGJtUnBZMkYwYjNJZ1BTQmNJbHhjYmx3aUlDc2djM0JoWTJWeUtDaGphR0Z5YmlBdElHTm9ZWEpQYmt4cGJtVXBJQ3NnS0Noc2Jpa2dLeUFuT2lBbktTNXNaVzVuZEdncE8xeHVYRzRnSUdsbUtHeHBibVZ6VzJ4dUxURmRJQ0U5UFNCMWJtUmxabWx1WldRcElIdGNiaUFnSUNCdGMyY2dQU0J0YzJjZ0t5QmNJbHhjYmx3aUlDc2dLR3h1S1NBcklDYzZJQ2NnS3lCc2FXNWxjMXRzYmkweFhUdGNiaUFnZlZ4dUlDQnRjMmNnUFNCdGMyY2dLeUJjSWx4Y2Jsd2lJQ3NnS0d4dUt6RXBJQ3NnSnpvZ0p5QXJJR3hwYm1WelcyeHVYU0FySUdsdVpHbGpZWFJ2Y2p0Y2JpQWdiWE5uSUQwZ2JYTm5JQ3NnWENKZUxTMGdYQ0lnS3lCdE8xeHVYRzRnSUdsbUtHeHBibVZ6VzJ4dUt6RmRJQ0U5UFNCMWJtUmxabWx1WldRcElIdGNiaUFnSUNCdGMyY2dQU0J0YzJjZ0t5QmNJbHhjYmx3aUlDc2dLR3h1S3pJcElDc2dKem9nSnlBcklHeHBibVZ6VzJ4dUt6RmRPMXh1SUNCOVhHNWNiaUFnY21WMGRYSnVJRzF6Wnp0Y2JuMWNibHh1Wm5WdVkzUnBiMjRnZG1WeVltOXpaVTVoYldVb1ozSmhiVzFoY2l3Z2RIbHdaU2tnZTF4dUlDQjJZWElnZEc5clpXNWtaV1lnUFNCbmNtRnRiV0Z5TG5SdmEyVnVUV0Z3VzNSNWNHVmRPMXh1SUNCcFppaDBiMnRsYm1SbFppQW1KaUIwYjJ0bGJtUmxaaTUyWlhKaWIzTmxLU0I3WEc0Z0lDQWdjbVYwZFhKdUlIUnZhMlZ1WkdWbUxuWmxjbUp2YzJVN1hHNGdJSDFjYmlBZ2FXWW9aM0poYlcxaGNsdDBlWEJsWFNBbUppQm5jbUZ0YldGeVczUjVjR1ZkTG5abGNtSnZjMlVwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdaM0poYlcxaGNsdDBlWEJsWFM1MlpYSmliM05sTzF4dUlDQjlYRzRnSUhKbGRIVnliaUIwZVhCbE8xeHVmVnh1WEc1bWRXNWpkR2x2YmlCb2FXNTBLR2x1Y0hWMExDQnpkSEpsWVcwc0lHSmxjM1JmY0dGeWMyVXNJR2R5WVcxdFlYSXBJSHRjYmlBZ2FXWW9JV0psYzNSZmNHRnljMlVnZkh3Z0lXSmxjM1JmY0dGeWMyVXVZMkZ1Wkdsa1lYUmxjMXN3WFNrZ2UxeHVJQ0FnSUhKbGRIVnliaUJjSWtOdmJYQnNaWFJsSUdaaGFXeDFjbVVnZEc4Z2NHRnljMlZjSWp0Y2JpQWdmVnh1SUNCMllYSWdjblZzWlNBOUlHSmxjM1JmY0dGeWMyVXVZMkZ1Wkdsa1lYUmxjMXN3WFZzd1hUdGNibHh1SUNCMllYSWdZWEp5WVhrZ1BTQmJYVHRjYmlBZ1ltVnpkRjl3WVhKelpTNWpZVzVrYVdSaGRHVnpMbTFoY0NobWRXNWpkR2x2YmloeUtTQjdYRzRnSUNBZ2FXWW9JWEpiTVYwcElIc2djbVYwZFhKdU95QjlYRzRnSUNBZ2RtRnlJRzVoYldVZ1BTQjJaWEppYjNObFRtRnRaU2huY21GdGJXRnlMQ0J5V3pGZExuUjVjR1VwTzF4dUlDQWdJR2xtS0dGeWNtRjVMbWx1WkdWNFQyWW9ibUZ0WlNrZ1BUMDlJQzB4S1NCN1hHNGdJQ0FnSUNCaGNuSmhlUzV3ZFhOb0tHNWhiV1VwTzF4dUlDQWdJSDFjYmlBZ2ZTazdYRzRnSUhaaGNpQmpZVzVrYVdSaGRHVnpJRDBnWVhKeVlYa3VhbTlwYmlnbklHOXlJQ2NwTzF4dVhHNGdJSFpoY2lCdGMyY2dQU0JsY25KdmNrMXpaeWhwYm5CMWRDd2djM1J5WldGdFcySmxjM1JmY0dGeWMyVXVjM0JkTENCY0lsQmhjbk5sY2lCbGNuSnZjbHdpTENCY0lsSjFiR1VnWENJZ0t5QjJaWEppYjNObFRtRnRaU2huY21GdGJXRnlMQ0J5ZFd4bExtdGxlU2twTzF4dUlDQnRjMmNnUFNCdGMyY2dLeUJjSWx4Y2JrVjRjR1ZqZENCY0lpQXJJR05oYm1ScFpHRjBaWE03WEc0Z0lIWmhjaUJzWVhOMFZHOXJaVzRnUFNCemRISmxZVzFiWW1WemRGOXdZWEp6WlM1emNGMGdmSHdnZTNSNWNHVTZYQ0pGVDBaY0luMDdYRzRnSUcxelp5QTlJRzF6WnlBcklGd2lYRnh1UW5WMElHZHZkQ0JjSWlBcklIWmxjbUp2YzJWT1lXMWxLR2R5WVcxdFlYSXNJR3hoYzNSVWIydGxiaTUwZVhCbEtTQXJJRndpSUdsdWMzUmxZV1JjSWp0Y2JseHVJQ0J5WlhSMWNtNGdiWE5uTzF4dWZWeHVYRzR2THlCMGFHOXpaU0JoY21VZ2JXOWtkV3hsSUdkc2IySmhiSE5jYm5aaGNpQnpkR0ZqYXlBOUlGdGRPMXh1ZG1GeUlHMWxiVzlwZW1GMGFXOXVJRDBnZTMwN1hHNTJZWElnWW1WemRGOXdZWEp6WlNBOUlHNTFiR3c3WEc1MllYSWdZbVZ6ZEY5d0lEMGdNRHRjYmx4dVpuVnVZM1JwYjI0Z2FHOXZhMVJ5WldVb2JtOWtaU2tnZTF4dUlDQnBaaWdoYm05a1pTNWphR2xzWkhKbGJpa2dlMXh1SUNBZ0lISmxkSFZ5Ymp0Y2JpQWdmVnh1SUNCbWIzSW9kbUZ5SUdrOU1Ec2dhVHh1YjJSbExtTm9hV3hrY21WdUxteGxibWQwYURzZ2FTc3JLU0I3WEc0Z0lDQWdhRzl2YTFSeVpXVW9ibTlrWlM1amFHbHNaSEpsYmx0cFhTazdYRzRnSUgxY2JpQWdhV1lvYm05a1pTNW9iMjlyS1NCN1hHNGdJQ0FnYm05a1pTNWphR2xzWkhKbGJpQTlJRzV2WkdVdWFHOXZheWhqY21WaGRHVlFZWEpoYlhNb2JtOWtaUzVqYUdsc1pISmxiaWtwTzF4dUlDQjlYRzU5WEc1Y2JtWjFibU4wYVc5dUlIQmhjbk5sS0dsdWNIVjBMQ0JuY21GdGJXRnlLU0I3WEc0Z0lIWmhjaUJpWlhOMFVtVnpkV3gwSUQwZ2UzUjVjR1U2SjFOVVFWSlVKeXdnYzNBNk1Dd2dZMjl0Y0d4bGRHVTZabUZzYzJWOUxDQnBMQ0J5WlhOMWJIUXNJSE4wY21WaGJUdGNiaUFnTHk5cFppaDBlWEJsYjJZZ2FXNXdkWFFnUFQwOUlDZHpkSEpwYm1jbktTQjdYRzRnSUhOMGNtVmhiU0E5SUhSdmEyVnVhWHBsS0dsdWNIVjBMQ0JuY21GdGJXRnlLVHRjYmlBZ0x5OTlYRzRnSUdKbGMzUmZjR0Z5YzJVZ1BTQjdjM0E2TUN3Z1kyRnVaR2xrWVhSbGN6cGJYWDA3WEc0Z0lHSmxjM1JmY0NBOUlEQTdYRzRnSUdadmNpaHBQVEE3SUdrOFozSmhiVzFoY2k1VFZFRlNWQzV5ZFd4bGN5NXNaVzVuZEdnN0lHa3JLeWtnZTF4dUlDQWdJSE4wWVdOcklEMGdXMTA3WEc0Z0lDQWdiV1Z0YjJsNllYUnBiMjRnUFNCN2ZUdGNiaUFnSUNCeVpYTjFiSFFnUFNCdFpXMXZSWFpoYkNobmNtRnRiV0Z5TENCbmNtRnRiV0Z5TGxOVVFWSlVMbkoxYkdWelcybGRMQ0J6ZEhKbFlXMHNJREFwTzF4dUlDQWdJR2xtS0hKbGMzVnNkQ0FtSmlCeVpYTjFiSFF1YzNBZ1BpQmlaWE4wVW1WemRXeDBMbk53S1NCN1hHNGdJQ0FnSUNCaVpYTjBVbVZ6ZFd4MElEMGdlMXh1SUNBZ0lDQWdJQ0IwZVhCbE9pZFRWRUZTVkNjc1hHNGdJQ0FnSUNBZ0lHTm9hV3hrY21WdU9uSmxjM1ZzZEM1amFHbHNaSEpsYml4Y2JpQWdJQ0FnSUNBZ2MzQTZJSEpsYzNWc2RDNXpjQ3hjYmlBZ0lDQWdJQ0FnYkdsdVpUb2dNU3hjYmlBZ0lDQWdJQ0FnWTI5c2RXMXVPaUF4TEZ4dUlDQWdJQ0FnSUNCamIyMXdiR1YwWlRweVpYTjFiSFF1YzNBZ1BUMDlJSE4wY21WaGJTNXNaVzVuZEdnc1hHNGdJQ0FnSUNBZ0lHbHVjSFYwVEdWdVozUm9Pbk4wY21WaGJTNXNaVzVuZEdnc1hHNGdJQ0FnSUNCOU8xeHVJQ0FnSUgxY2JpQWdmVnh1SUNCaVpYTjBVbVZ6ZFd4MExtSmxjM1JRWVhKelpTQTlJR0psYzNSZmNHRnljMlU3WEc0Z0lHaHZiMnRVY21WbEtHSmxjM1JTWlhOMWJIUXBPMXh1SUNCcFppaGlaWE4wWDNCaGNuTmxJQ1ltSUNGaVpYTjBVbVZ6ZFd4MExtTnZiWEJzWlhSbEtTQjdYRzRnSUNBZ1ltVnpkRkpsYzNWc2RDNW9hVzUwSUQwZ2FHbHVkQ2hwYm5CMWRDd2djM1J5WldGdExDQmlaWE4wWDNCaGNuTmxMQ0JuY21GdGJXRnlLVHRjYmlBZ2ZWeHVJQ0J5WlhSMWNtNGdZbVZ6ZEZKbGMzVnNkRHRjYm4xY2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQjdYRzRnSUhCaGNuTmxPaUJ3WVhKelpTeGNiaUFnYzNSaFkyczZJSE4wWVdOckxGeHVJQ0JqYjIxd2FXeGxSM0poYlcxaGNqb2dZMjl0Y0dsc1pVZHlZVzF0WVhJc1hHNGdJSFJ2YTJWdWFYcGxPaUIwYjJ0bGJtbDZaU3hjYmlBZ2JXVnRiMmw2WVhScGIyNDZJRzFsYlc5cGVtRjBhVzl1WEc1OU8xeHVJbDE5IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgT25lVmVyc2lvbkNvbnN0cmFpbnQgPSByZXF1aXJlKCdpbmRpdmlkdWFsL29uZS12ZXJzaW9uJyk7XG5cbnZhciBNWV9WRVJTSU9OID0gJzcnO1xuT25lVmVyc2lvbkNvbnN0cmFpbnQoJ2V2LXN0b3JlJywgTVlfVkVSU0lPTik7XG5cbnZhciBoYXNoS2V5ID0gJ19fRVZfU1RPUkVfS0VZQCcgKyBNWV9WRVJTSU9OO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEV2U3RvcmU7XG5cbmZ1bmN0aW9uIEV2U3RvcmUoZWxlbSkge1xuICAgIHZhciBoYXNoID0gZWxlbVtoYXNoS2V5XTtcblxuICAgIGlmICghaGFzaCkge1xuICAgICAgICBoYXNoID0gZWxlbVtoYXNoS2V5XSA9IHt9O1xuICAgIH1cblxuICAgIHJldHVybiBoYXNoO1xufVxuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xudmFyIHRvcExldmVsID0gdHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgPyBnbG9iYWwgOlxuICAgIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDoge31cbnZhciBtaW5Eb2MgPSByZXF1aXJlKCdtaW4tZG9jdW1lbnQnKTtcblxudmFyIGRvY2N5O1xuXG5pZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgIGRvY2N5ID0gZG9jdW1lbnQ7XG59IGVsc2Uge1xuICAgIGRvY2N5ID0gdG9wTGV2ZWxbJ19fR0xPQkFMX0RPQ1VNRU5UX0NBQ0hFQDQnXTtcblxuICAgIGlmICghZG9jY3kpIHtcbiAgICAgICAgZG9jY3kgPSB0b3BMZXZlbFsnX19HTE9CQUxfRE9DVU1FTlRfQ0FDSEVANCddID0gbWluRG9jO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBkb2NjeTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbTV2WkdWZmJXOWtkV3hsY3k5bmJHOWlZV3d2Wkc5amRXMWxiblF1YW5NaVhTd2libUZ0WlhNaU9sdGRMQ0p0WVhCd2FXNW5jeUk2SWp0QlFVRkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVNJc0ltWnBiR1VpT2lKblpXNWxjbUYwWldRdWFuTWlMQ0p6YjNWeVkyVlNiMjkwSWpvaUlpd2ljMjkxY21ObGMwTnZiblJsYm5RaU9sc2lkbUZ5SUhSdmNFeGxkbVZzSUQwZ2RIbHdaVzltSUdkc2IySmhiQ0FoUFQwZ0ozVnVaR1ZtYVc1bFpDY2dQeUJuYkc5aVlXd2dPbHh1SUNBZ0lIUjVjR1Z2WmlCM2FXNWtiM2NnSVQwOUlDZDFibVJsWm1sdVpXUW5JRDhnZDJsdVpHOTNJRG9nZTMxY2JuWmhjaUJ0YVc1RWIyTWdQU0J5WlhGMWFYSmxLQ2R0YVc0dFpHOWpkVzFsYm5RbktUdGNibHh1ZG1GeUlHUnZZMk41TzF4dVhHNXBaaUFvZEhsd1pXOW1JR1J2WTNWdFpXNTBJQ0U5UFNBbmRXNWtaV1pwYm1Wa0p5a2dlMXh1SUNBZ0lHUnZZMk41SUQwZ1pHOWpkVzFsYm5RN1hHNTlJR1ZzYzJVZ2UxeHVJQ0FnSUdSdlkyTjVJRDBnZEc5d1RHVjJaV3hiSjE5ZlIweFBRa0ZNWDBSUFExVk5SVTVVWDBOQlEwaEZRRFFuWFR0Y2JseHVJQ0FnSUdsbUlDZ2haRzlqWTNrcElIdGNiaUFnSUNBZ0lDQWdaRzlqWTNrZ1BTQjBiM0JNWlhabGJGc25YMTlIVEU5Q1FVeGZSRTlEVlUxRlRsUmZRMEZEU0VWQU5DZGRJRDBnYldsdVJHOWpPMXh1SUNBZ0lIMWNibjFjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCa2IyTmplVHRjYmlKZGZRPT0iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbi8qZ2xvYmFsIHdpbmRvdywgZ2xvYmFsKi9cblxudmFyIHJvb3QgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/XG4gICAgd2luZG93IDogdHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgP1xuICAgIGdsb2JhbCA6IHt9O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEluZGl2aWR1YWw7XG5cbmZ1bmN0aW9uIEluZGl2aWR1YWwoa2V5LCB2YWx1ZSkge1xuICAgIGlmIChrZXkgaW4gcm9vdCkge1xuICAgICAgICByZXR1cm4gcm9vdFtrZXldO1xuICAgIH1cblxuICAgIHJvb3Rba2V5XSA9IHZhbHVlO1xuXG4gICAgcmV0dXJuIHZhbHVlO1xufVxuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkltNXZaR1ZmYlc5a2RXeGxjeTlwYm1ScGRtbGtkV0ZzTDJsdVpHVjRMbXB6SWwwc0ltNWhiV1Z6SWpwYlhTd2liV0Z3Y0dsdVozTWlPaUk3UVVGQlFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CSWl3aVptbHNaU0k2SW1kbGJtVnlZWFJsWkM1cWN5SXNJbk52ZFhKalpWSnZiM1FpT2lJaUxDSnpiM1Z5WTJWelEyOXVkR1Z1ZENJNld5SW5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JpOHFaMnh2WW1Gc0lIZHBibVJ2ZHl3Z1oyeHZZbUZzS2k5Y2JseHVkbUZ5SUhKdmIzUWdQU0IwZVhCbGIyWWdkMmx1Wkc5M0lDRTlQU0FuZFc1a1pXWnBibVZrSnlBL1hHNGdJQ0FnZDJsdVpHOTNJRG9nZEhsd1pXOW1JR2RzYjJKaGJDQWhQVDBnSjNWdVpHVm1hVzVsWkNjZ1AxeHVJQ0FnSUdkc2IySmhiQ0E2SUh0OU8xeHVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJRWx1WkdsMmFXUjFZV3c3WEc1Y2JtWjFibU4wYVc5dUlFbHVaR2wyYVdSMVlXd29hMlY1TENCMllXeDFaU2tnZTF4dUlDQWdJR2xtSUNoclpYa2dhVzRnY205dmRDa2dlMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdjbTl2ZEZ0clpYbGRPMXh1SUNBZ0lIMWNibHh1SUNBZ0lISnZiM1JiYTJWNVhTQTlJSFpoYkhWbE8xeHVYRzRnSUNBZ2NtVjBkWEp1SUhaaGJIVmxPMXh1ZlZ4dUlsMTkiLCIndXNlIHN0cmljdCc7XG5cbnZhciBJbmRpdmlkdWFsID0gcmVxdWlyZSgnLi9pbmRleC5qcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE9uZVZlcnNpb247XG5cbmZ1bmN0aW9uIE9uZVZlcnNpb24obW9kdWxlTmFtZSwgdmVyc2lvbiwgZGVmYXVsdFZhbHVlKSB7XG4gICAgdmFyIGtleSA9ICdfX0lORElWSURVQUxfT05FX1ZFUlNJT05fJyArIG1vZHVsZU5hbWU7XG4gICAgdmFyIGVuZm9yY2VLZXkgPSBrZXkgKyAnX0VORk9SQ0VfU0lOR0xFVE9OJztcblxuICAgIHZhciB2ZXJzaW9uVmFsdWUgPSBJbmRpdmlkdWFsKGVuZm9yY2VLZXksIHZlcnNpb24pO1xuXG4gICAgaWYgKHZlcnNpb25WYWx1ZSAhPT0gdmVyc2lvbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGhhdmUgb25lIGNvcHkgb2YgJyArXG4gICAgICAgICAgICBtb2R1bGVOYW1lICsgJy5cXG4nICtcbiAgICAgICAgICAgICdZb3UgYWxyZWFkeSBoYXZlIHZlcnNpb24gJyArIHZlcnNpb25WYWx1ZSArXG4gICAgICAgICAgICAnIGluc3RhbGxlZC5cXG4nICtcbiAgICAgICAgICAgICdUaGlzIG1lYW5zIHlvdSBjYW5ub3QgaW5zdGFsbCB2ZXJzaW9uICcgKyB2ZXJzaW9uKTtcbiAgICB9XG5cbiAgICByZXR1cm4gSW5kaXZpZHVhbChrZXksIGRlZmF1bHRWYWx1ZSk7XG59XG4iLCJcInVzZSBzdHJpY3RcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpc09iamVjdCh4KSB7XG5cdHJldHVybiB0eXBlb2YgeCA9PT0gXCJvYmplY3RcIiAmJiB4ICE9PSBudWxsO1xufTtcbiIsInZhciBjcmVhdGVFbGVtZW50ID0gcmVxdWlyZShcIi4vdmRvbS9jcmVhdGUtZWxlbWVudC5qc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUVsZW1lbnRcbiIsInZhciBkaWZmID0gcmVxdWlyZShcIi4vdnRyZWUvZGlmZi5qc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGRpZmZcbiIsInZhciBoID0gcmVxdWlyZShcIi4vdmlydHVhbC1oeXBlcnNjcmlwdC9pbmRleC5qc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhcbiIsInZhciBkaWZmID0gcmVxdWlyZShcIi4vZGlmZi5qc1wiKVxyXG52YXIgcGF0Y2ggPSByZXF1aXJlKFwiLi9wYXRjaC5qc1wiKVxyXG52YXIgaCA9IHJlcXVpcmUoXCIuL2guanNcIilcclxudmFyIGNyZWF0ZSA9IHJlcXVpcmUoXCIuL2NyZWF0ZS1lbGVtZW50LmpzXCIpXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGRpZmY6IGRpZmYsXHJcbiAgICBwYXRjaDogcGF0Y2gsXHJcbiAgICBoOiBoLFxyXG4gICAgY3JlYXRlOiBjcmVhdGVcclxufVxyXG4iLCJ2YXIgcGF0Y2ggPSByZXF1aXJlKFwiLi92ZG9tL3BhdGNoLmpzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gcGF0Y2hcbiIsInZhciBpc09iamVjdCA9IHJlcXVpcmUoXCJpcy1vYmplY3RcIilcbnZhciBpc0hvb2sgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtdmhvb2suanNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBhcHBseVByb3BlcnRpZXNcblxuZnVuY3Rpb24gYXBwbHlQcm9wZXJ0aWVzKG5vZGUsIHByb3BzLCBwcmV2aW91cykge1xuICAgIGZvciAodmFyIHByb3BOYW1lIGluIHByb3BzKSB7XG4gICAgICAgIHZhciBwcm9wVmFsdWUgPSBwcm9wc1twcm9wTmFtZV1cblxuICAgICAgICBpZiAocHJvcFZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJlbW92ZVByb3BlcnR5KG5vZGUsIHByb3BOYW1lLCBwcm9wVmFsdWUsIHByZXZpb3VzKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc0hvb2socHJvcFZhbHVlKSkge1xuICAgICAgICAgICAgcmVtb3ZlUHJvcGVydHkobm9kZSwgcHJvcE5hbWUsIHByb3BWYWx1ZSwgcHJldmlvdXMpXG4gICAgICAgICAgICBpZiAocHJvcFZhbHVlLmhvb2spIHtcbiAgICAgICAgICAgICAgICBwcm9wVmFsdWUuaG9vayhub2RlLFxuICAgICAgICAgICAgICAgICAgICBwcm9wTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMgPyBwcmV2aW91c1twcm9wTmFtZV0gOiB1bmRlZmluZWQpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoaXNPYmplY3QocHJvcFZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHBhdGNoT2JqZWN0KG5vZGUsIHByb3BzLCBwcmV2aW91cywgcHJvcE5hbWUsIHByb3BWYWx1ZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5vZGVbcHJvcE5hbWVdID0gcHJvcFZhbHVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZVByb3BlcnR5KG5vZGUsIHByb3BOYW1lLCBwcm9wVmFsdWUsIHByZXZpb3VzKSB7XG4gICAgaWYgKHByZXZpb3VzKSB7XG4gICAgICAgIHZhciBwcmV2aW91c1ZhbHVlID0gcHJldmlvdXNbcHJvcE5hbWVdXG5cbiAgICAgICAgaWYgKCFpc0hvb2socHJldmlvdXNWYWx1ZSkpIHtcbiAgICAgICAgICAgIGlmIChwcm9wTmFtZSA9PT0gXCJhdHRyaWJ1dGVzXCIpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBhdHRyTmFtZSBpbiBwcmV2aW91c1ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGUucmVtb3ZlQXR0cmlidXRlKGF0dHJOYW1lKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAocHJvcE5hbWUgPT09IFwic3R5bGVcIikge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgaW4gcHJldmlvdXNWYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBub2RlLnN0eWxlW2ldID0gXCJcIlxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHByZXZpb3VzVmFsdWUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgICAgICBub2RlW3Byb3BOYW1lXSA9IFwiXCJcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbm9kZVtwcm9wTmFtZV0gPSBudWxsXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAocHJldmlvdXNWYWx1ZS51bmhvb2spIHtcbiAgICAgICAgICAgIHByZXZpb3VzVmFsdWUudW5ob29rKG5vZGUsIHByb3BOYW1lLCBwcm9wVmFsdWUpXG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHBhdGNoT2JqZWN0KG5vZGUsIHByb3BzLCBwcmV2aW91cywgcHJvcE5hbWUsIHByb3BWYWx1ZSkge1xuICAgIHZhciBwcmV2aW91c1ZhbHVlID0gcHJldmlvdXMgPyBwcmV2aW91c1twcm9wTmFtZV0gOiB1bmRlZmluZWRcblxuICAgIC8vIFNldCBhdHRyaWJ1dGVzXG4gICAgaWYgKHByb3BOYW1lID09PSBcImF0dHJpYnV0ZXNcIikge1xuICAgICAgICBmb3IgKHZhciBhdHRyTmFtZSBpbiBwcm9wVmFsdWUpIHtcbiAgICAgICAgICAgIHZhciBhdHRyVmFsdWUgPSBwcm9wVmFsdWVbYXR0ck5hbWVdXG5cbiAgICAgICAgICAgIGlmIChhdHRyVmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIG5vZGUucmVtb3ZlQXR0cmlidXRlKGF0dHJOYW1lKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBub2RlLnNldEF0dHJpYnV0ZShhdHRyTmFtZSwgYXR0clZhbHVlKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYocHJldmlvdXNWYWx1ZSAmJiBpc09iamVjdChwcmV2aW91c1ZhbHVlKSAmJlxuICAgICAgICBnZXRQcm90b3R5cGUocHJldmlvdXNWYWx1ZSkgIT09IGdldFByb3RvdHlwZShwcm9wVmFsdWUpKSB7XG4gICAgICAgIG5vZGVbcHJvcE5hbWVdID0gcHJvcFZhbHVlXG4gICAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmICghaXNPYmplY3Qobm9kZVtwcm9wTmFtZV0pKSB7XG4gICAgICAgIG5vZGVbcHJvcE5hbWVdID0ge31cbiAgICB9XG5cbiAgICB2YXIgcmVwbGFjZXIgPSBwcm9wTmFtZSA9PT0gXCJzdHlsZVwiID8gXCJcIiA6IHVuZGVmaW5lZFxuXG4gICAgZm9yICh2YXIgayBpbiBwcm9wVmFsdWUpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gcHJvcFZhbHVlW2tdXG4gICAgICAgIG5vZGVbcHJvcE5hbWVdW2tdID0gKHZhbHVlID09PSB1bmRlZmluZWQpID8gcmVwbGFjZXIgOiB2YWx1ZVxuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0UHJvdG90eXBlKHZhbHVlKSB7XG4gICAgaWYgKE9iamVjdC5nZXRQcm90b3R5cGVPZikge1xuICAgICAgICByZXR1cm4gT2JqZWN0LmdldFByb3RvdHlwZU9mKHZhbHVlKVxuICAgIH0gZWxzZSBpZiAodmFsdWUuX19wcm90b19fKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZS5fX3Byb3RvX19cbiAgICB9IGVsc2UgaWYgKHZhbHVlLmNvbnN0cnVjdG9yKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZS5jb25zdHJ1Y3Rvci5wcm90b3R5cGVcbiAgICB9XG59XG4iLCJ2YXIgZG9jdW1lbnQgPSByZXF1aXJlKFwiZ2xvYmFsL2RvY3VtZW50XCIpXG5cbnZhciBhcHBseVByb3BlcnRpZXMgPSByZXF1aXJlKFwiLi9hcHBseS1wcm9wZXJ0aWVzXCIpXG5cbnZhciBpc1ZOb2RlID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXZub2RlLmpzXCIpXG52YXIgaXNWVGV4dCA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy12dGV4dC5qc1wiKVxudmFyIGlzV2lkZ2V0ID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXdpZGdldC5qc1wiKVxudmFyIGhhbmRsZVRodW5rID0gcmVxdWlyZShcIi4uL3Zub2RlL2hhbmRsZS10aHVuay5qc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUVsZW1lbnRcblxuZnVuY3Rpb24gY3JlYXRlRWxlbWVudCh2bm9kZSwgb3B0cykge1xuICAgIHZhciBkb2MgPSBvcHRzID8gb3B0cy5kb2N1bWVudCB8fCBkb2N1bWVudCA6IGRvY3VtZW50XG4gICAgdmFyIHdhcm4gPSBvcHRzID8gb3B0cy53YXJuIDogbnVsbFxuXG4gICAgdm5vZGUgPSBoYW5kbGVUaHVuayh2bm9kZSkuYVxuXG4gICAgaWYgKGlzV2lkZ2V0KHZub2RlKSkge1xuICAgICAgICByZXR1cm4gdm5vZGUuaW5pdCgpXG4gICAgfSBlbHNlIGlmIChpc1ZUZXh0KHZub2RlKSkge1xuICAgICAgICByZXR1cm4gZG9jLmNyZWF0ZVRleHROb2RlKHZub2RlLnRleHQpXG4gICAgfSBlbHNlIGlmICghaXNWTm9kZSh2bm9kZSkpIHtcbiAgICAgICAgaWYgKHdhcm4pIHtcbiAgICAgICAgICAgIHdhcm4oXCJJdGVtIGlzIG5vdCBhIHZhbGlkIHZpcnR1YWwgZG9tIG5vZGVcIiwgdm5vZGUpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG5cbiAgICB2YXIgbm9kZSA9ICh2bm9kZS5uYW1lc3BhY2UgPT09IG51bGwpID9cbiAgICAgICAgZG9jLmNyZWF0ZUVsZW1lbnQodm5vZGUudGFnTmFtZSkgOlxuICAgICAgICBkb2MuY3JlYXRlRWxlbWVudE5TKHZub2RlLm5hbWVzcGFjZSwgdm5vZGUudGFnTmFtZSlcblxuICAgIHZhciBwcm9wcyA9IHZub2RlLnByb3BlcnRpZXNcbiAgICBhcHBseVByb3BlcnRpZXMobm9kZSwgcHJvcHMpXG5cbiAgICB2YXIgY2hpbGRyZW4gPSB2bm9kZS5jaGlsZHJlblxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY2hpbGROb2RlID0gY3JlYXRlRWxlbWVudChjaGlsZHJlbltpXSwgb3B0cylcbiAgICAgICAgaWYgKGNoaWxkTm9kZSkge1xuICAgICAgICAgICAgbm9kZS5hcHBlbmRDaGlsZChjaGlsZE5vZGUpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbm9kZVxufVxuIiwiLy8gTWFwcyBhIHZpcnR1YWwgRE9NIHRyZWUgb250byBhIHJlYWwgRE9NIHRyZWUgaW4gYW4gZWZmaWNpZW50IG1hbm5lci5cbi8vIFdlIGRvbid0IHdhbnQgdG8gcmVhZCBhbGwgb2YgdGhlIERPTSBub2RlcyBpbiB0aGUgdHJlZSBzbyB3ZSB1c2Vcbi8vIHRoZSBpbi1vcmRlciB0cmVlIGluZGV4aW5nIHRvIGVsaW1pbmF0ZSByZWN1cnNpb24gZG93biBjZXJ0YWluIGJyYW5jaGVzLlxuLy8gV2Ugb25seSByZWN1cnNlIGludG8gYSBET00gbm9kZSBpZiB3ZSBrbm93IHRoYXQgaXQgY29udGFpbnMgYSBjaGlsZCBvZlxuLy8gaW50ZXJlc3QuXG5cbnZhciBub0NoaWxkID0ge31cblxubW9kdWxlLmV4cG9ydHMgPSBkb21JbmRleFxuXG5mdW5jdGlvbiBkb21JbmRleChyb290Tm9kZSwgdHJlZSwgaW5kaWNlcywgbm9kZXMpIHtcbiAgICBpZiAoIWluZGljZXMgfHwgaW5kaWNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHt9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaW5kaWNlcy5zb3J0KGFzY2VuZGluZylcbiAgICAgICAgcmV0dXJuIHJlY3Vyc2Uocm9vdE5vZGUsIHRyZWUsIGluZGljZXMsIG5vZGVzLCAwKVxuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVjdXJzZShyb290Tm9kZSwgdHJlZSwgaW5kaWNlcywgbm9kZXMsIHJvb3RJbmRleCkge1xuICAgIG5vZGVzID0gbm9kZXMgfHwge31cblxuXG4gICAgaWYgKHJvb3ROb2RlKSB7XG4gICAgICAgIGlmIChpbmRleEluUmFuZ2UoaW5kaWNlcywgcm9vdEluZGV4LCByb290SW5kZXgpKSB7XG4gICAgICAgICAgICBub2Rlc1tyb290SW5kZXhdID0gcm9vdE5vZGVcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB2Q2hpbGRyZW4gPSB0cmVlLmNoaWxkcmVuXG5cbiAgICAgICAgaWYgKHZDaGlsZHJlbikge1xuXG4gICAgICAgICAgICB2YXIgY2hpbGROb2RlcyA9IHJvb3ROb2RlLmNoaWxkTm9kZXNcblxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0cmVlLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgcm9vdEluZGV4ICs9IDFcblxuICAgICAgICAgICAgICAgIHZhciB2Q2hpbGQgPSB2Q2hpbGRyZW5baV0gfHwgbm9DaGlsZFxuICAgICAgICAgICAgICAgIHZhciBuZXh0SW5kZXggPSByb290SW5kZXggKyAodkNoaWxkLmNvdW50IHx8IDApXG5cbiAgICAgICAgICAgICAgICAvLyBza2lwIHJlY3Vyc2lvbiBkb3duIHRoZSB0cmVlIGlmIHRoZXJlIGFyZSBubyBub2RlcyBkb3duIGhlcmVcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXhJblJhbmdlKGluZGljZXMsIHJvb3RJbmRleCwgbmV4dEluZGV4KSkge1xuICAgICAgICAgICAgICAgICAgICByZWN1cnNlKGNoaWxkTm9kZXNbaV0sIHZDaGlsZCwgaW5kaWNlcywgbm9kZXMsIHJvb3RJbmRleClcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByb290SW5kZXggPSBuZXh0SW5kZXhcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBub2Rlc1xufVxuXG4vLyBCaW5hcnkgc2VhcmNoIGZvciBhbiBpbmRleCBpbiB0aGUgaW50ZXJ2YWwgW2xlZnQsIHJpZ2h0XVxuZnVuY3Rpb24gaW5kZXhJblJhbmdlKGluZGljZXMsIGxlZnQsIHJpZ2h0KSB7XG4gICAgaWYgKGluZGljZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cblxuICAgIHZhciBtaW5JbmRleCA9IDBcbiAgICB2YXIgbWF4SW5kZXggPSBpbmRpY2VzLmxlbmd0aCAtIDFcbiAgICB2YXIgY3VycmVudEluZGV4XG4gICAgdmFyIGN1cnJlbnRJdGVtXG5cbiAgICB3aGlsZSAobWluSW5kZXggPD0gbWF4SW5kZXgpIHtcbiAgICAgICAgY3VycmVudEluZGV4ID0gKChtYXhJbmRleCArIG1pbkluZGV4KSAvIDIpID4+IDBcbiAgICAgICAgY3VycmVudEl0ZW0gPSBpbmRpY2VzW2N1cnJlbnRJbmRleF1cblxuICAgICAgICBpZiAobWluSW5kZXggPT09IG1heEluZGV4KSB7XG4gICAgICAgICAgICByZXR1cm4gY3VycmVudEl0ZW0gPj0gbGVmdCAmJiBjdXJyZW50SXRlbSA8PSByaWdodFxuICAgICAgICB9IGVsc2UgaWYgKGN1cnJlbnRJdGVtIDwgbGVmdCkge1xuICAgICAgICAgICAgbWluSW5kZXggPSBjdXJyZW50SW5kZXggKyAxXG4gICAgICAgIH0gZWxzZSAgaWYgKGN1cnJlbnRJdGVtID4gcmlnaHQpIHtcbiAgICAgICAgICAgIG1heEluZGV4ID0gY3VycmVudEluZGV4IC0gMVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gYXNjZW5kaW5nKGEsIGIpIHtcbiAgICByZXR1cm4gYSA+IGIgPyAxIDogLTFcbn1cbiIsInZhciBhcHBseVByb3BlcnRpZXMgPSByZXF1aXJlKFwiLi9hcHBseS1wcm9wZXJ0aWVzXCIpXG5cbnZhciBpc1dpZGdldCA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy13aWRnZXQuanNcIilcbnZhciBWUGF0Y2ggPSByZXF1aXJlKFwiLi4vdm5vZGUvdnBhdGNoLmpzXCIpXG5cbnZhciByZW5kZXIgPSByZXF1aXJlKFwiLi9jcmVhdGUtZWxlbWVudFwiKVxudmFyIHVwZGF0ZVdpZGdldCA9IHJlcXVpcmUoXCIuL3VwZGF0ZS13aWRnZXRcIilcblxubW9kdWxlLmV4cG9ydHMgPSBhcHBseVBhdGNoXG5cbmZ1bmN0aW9uIGFwcGx5UGF0Y2godnBhdGNoLCBkb21Ob2RlLCByZW5kZXJPcHRpb25zKSB7XG4gICAgdmFyIHR5cGUgPSB2cGF0Y2gudHlwZVxuICAgIHZhciB2Tm9kZSA9IHZwYXRjaC52Tm9kZVxuICAgIHZhciBwYXRjaCA9IHZwYXRjaC5wYXRjaFxuXG4gICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIGNhc2UgVlBhdGNoLlJFTU9WRTpcbiAgICAgICAgICAgIHJldHVybiByZW1vdmVOb2RlKGRvbU5vZGUsIHZOb2RlKVxuICAgICAgICBjYXNlIFZQYXRjaC5JTlNFUlQ6XG4gICAgICAgICAgICByZXR1cm4gaW5zZXJ0Tm9kZShkb21Ob2RlLCBwYXRjaCwgcmVuZGVyT3B0aW9ucylcbiAgICAgICAgY2FzZSBWUGF0Y2guVlRFWFQ6XG4gICAgICAgICAgICByZXR1cm4gc3RyaW5nUGF0Y2goZG9tTm9kZSwgdk5vZGUsIHBhdGNoLCByZW5kZXJPcHRpb25zKVxuICAgICAgICBjYXNlIFZQYXRjaC5XSURHRVQ6XG4gICAgICAgICAgICByZXR1cm4gd2lkZ2V0UGF0Y2goZG9tTm9kZSwgdk5vZGUsIHBhdGNoLCByZW5kZXJPcHRpb25zKVxuICAgICAgICBjYXNlIFZQYXRjaC5WTk9ERTpcbiAgICAgICAgICAgIHJldHVybiB2Tm9kZVBhdGNoKGRvbU5vZGUsIHZOb2RlLCBwYXRjaCwgcmVuZGVyT3B0aW9ucylcbiAgICAgICAgY2FzZSBWUGF0Y2guT1JERVI6XG4gICAgICAgICAgICByZW9yZGVyQ2hpbGRyZW4oZG9tTm9kZSwgcGF0Y2gpXG4gICAgICAgICAgICByZXR1cm4gZG9tTm9kZVxuICAgICAgICBjYXNlIFZQYXRjaC5QUk9QUzpcbiAgICAgICAgICAgIGFwcGx5UHJvcGVydGllcyhkb21Ob2RlLCBwYXRjaCwgdk5vZGUucHJvcGVydGllcylcbiAgICAgICAgICAgIHJldHVybiBkb21Ob2RlXG4gICAgICAgIGNhc2UgVlBhdGNoLlRIVU5LOlxuICAgICAgICAgICAgcmV0dXJuIHJlcGxhY2VSb290KGRvbU5vZGUsXG4gICAgICAgICAgICAgICAgcmVuZGVyT3B0aW9ucy5wYXRjaChkb21Ob2RlLCBwYXRjaCwgcmVuZGVyT3B0aW9ucykpXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICByZXR1cm4gZG9tTm9kZVxuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlTm9kZShkb21Ob2RlLCB2Tm9kZSkge1xuICAgIHZhciBwYXJlbnROb2RlID0gZG9tTm9kZS5wYXJlbnROb2RlXG5cbiAgICBpZiAocGFyZW50Tm9kZSkge1xuICAgICAgICBwYXJlbnROb2RlLnJlbW92ZUNoaWxkKGRvbU5vZGUpXG4gICAgfVxuXG4gICAgZGVzdHJveVdpZGdldChkb21Ob2RlLCB2Tm9kZSk7XG5cbiAgICByZXR1cm4gbnVsbFxufVxuXG5mdW5jdGlvbiBpbnNlcnROb2RlKHBhcmVudE5vZGUsIHZOb2RlLCByZW5kZXJPcHRpb25zKSB7XG4gICAgdmFyIG5ld05vZGUgPSByZW5kZXIodk5vZGUsIHJlbmRlck9wdGlvbnMpXG5cbiAgICBpZiAocGFyZW50Tm9kZSkge1xuICAgICAgICBwYXJlbnROb2RlLmFwcGVuZENoaWxkKG5ld05vZGUpXG4gICAgfVxuXG4gICAgcmV0dXJuIHBhcmVudE5vZGVcbn1cblxuZnVuY3Rpb24gc3RyaW5nUGF0Y2goZG9tTm9kZSwgbGVmdFZOb2RlLCB2VGV4dCwgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciBuZXdOb2RlXG5cbiAgICBpZiAoZG9tTm9kZS5ub2RlVHlwZSA9PT0gMykge1xuICAgICAgICBkb21Ob2RlLnJlcGxhY2VEYXRhKDAsIGRvbU5vZGUubGVuZ3RoLCB2VGV4dC50ZXh0KVxuICAgICAgICBuZXdOb2RlID0gZG9tTm9kZVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBwYXJlbnROb2RlID0gZG9tTm9kZS5wYXJlbnROb2RlXG4gICAgICAgIG5ld05vZGUgPSByZW5kZXIodlRleHQsIHJlbmRlck9wdGlvbnMpXG5cbiAgICAgICAgaWYgKHBhcmVudE5vZGUpIHtcbiAgICAgICAgICAgIHBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG5ld05vZGUsIGRvbU5vZGUpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmV3Tm9kZVxufVxuXG5mdW5jdGlvbiB3aWRnZXRQYXRjaChkb21Ob2RlLCBsZWZ0Vk5vZGUsIHdpZGdldCwgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciB1cGRhdGluZyA9IHVwZGF0ZVdpZGdldChsZWZ0Vk5vZGUsIHdpZGdldClcbiAgICB2YXIgbmV3Tm9kZVxuXG4gICAgaWYgKHVwZGF0aW5nKSB7XG4gICAgICAgIG5ld05vZGUgPSB3aWRnZXQudXBkYXRlKGxlZnRWTm9kZSwgZG9tTm9kZSkgfHwgZG9tTm9kZVxuICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld05vZGUgPSByZW5kZXIod2lkZ2V0LCByZW5kZXJPcHRpb25zKVxuICAgIH1cblxuICAgIHZhciBwYXJlbnROb2RlID0gZG9tTm9kZS5wYXJlbnROb2RlXG5cbiAgICBpZiAocGFyZW50Tm9kZSAmJiBuZXdOb2RlICE9PSBkb21Ob2RlKSB7XG4gICAgICAgIHBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG5ld05vZGUsIGRvbU5vZGUpXG4gICAgfVxuXG4gICAgaWYgKCF1cGRhdGluZykge1xuICAgICAgICBkZXN0cm95V2lkZ2V0KGRvbU5vZGUsIGxlZnRWTm9kZSlcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3Tm9kZVxufVxuXG5mdW5jdGlvbiB2Tm9kZVBhdGNoKGRvbU5vZGUsIGxlZnRWTm9kZSwgdk5vZGUsIHJlbmRlck9wdGlvbnMpIHtcbiAgICB2YXIgcGFyZW50Tm9kZSA9IGRvbU5vZGUucGFyZW50Tm9kZVxuICAgIHZhciBuZXdOb2RlID0gcmVuZGVyKHZOb2RlLCByZW5kZXJPcHRpb25zKVxuXG4gICAgaWYgKHBhcmVudE5vZGUpIHtcbiAgICAgICAgcGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobmV3Tm9kZSwgZG9tTm9kZSlcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3Tm9kZVxufVxuXG5mdW5jdGlvbiBkZXN0cm95V2lkZ2V0KGRvbU5vZGUsIHcpIHtcbiAgICBpZiAodHlwZW9mIHcuZGVzdHJveSA9PT0gXCJmdW5jdGlvblwiICYmIGlzV2lkZ2V0KHcpKSB7XG4gICAgICAgIHcuZGVzdHJveShkb21Ob2RlKVxuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVvcmRlckNoaWxkcmVuKGRvbU5vZGUsIGJJbmRleCkge1xuICAgIHZhciBjaGlsZHJlbiA9IFtdXG4gICAgdmFyIGNoaWxkTm9kZXMgPSBkb21Ob2RlLmNoaWxkTm9kZXNcbiAgICB2YXIgbGVuID0gY2hpbGROb2Rlcy5sZW5ndGhcbiAgICB2YXIgaVxuICAgIHZhciByZXZlcnNlSW5kZXggPSBiSW5kZXgucmV2ZXJzZVxuXG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGNoaWxkcmVuLnB1c2goZG9tTm9kZS5jaGlsZE5vZGVzW2ldKVxuICAgIH1cblxuICAgIHZhciBpbnNlcnRPZmZzZXQgPSAwXG4gICAgdmFyIG1vdmVcbiAgICB2YXIgbm9kZVxuICAgIHZhciBpbnNlcnROb2RlXG4gICAgdmFyIGNoYWluTGVuZ3RoXG4gICAgdmFyIGluc2VydGVkTGVuZ3RoXG4gICAgdmFyIG5leHRTaWJsaW5nXG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjspIHtcbiAgICAgICAgbW92ZSA9IGJJbmRleFtpXVxuICAgICAgICBjaGFpbkxlbmd0aCA9IDFcbiAgICAgICAgaWYgKG1vdmUgIT09IHVuZGVmaW5lZCAmJiBtb3ZlICE9PSBpKSB7XG4gICAgICAgICAgICAvLyB0cnkgdG8gYnJpbmcgZm9yd2FyZCBhcyBsb25nIG9mIGEgY2hhaW4gYXMgcG9zc2libGVcbiAgICAgICAgICAgIHdoaWxlIChiSW5kZXhbaSArIGNoYWluTGVuZ3RoXSA9PT0gbW92ZSArIGNoYWluTGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgY2hhaW5MZW5ndGgrKztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdGhlIGVsZW1lbnQgY3VycmVudGx5IGF0IHRoaXMgaW5kZXggd2lsbCBiZSBtb3ZlZCBsYXRlciBzbyBpbmNyZWFzZSB0aGUgaW5zZXJ0IG9mZnNldFxuICAgICAgICAgICAgaWYgKHJldmVyc2VJbmRleFtpXSA+IGkgKyBjaGFpbkxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGluc2VydE9mZnNldCsrXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5vZGUgPSBjaGlsZHJlblttb3ZlXVxuICAgICAgICAgICAgaW5zZXJ0Tm9kZSA9IGNoaWxkTm9kZXNbaSArIGluc2VydE9mZnNldF0gfHwgbnVsbFxuICAgICAgICAgICAgaW5zZXJ0ZWRMZW5ndGggPSAwXG4gICAgICAgICAgICB3aGlsZSAobm9kZSAhPT0gaW5zZXJ0Tm9kZSAmJiBpbnNlcnRlZExlbmd0aCsrIDwgY2hhaW5MZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBkb21Ob2RlLmluc2VydEJlZm9yZShub2RlLCBpbnNlcnROb2RlKTtcbiAgICAgICAgICAgICAgICBub2RlID0gY2hpbGRyZW5bbW92ZSArIGluc2VydGVkTGVuZ3RoXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdGhlIG1vdmVkIGVsZW1lbnQgY2FtZSBmcm9tIHRoZSBmcm9udCBvZiB0aGUgYXJyYXkgc28gcmVkdWNlIHRoZSBpbnNlcnQgb2Zmc2V0XG4gICAgICAgICAgICBpZiAobW92ZSArIGNoYWluTGVuZ3RoIDwgaSkge1xuICAgICAgICAgICAgICAgIGluc2VydE9mZnNldC0tXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBlbGVtZW50IGF0IHRoaXMgaW5kZXggaXMgc2NoZWR1bGVkIHRvIGJlIHJlbW92ZWQgc28gaW5jcmVhc2UgaW5zZXJ0IG9mZnNldFxuICAgICAgICBpZiAoaSBpbiBiSW5kZXgucmVtb3Zlcykge1xuICAgICAgICAgICAgaW5zZXJ0T2Zmc2V0KytcbiAgICAgICAgfVxuXG4gICAgICAgIGkgKz0gY2hhaW5MZW5ndGhcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlcGxhY2VSb290KG9sZFJvb3QsIG5ld1Jvb3QpIHtcbiAgICBpZiAob2xkUm9vdCAmJiBuZXdSb290ICYmIG9sZFJvb3QgIT09IG5ld1Jvb3QgJiYgb2xkUm9vdC5wYXJlbnROb2RlKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKG9sZFJvb3QpXG4gICAgICAgIG9sZFJvb3QucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobmV3Um9vdCwgb2xkUm9vdClcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3Um9vdDtcbn1cbiIsInZhciBkb2N1bWVudCA9IHJlcXVpcmUoXCJnbG9iYWwvZG9jdW1lbnRcIilcbnZhciBpc0FycmF5ID0gcmVxdWlyZShcIngtaXMtYXJyYXlcIilcblxudmFyIGRvbUluZGV4ID0gcmVxdWlyZShcIi4vZG9tLWluZGV4XCIpXG52YXIgcGF0Y2hPcCA9IHJlcXVpcmUoXCIuL3BhdGNoLW9wXCIpXG5tb2R1bGUuZXhwb3J0cyA9IHBhdGNoXG5cbmZ1bmN0aW9uIHBhdGNoKHJvb3ROb2RlLCBwYXRjaGVzKSB7XG4gICAgcmV0dXJuIHBhdGNoUmVjdXJzaXZlKHJvb3ROb2RlLCBwYXRjaGVzKVxufVxuXG5mdW5jdGlvbiBwYXRjaFJlY3Vyc2l2ZShyb290Tm9kZSwgcGF0Y2hlcywgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciBpbmRpY2VzID0gcGF0Y2hJbmRpY2VzKHBhdGNoZXMpXG5cbiAgICBpZiAoaW5kaWNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHJvb3ROb2RlXG4gICAgfVxuXG4gICAgdmFyIGluZGV4ID0gZG9tSW5kZXgocm9vdE5vZGUsIHBhdGNoZXMuYSwgaW5kaWNlcylcbiAgICB2YXIgb3duZXJEb2N1bWVudCA9IHJvb3ROb2RlLm93bmVyRG9jdW1lbnRcblxuICAgIGlmICghcmVuZGVyT3B0aW9ucykge1xuICAgICAgICByZW5kZXJPcHRpb25zID0geyBwYXRjaDogcGF0Y2hSZWN1cnNpdmUgfVxuICAgICAgICBpZiAob3duZXJEb2N1bWVudCAhPT0gZG9jdW1lbnQpIHtcbiAgICAgICAgICAgIHJlbmRlck9wdGlvbnMuZG9jdW1lbnQgPSBvd25lckRvY3VtZW50XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGluZGljZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIG5vZGVJbmRleCA9IGluZGljZXNbaV1cbiAgICAgICAgcm9vdE5vZGUgPSBhcHBseVBhdGNoKHJvb3ROb2RlLFxuICAgICAgICAgICAgaW5kZXhbbm9kZUluZGV4XSxcbiAgICAgICAgICAgIHBhdGNoZXNbbm9kZUluZGV4XSxcbiAgICAgICAgICAgIHJlbmRlck9wdGlvbnMpXG4gICAgfVxuXG4gICAgcmV0dXJuIHJvb3ROb2RlXG59XG5cbmZ1bmN0aW9uIGFwcGx5UGF0Y2gocm9vdE5vZGUsIGRvbU5vZGUsIHBhdGNoTGlzdCwgcmVuZGVyT3B0aW9ucykge1xuICAgIGlmICghZG9tTm9kZSkge1xuICAgICAgICByZXR1cm4gcm9vdE5vZGVcbiAgICB9XG5cbiAgICB2YXIgbmV3Tm9kZVxuXG4gICAgaWYgKGlzQXJyYXkocGF0Y2hMaXN0KSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBhdGNoTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbmV3Tm9kZSA9IHBhdGNoT3AocGF0Y2hMaXN0W2ldLCBkb21Ob2RlLCByZW5kZXJPcHRpb25zKVxuXG4gICAgICAgICAgICBpZiAoZG9tTm9kZSA9PT0gcm9vdE5vZGUpIHtcbiAgICAgICAgICAgICAgICByb290Tm9kZSA9IG5ld05vZGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld05vZGUgPSBwYXRjaE9wKHBhdGNoTGlzdCwgZG9tTm9kZSwgcmVuZGVyT3B0aW9ucylcblxuICAgICAgICBpZiAoZG9tTm9kZSA9PT0gcm9vdE5vZGUpIHtcbiAgICAgICAgICAgIHJvb3ROb2RlID0gbmV3Tm9kZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJvb3ROb2RlXG59XG5cbmZ1bmN0aW9uIHBhdGNoSW5kaWNlcyhwYXRjaGVzKSB7XG4gICAgdmFyIGluZGljZXMgPSBbXVxuXG4gICAgZm9yICh2YXIga2V5IGluIHBhdGNoZXMpIHtcbiAgICAgICAgaWYgKGtleSAhPT0gXCJhXCIpIHtcbiAgICAgICAgICAgIGluZGljZXMucHVzaChOdW1iZXIoa2V5KSlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBpbmRpY2VzXG59XG4iLCJ2YXIgaXNXaWRnZXQgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtd2lkZ2V0LmpzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gdXBkYXRlV2lkZ2V0XG5cbmZ1bmN0aW9uIHVwZGF0ZVdpZGdldChhLCBiKSB7XG4gICAgaWYgKGlzV2lkZ2V0KGEpICYmIGlzV2lkZ2V0KGIpKSB7XG4gICAgICAgIGlmIChcIm5hbWVcIiBpbiBhICYmIFwibmFtZVwiIGluIGIpIHtcbiAgICAgICAgICAgIHJldHVybiBhLmlkID09PSBiLmlkXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gYS5pbml0ID09PSBiLmluaXRcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgRXZTdG9yZSA9IHJlcXVpcmUoJ2V2LXN0b3JlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gRXZIb29rO1xuXG5mdW5jdGlvbiBFdkhvb2sodmFsdWUpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgRXZIb29rKSkge1xuICAgICAgICByZXR1cm4gbmV3IEV2SG9vayh2YWx1ZSk7XG4gICAgfVxuXG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xufVxuXG5Fdkhvb2sucHJvdG90eXBlLmhvb2sgPSBmdW5jdGlvbiAobm9kZSwgcHJvcGVydHlOYW1lKSB7XG4gICAgdmFyIGVzID0gRXZTdG9yZShub2RlKTtcbiAgICB2YXIgcHJvcE5hbWUgPSBwcm9wZXJ0eU5hbWUuc3Vic3RyKDMpO1xuXG4gICAgZXNbcHJvcE5hbWVdID0gdGhpcy52YWx1ZTtcbn07XG5cbkV2SG9vay5wcm90b3R5cGUudW5ob29rID0gZnVuY3Rpb24obm9kZSwgcHJvcGVydHlOYW1lKSB7XG4gICAgdmFyIGVzID0gRXZTdG9yZShub2RlKTtcbiAgICB2YXIgcHJvcE5hbWUgPSBwcm9wZXJ0eU5hbWUuc3Vic3RyKDMpO1xuXG4gICAgZXNbcHJvcE5hbWVdID0gdW5kZWZpbmVkO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBTb2Z0U2V0SG9vaztcblxuZnVuY3Rpb24gU29mdFNldEhvb2sodmFsdWUpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgU29mdFNldEhvb2spKSB7XG4gICAgICAgIHJldHVybiBuZXcgU29mdFNldEhvb2sodmFsdWUpO1xuICAgIH1cblxuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbn1cblxuU29mdFNldEhvb2sucHJvdG90eXBlLmhvb2sgPSBmdW5jdGlvbiAobm9kZSwgcHJvcGVydHlOYW1lKSB7XG4gICAgaWYgKG5vZGVbcHJvcGVydHlOYW1lXSAhPT0gdGhpcy52YWx1ZSkge1xuICAgICAgICBub2RlW3Byb3BlcnR5TmFtZV0gPSB0aGlzLnZhbHVlO1xuICAgIH1cbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBpc0FycmF5ID0gcmVxdWlyZSgneC1pcy1hcnJheScpO1xuXG52YXIgVk5vZGUgPSByZXF1aXJlKCcuLi92bm9kZS92bm9kZS5qcycpO1xudmFyIFZUZXh0ID0gcmVxdWlyZSgnLi4vdm5vZGUvdnRleHQuanMnKTtcbnZhciBpc1ZOb2RlID0gcmVxdWlyZSgnLi4vdm5vZGUvaXMtdm5vZGUnKTtcbnZhciBpc1ZUZXh0ID0gcmVxdWlyZSgnLi4vdm5vZGUvaXMtdnRleHQnKTtcbnZhciBpc1dpZGdldCA9IHJlcXVpcmUoJy4uL3Zub2RlL2lzLXdpZGdldCcpO1xudmFyIGlzSG9vayA9IHJlcXVpcmUoJy4uL3Zub2RlL2lzLXZob29rJyk7XG52YXIgaXNWVGh1bmsgPSByZXF1aXJlKCcuLi92bm9kZS9pcy10aHVuaycpO1xuXG52YXIgcGFyc2VUYWcgPSByZXF1aXJlKCcuL3BhcnNlLXRhZy5qcycpO1xudmFyIHNvZnRTZXRIb29rID0gcmVxdWlyZSgnLi9ob29rcy9zb2Z0LXNldC1ob29rLmpzJyk7XG52YXIgZXZIb29rID0gcmVxdWlyZSgnLi9ob29rcy9ldi1ob29rLmpzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gaDtcblxuZnVuY3Rpb24gaCh0YWdOYW1lLCBwcm9wZXJ0aWVzLCBjaGlsZHJlbikge1xuICAgIHZhciBjaGlsZE5vZGVzID0gW107XG4gICAgdmFyIHRhZywgcHJvcHMsIGtleSwgbmFtZXNwYWNlO1xuXG4gICAgaWYgKCFjaGlsZHJlbiAmJiBpc0NoaWxkcmVuKHByb3BlcnRpZXMpKSB7XG4gICAgICAgIGNoaWxkcmVuID0gcHJvcGVydGllcztcbiAgICAgICAgcHJvcHMgPSB7fTtcbiAgICB9XG5cbiAgICBwcm9wcyA9IHByb3BzIHx8IHByb3BlcnRpZXMgfHwge307XG4gICAgdGFnID0gcGFyc2VUYWcodGFnTmFtZSwgcHJvcHMpO1xuXG4gICAgLy8gc3VwcG9ydCBrZXlzXG4gICAgaWYgKHByb3BzLmhhc093blByb3BlcnR5KCdrZXknKSkge1xuICAgICAgICBrZXkgPSBwcm9wcy5rZXk7XG4gICAgICAgIHByb3BzLmtleSA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICAvLyBzdXBwb3J0IG5hbWVzcGFjZVxuICAgIGlmIChwcm9wcy5oYXNPd25Qcm9wZXJ0eSgnbmFtZXNwYWNlJykpIHtcbiAgICAgICAgbmFtZXNwYWNlID0gcHJvcHMubmFtZXNwYWNlO1xuICAgICAgICBwcm9wcy5uYW1lc3BhY2UgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLy8gZml4IGN1cnNvciBidWdcbiAgICBpZiAodGFnID09PSAnSU5QVVQnICYmXG4gICAgICAgICFuYW1lc3BhY2UgJiZcbiAgICAgICAgcHJvcHMuaGFzT3duUHJvcGVydHkoJ3ZhbHVlJykgJiZcbiAgICAgICAgcHJvcHMudmFsdWUgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAhaXNIb29rKHByb3BzLnZhbHVlKVxuICAgICkge1xuICAgICAgICBwcm9wcy52YWx1ZSA9IHNvZnRTZXRIb29rKHByb3BzLnZhbHVlKTtcbiAgICB9XG5cbiAgICB0cmFuc2Zvcm1Qcm9wZXJ0aWVzKHByb3BzKTtcblxuICAgIGlmIChjaGlsZHJlbiAhPT0gdW5kZWZpbmVkICYmIGNoaWxkcmVuICE9PSBudWxsKSB7XG4gICAgICAgIGFkZENoaWxkKGNoaWxkcmVuLCBjaGlsZE5vZGVzLCB0YWcsIHByb3BzKTtcbiAgICB9XG5cblxuICAgIHJldHVybiBuZXcgVk5vZGUodGFnLCBwcm9wcywgY2hpbGROb2Rlcywga2V5LCBuYW1lc3BhY2UpO1xufVxuXG5mdW5jdGlvbiBhZGRDaGlsZChjLCBjaGlsZE5vZGVzLCB0YWcsIHByb3BzKSB7XG4gICAgaWYgKHR5cGVvZiBjID09PSAnc3RyaW5nJykge1xuICAgICAgICBjaGlsZE5vZGVzLnB1c2gobmV3IFZUZXh0KGMpKTtcbiAgICB9IGVsc2UgaWYgKGlzQ2hpbGQoYykpIHtcbiAgICAgICAgY2hpbGROb2Rlcy5wdXNoKGMpO1xuICAgIH0gZWxzZSBpZiAoaXNBcnJheShjKSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFkZENoaWxkKGNbaV0sIGNoaWxkTm9kZXMsIHRhZywgcHJvcHMpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChjID09PSBudWxsIHx8IGMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm47XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgVW5leHBlY3RlZFZpcnR1YWxFbGVtZW50KHtcbiAgICAgICAgICAgIGZvcmVpZ25PYmplY3Q6IGMsXG4gICAgICAgICAgICBwYXJlbnRWbm9kZToge1xuICAgICAgICAgICAgICAgIHRhZ05hbWU6IHRhZyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiBwcm9wc1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHRyYW5zZm9ybVByb3BlcnRpZXMocHJvcHMpIHtcbiAgICBmb3IgKHZhciBwcm9wTmFtZSBpbiBwcm9wcykge1xuICAgICAgICBpZiAocHJvcHMuaGFzT3duUHJvcGVydHkocHJvcE5hbWUpKSB7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBwcm9wc1twcm9wTmFtZV07XG5cbiAgICAgICAgICAgIGlmIChpc0hvb2sodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChwcm9wTmFtZS5zdWJzdHIoMCwgMykgPT09ICdldi0nKSB7XG4gICAgICAgICAgICAgICAgLy8gYWRkIGV2LWZvbyBzdXBwb3J0XG4gICAgICAgICAgICAgICAgcHJvcHNbcHJvcE5hbWVdID0gZXZIb29rKHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gaXNDaGlsZCh4KSB7XG4gICAgcmV0dXJuIGlzVk5vZGUoeCkgfHwgaXNWVGV4dCh4KSB8fCBpc1dpZGdldCh4KSB8fCBpc1ZUaHVuayh4KTtcbn1cblxuZnVuY3Rpb24gaXNDaGlsZHJlbih4KSB7XG4gICAgcmV0dXJuIHR5cGVvZiB4ID09PSAnc3RyaW5nJyB8fCBpc0FycmF5KHgpIHx8IGlzQ2hpbGQoeCk7XG59XG5cbmZ1bmN0aW9uIFVuZXhwZWN0ZWRWaXJ0dWFsRWxlbWVudChkYXRhKSB7XG4gICAgdmFyIGVyciA9IG5ldyBFcnJvcigpO1xuXG4gICAgZXJyLnR5cGUgPSAndmlydHVhbC1oeXBlcnNjcmlwdC51bmV4cGVjdGVkLnZpcnR1YWwtZWxlbWVudCc7XG4gICAgZXJyLm1lc3NhZ2UgPSAnVW5leHBlY3RlZCB2aXJ0dWFsIGNoaWxkIHBhc3NlZCB0byBoKCkuXFxuJyArXG4gICAgICAgICdFeHBlY3RlZCBhIFZOb2RlIC8gVnRodW5rIC8gVldpZGdldCAvIHN0cmluZyBidXQ6XFxuJyArXG4gICAgICAgICdnb3Q6XFxuJyArXG4gICAgICAgIGVycm9yU3RyaW5nKGRhdGEuZm9yZWlnbk9iamVjdCkgK1xuICAgICAgICAnLlxcbicgK1xuICAgICAgICAnVGhlIHBhcmVudCB2bm9kZSBpczpcXG4nICtcbiAgICAgICAgZXJyb3JTdHJpbmcoZGF0YS5wYXJlbnRWbm9kZSlcbiAgICAgICAgJ1xcbicgK1xuICAgICAgICAnU3VnZ2VzdGVkIGZpeDogY2hhbmdlIHlvdXIgYGgoLi4uLCBbIC4uLiBdKWAgY2FsbHNpdGUuJztcbiAgICBlcnIuZm9yZWlnbk9iamVjdCA9IGRhdGEuZm9yZWlnbk9iamVjdDtcbiAgICBlcnIucGFyZW50Vm5vZGUgPSBkYXRhLnBhcmVudFZub2RlO1xuXG4gICAgcmV0dXJuIGVycjtcbn1cblxuZnVuY3Rpb24gZXJyb3JTdHJpbmcob2JqKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG9iaiwgbnVsbCwgJyAgICAnKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBTdHJpbmcob2JqKTtcbiAgICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzcGxpdCA9IHJlcXVpcmUoJ2Jyb3dzZXItc3BsaXQnKTtcblxudmFyIGNsYXNzSWRTcGxpdCA9IC8oW1xcLiNdP1thLXpBLVowLTlfOi1dKykvO1xudmFyIG5vdENsYXNzSWQgPSAvXlxcLnwjLztcblxubW9kdWxlLmV4cG9ydHMgPSBwYXJzZVRhZztcblxuZnVuY3Rpb24gcGFyc2VUYWcodGFnLCBwcm9wcykge1xuICAgIGlmICghdGFnKSB7XG4gICAgICAgIHJldHVybiAnRElWJztcbiAgICB9XG5cbiAgICB2YXIgbm9JZCA9ICEocHJvcHMuaGFzT3duUHJvcGVydHkoJ2lkJykpO1xuXG4gICAgdmFyIHRhZ1BhcnRzID0gc3BsaXQodGFnLCBjbGFzc0lkU3BsaXQpO1xuICAgIHZhciB0YWdOYW1lID0gbnVsbDtcblxuICAgIGlmIChub3RDbGFzc0lkLnRlc3QodGFnUGFydHNbMV0pKSB7XG4gICAgICAgIHRhZ05hbWUgPSAnRElWJztcbiAgICB9XG5cbiAgICB2YXIgY2xhc3NlcywgcGFydCwgdHlwZSwgaTtcblxuICAgIGZvciAoaSA9IDA7IGkgPCB0YWdQYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBwYXJ0ID0gdGFnUGFydHNbaV07XG5cbiAgICAgICAgaWYgKCFwYXJ0KSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHR5cGUgPSBwYXJ0LmNoYXJBdCgwKTtcblxuICAgICAgICBpZiAoIXRhZ05hbWUpIHtcbiAgICAgICAgICAgIHRhZ05hbWUgPSBwYXJ0O1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICcuJykge1xuICAgICAgICAgICAgY2xhc3NlcyA9IGNsYXNzZXMgfHwgW107XG4gICAgICAgICAgICBjbGFzc2VzLnB1c2gocGFydC5zdWJzdHJpbmcoMSwgcGFydC5sZW5ndGgpKTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnIycgJiYgbm9JZCkge1xuICAgICAgICAgICAgcHJvcHMuaWQgPSBwYXJ0LnN1YnN0cmluZygxLCBwYXJ0Lmxlbmd0aCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY2xhc3Nlcykge1xuICAgICAgICBpZiAocHJvcHMuY2xhc3NOYW1lKSB7XG4gICAgICAgICAgICBjbGFzc2VzLnB1c2gocHJvcHMuY2xhc3NOYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb3BzLmNsYXNzTmFtZSA9IGNsYXNzZXMuam9pbignICcpO1xuICAgIH1cblxuICAgIHJldHVybiBwcm9wcy5uYW1lc3BhY2UgPyB0YWdOYW1lIDogdGFnTmFtZS50b1VwcGVyQ2FzZSgpO1xufVxuIiwidmFyIGlzVk5vZGUgPSByZXF1aXJlKFwiLi9pcy12bm9kZVwiKVxudmFyIGlzVlRleHQgPSByZXF1aXJlKFwiLi9pcy12dGV4dFwiKVxudmFyIGlzV2lkZ2V0ID0gcmVxdWlyZShcIi4vaXMtd2lkZ2V0XCIpXG52YXIgaXNUaHVuayA9IHJlcXVpcmUoXCIuL2lzLXRodW5rXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlVGh1bmtcblxuZnVuY3Rpb24gaGFuZGxlVGh1bmsoYSwgYikge1xuICAgIHZhciByZW5kZXJlZEEgPSBhXG4gICAgdmFyIHJlbmRlcmVkQiA9IGJcblxuICAgIGlmIChpc1RodW5rKGIpKSB7XG4gICAgICAgIHJlbmRlcmVkQiA9IHJlbmRlclRodW5rKGIsIGEpXG4gICAgfVxuXG4gICAgaWYgKGlzVGh1bmsoYSkpIHtcbiAgICAgICAgcmVuZGVyZWRBID0gcmVuZGVyVGh1bmsoYSwgbnVsbClcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBhOiByZW5kZXJlZEEsXG4gICAgICAgIGI6IHJlbmRlcmVkQlxuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVuZGVyVGh1bmsodGh1bmssIHByZXZpb3VzKSB7XG4gICAgdmFyIHJlbmRlcmVkVGh1bmsgPSB0aHVuay52bm9kZVxuXG4gICAgaWYgKCFyZW5kZXJlZFRodW5rKSB7XG4gICAgICAgIHJlbmRlcmVkVGh1bmsgPSB0aHVuay52bm9kZSA9IHRodW5rLnJlbmRlcihwcmV2aW91cylcbiAgICB9XG5cbiAgICBpZiAoIShpc1ZOb2RlKHJlbmRlcmVkVGh1bmspIHx8XG4gICAgICAgICAgICBpc1ZUZXh0KHJlbmRlcmVkVGh1bmspIHx8XG4gICAgICAgICAgICBpc1dpZGdldChyZW5kZXJlZFRodW5rKSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwidGh1bmsgZGlkIG5vdCByZXR1cm4gYSB2YWxpZCBub2RlXCIpO1xuICAgIH1cblxuICAgIHJldHVybiByZW5kZXJlZFRodW5rXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGlzVGh1bmtcclxuXHJcbmZ1bmN0aW9uIGlzVGh1bmsodCkge1xyXG4gICAgcmV0dXJuIHQgJiYgdC50eXBlID09PSBcIlRodW5rXCJcclxufVxyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGlzSG9va1xuXG5mdW5jdGlvbiBpc0hvb2soaG9vaykge1xuICAgIHJldHVybiBob29rICYmXG4gICAgICAodHlwZW9mIGhvb2suaG9vayA9PT0gXCJmdW5jdGlvblwiICYmICFob29rLmhhc093blByb3BlcnR5KFwiaG9va1wiKSB8fFxuICAgICAgIHR5cGVvZiBob29rLnVuaG9vayA9PT0gXCJmdW5jdGlvblwiICYmICFob29rLmhhc093blByb3BlcnR5KFwidW5ob29rXCIpKVxufVxuIiwidmFyIHZlcnNpb24gPSByZXF1aXJlKFwiLi92ZXJzaW9uXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gaXNWaXJ0dWFsTm9kZVxuXG5mdW5jdGlvbiBpc1ZpcnR1YWxOb2RlKHgpIHtcbiAgICByZXR1cm4geCAmJiB4LnR5cGUgPT09IFwiVmlydHVhbE5vZGVcIiAmJiB4LnZlcnNpb24gPT09IHZlcnNpb25cbn1cbiIsInZhciB2ZXJzaW9uID0gcmVxdWlyZShcIi4vdmVyc2lvblwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzVmlydHVhbFRleHRcblxuZnVuY3Rpb24gaXNWaXJ0dWFsVGV4dCh4KSB7XG4gICAgcmV0dXJuIHggJiYgeC50eXBlID09PSBcIlZpcnR1YWxUZXh0XCIgJiYgeC52ZXJzaW9uID09PSB2ZXJzaW9uXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGlzV2lkZ2V0XG5cbmZ1bmN0aW9uIGlzV2lkZ2V0KHcpIHtcbiAgICByZXR1cm4gdyAmJiB3LnR5cGUgPT09IFwiV2lkZ2V0XCJcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gXCIxXCJcbiIsInZhciB2ZXJzaW9uID0gcmVxdWlyZShcIi4vdmVyc2lvblwiKVxudmFyIGlzVk5vZGUgPSByZXF1aXJlKFwiLi9pcy12bm9kZVwiKVxudmFyIGlzV2lkZ2V0ID0gcmVxdWlyZShcIi4vaXMtd2lkZ2V0XCIpXG52YXIgaXNUaHVuayA9IHJlcXVpcmUoXCIuL2lzLXRodW5rXCIpXG52YXIgaXNWSG9vayA9IHJlcXVpcmUoXCIuL2lzLXZob29rXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gVmlydHVhbE5vZGVcblxudmFyIG5vUHJvcGVydGllcyA9IHt9XG52YXIgbm9DaGlsZHJlbiA9IFtdXG5cbmZ1bmN0aW9uIFZpcnR1YWxOb2RlKHRhZ05hbWUsIHByb3BlcnRpZXMsIGNoaWxkcmVuLCBrZXksIG5hbWVzcGFjZSkge1xuICAgIHRoaXMudGFnTmFtZSA9IHRhZ05hbWVcbiAgICB0aGlzLnByb3BlcnRpZXMgPSBwcm9wZXJ0aWVzIHx8IG5vUHJvcGVydGllc1xuICAgIHRoaXMuY2hpbGRyZW4gPSBjaGlsZHJlbiB8fCBub0NoaWxkcmVuXG4gICAgdGhpcy5rZXkgPSBrZXkgIT0gbnVsbCA/IFN0cmluZyhrZXkpIDogdW5kZWZpbmVkXG4gICAgdGhpcy5uYW1lc3BhY2UgPSAodHlwZW9mIG5hbWVzcGFjZSA9PT0gXCJzdHJpbmdcIikgPyBuYW1lc3BhY2UgOiBudWxsXG5cbiAgICB2YXIgY291bnQgPSAoY2hpbGRyZW4gJiYgY2hpbGRyZW4ubGVuZ3RoKSB8fCAwXG4gICAgdmFyIGRlc2NlbmRhbnRzID0gMFxuICAgIHZhciBoYXNXaWRnZXRzID0gZmFsc2VcbiAgICB2YXIgaGFzVGh1bmtzID0gZmFsc2VcbiAgICB2YXIgZGVzY2VuZGFudEhvb2tzID0gZmFsc2VcbiAgICB2YXIgaG9va3NcblxuICAgIGZvciAodmFyIHByb3BOYW1lIGluIHByb3BlcnRpZXMpIHtcbiAgICAgICAgaWYgKHByb3BlcnRpZXMuaGFzT3duUHJvcGVydHkocHJvcE5hbWUpKSB7XG4gICAgICAgICAgICB2YXIgcHJvcGVydHkgPSBwcm9wZXJ0aWVzW3Byb3BOYW1lXVxuICAgICAgICAgICAgaWYgKGlzVkhvb2socHJvcGVydHkpICYmIHByb3BlcnR5LnVuaG9vaykge1xuICAgICAgICAgICAgICAgIGlmICghaG9va3MpIHtcbiAgICAgICAgICAgICAgICAgICAgaG9va3MgPSB7fVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGhvb2tzW3Byb3BOYW1lXSA9IHByb3BlcnR5XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgdmFyIGNoaWxkID0gY2hpbGRyZW5baV1cbiAgICAgICAgaWYgKGlzVk5vZGUoY2hpbGQpKSB7XG4gICAgICAgICAgICBkZXNjZW5kYW50cyArPSBjaGlsZC5jb3VudCB8fCAwXG5cbiAgICAgICAgICAgIGlmICghaGFzV2lkZ2V0cyAmJiBjaGlsZC5oYXNXaWRnZXRzKSB7XG4gICAgICAgICAgICAgICAgaGFzV2lkZ2V0cyA9IHRydWVcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFoYXNUaHVua3MgJiYgY2hpbGQuaGFzVGh1bmtzKSB7XG4gICAgICAgICAgICAgICAgaGFzVGh1bmtzID0gdHJ1ZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWRlc2NlbmRhbnRIb29rcyAmJiAoY2hpbGQuaG9va3MgfHwgY2hpbGQuZGVzY2VuZGFudEhvb2tzKSkge1xuICAgICAgICAgICAgICAgIGRlc2NlbmRhbnRIb29rcyA9IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICghaGFzV2lkZ2V0cyAmJiBpc1dpZGdldChjaGlsZCkpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2hpbGQuZGVzdHJveSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgaGFzV2lkZ2V0cyA9IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICghaGFzVGh1bmtzICYmIGlzVGh1bmsoY2hpbGQpKSB7XG4gICAgICAgICAgICBoYXNUaHVua3MgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5jb3VudCA9IGNvdW50ICsgZGVzY2VuZGFudHNcbiAgICB0aGlzLmhhc1dpZGdldHMgPSBoYXNXaWRnZXRzXG4gICAgdGhpcy5oYXNUaHVua3MgPSBoYXNUaHVua3NcbiAgICB0aGlzLmhvb2tzID0gaG9va3NcbiAgICB0aGlzLmRlc2NlbmRhbnRIb29rcyA9IGRlc2NlbmRhbnRIb29rc1xufVxuXG5WaXJ0dWFsTm9kZS5wcm90b3R5cGUudmVyc2lvbiA9IHZlcnNpb25cblZpcnR1YWxOb2RlLnByb3RvdHlwZS50eXBlID0gXCJWaXJ0dWFsTm9kZVwiXG4iLCJ2YXIgdmVyc2lvbiA9IHJlcXVpcmUoXCIuL3ZlcnNpb25cIilcblxuVmlydHVhbFBhdGNoLk5PTkUgPSAwXG5WaXJ0dWFsUGF0Y2guVlRFWFQgPSAxXG5WaXJ0dWFsUGF0Y2guVk5PREUgPSAyXG5WaXJ0dWFsUGF0Y2guV0lER0VUID0gM1xuVmlydHVhbFBhdGNoLlBST1BTID0gNFxuVmlydHVhbFBhdGNoLk9SREVSID0gNVxuVmlydHVhbFBhdGNoLklOU0VSVCA9IDZcblZpcnR1YWxQYXRjaC5SRU1PVkUgPSA3XG5WaXJ0dWFsUGF0Y2guVEhVTksgPSA4XG5cbm1vZHVsZS5leHBvcnRzID0gVmlydHVhbFBhdGNoXG5cbmZ1bmN0aW9uIFZpcnR1YWxQYXRjaCh0eXBlLCB2Tm9kZSwgcGF0Y2gpIHtcbiAgICB0aGlzLnR5cGUgPSBOdW1iZXIodHlwZSlcbiAgICB0aGlzLnZOb2RlID0gdk5vZGVcbiAgICB0aGlzLnBhdGNoID0gcGF0Y2hcbn1cblxuVmlydHVhbFBhdGNoLnByb3RvdHlwZS52ZXJzaW9uID0gdmVyc2lvblxuVmlydHVhbFBhdGNoLnByb3RvdHlwZS50eXBlID0gXCJWaXJ0dWFsUGF0Y2hcIlxuIiwidmFyIHZlcnNpb24gPSByZXF1aXJlKFwiLi92ZXJzaW9uXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gVmlydHVhbFRleHRcblxuZnVuY3Rpb24gVmlydHVhbFRleHQodGV4dCkge1xuICAgIHRoaXMudGV4dCA9IFN0cmluZyh0ZXh0KVxufVxuXG5WaXJ0dWFsVGV4dC5wcm90b3R5cGUudmVyc2lvbiA9IHZlcnNpb25cblZpcnR1YWxUZXh0LnByb3RvdHlwZS50eXBlID0gXCJWaXJ0dWFsVGV4dFwiXG4iLCJ2YXIgaXNPYmplY3QgPSByZXF1aXJlKFwiaXMtb2JqZWN0XCIpXG52YXIgaXNIb29rID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXZob29rXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZGlmZlByb3BzXG5cbmZ1bmN0aW9uIGRpZmZQcm9wcyhhLCBiKSB7XG4gICAgdmFyIGRpZmZcblxuICAgIGZvciAodmFyIGFLZXkgaW4gYSkge1xuICAgICAgICBpZiAoIShhS2V5IGluIGIpKSB7XG4gICAgICAgICAgICBkaWZmID0gZGlmZiB8fCB7fVxuICAgICAgICAgICAgZGlmZlthS2V5XSA9IHVuZGVmaW5lZFxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGFWYWx1ZSA9IGFbYUtleV1cbiAgICAgICAgdmFyIGJWYWx1ZSA9IGJbYUtleV1cblxuICAgICAgICBpZiAoYVZhbHVlID09PSBiVmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH0gZWxzZSBpZiAoaXNPYmplY3QoYVZhbHVlKSAmJiBpc09iamVjdChiVmFsdWUpKSB7XG4gICAgICAgICAgICBpZiAoZ2V0UHJvdG90eXBlKGJWYWx1ZSkgIT09IGdldFByb3RvdHlwZShhVmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgZGlmZiA9IGRpZmYgfHwge31cbiAgICAgICAgICAgICAgICBkaWZmW2FLZXldID0gYlZhbHVlXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlzSG9vayhiVmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgIGRpZmYgPSBkaWZmIHx8IHt9XG4gICAgICAgICAgICAgICAgIGRpZmZbYUtleV0gPSBiVmFsdWVcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG9iamVjdERpZmYgPSBkaWZmUHJvcHMoYVZhbHVlLCBiVmFsdWUpXG4gICAgICAgICAgICAgICAgaWYgKG9iamVjdERpZmYpIHtcbiAgICAgICAgICAgICAgICAgICAgZGlmZiA9IGRpZmYgfHwge31cbiAgICAgICAgICAgICAgICAgICAgZGlmZlthS2V5XSA9IG9iamVjdERpZmZcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkaWZmID0gZGlmZiB8fCB7fVxuICAgICAgICAgICAgZGlmZlthS2V5XSA9IGJWYWx1ZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgYktleSBpbiBiKSB7XG4gICAgICAgIGlmICghKGJLZXkgaW4gYSkpIHtcbiAgICAgICAgICAgIGRpZmYgPSBkaWZmIHx8IHt9XG4gICAgICAgICAgICBkaWZmW2JLZXldID0gYltiS2V5XVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGRpZmZcbn1cblxuZnVuY3Rpb24gZ2V0UHJvdG90eXBlKHZhbHVlKSB7XG4gIGlmIChPYmplY3QuZ2V0UHJvdG90eXBlT2YpIHtcbiAgICByZXR1cm4gT2JqZWN0LmdldFByb3RvdHlwZU9mKHZhbHVlKVxuICB9IGVsc2UgaWYgKHZhbHVlLl9fcHJvdG9fXykge1xuICAgIHJldHVybiB2YWx1ZS5fX3Byb3RvX19cbiAgfSBlbHNlIGlmICh2YWx1ZS5jb25zdHJ1Y3Rvcikge1xuICAgIHJldHVybiB2YWx1ZS5jb25zdHJ1Y3Rvci5wcm90b3R5cGVcbiAgfVxufVxuIiwidmFyIGlzQXJyYXkgPSByZXF1aXJlKFwieC1pcy1hcnJheVwiKVxuXG52YXIgVlBhdGNoID0gcmVxdWlyZShcIi4uL3Zub2RlL3ZwYXRjaFwiKVxudmFyIGlzVk5vZGUgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtdm5vZGVcIilcbnZhciBpc1ZUZXh0ID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXZ0ZXh0XCIpXG52YXIgaXNXaWRnZXQgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtd2lkZ2V0XCIpXG52YXIgaXNUaHVuayA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy10aHVua1wiKVxudmFyIGhhbmRsZVRodW5rID0gcmVxdWlyZShcIi4uL3Zub2RlL2hhbmRsZS10aHVua1wiKVxuXG52YXIgZGlmZlByb3BzID0gcmVxdWlyZShcIi4vZGlmZi1wcm9wc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGRpZmZcblxuZnVuY3Rpb24gZGlmZihhLCBiKSB7XG4gICAgdmFyIHBhdGNoID0geyBhOiBhIH1cbiAgICB3YWxrKGEsIGIsIHBhdGNoLCAwKVxuICAgIHJldHVybiBwYXRjaFxufVxuXG5mdW5jdGlvbiB3YWxrKGEsIGIsIHBhdGNoLCBpbmRleCkge1xuICAgIGlmIChhID09PSBiKSB7XG4gICAgICAgIHJldHVyblxuICAgIH1cblxuICAgIHZhciBhcHBseSA9IHBhdGNoW2luZGV4XVxuICAgIHZhciBhcHBseUNsZWFyID0gZmFsc2VcblxuICAgIGlmIChpc1RodW5rKGEpIHx8IGlzVGh1bmsoYikpIHtcbiAgICAgICAgdGh1bmtzKGEsIGIsIHBhdGNoLCBpbmRleClcbiAgICB9IGVsc2UgaWYgKGIgPT0gbnVsbCkge1xuXG4gICAgICAgIC8vIElmIGEgaXMgYSB3aWRnZXQgd2Ugd2lsbCBhZGQgYSByZW1vdmUgcGF0Y2ggZm9yIGl0XG4gICAgICAgIC8vIE90aGVyd2lzZSBhbnkgY2hpbGQgd2lkZ2V0cy9ob29rcyBtdXN0IGJlIGRlc3Ryb3llZC5cbiAgICAgICAgLy8gVGhpcyBwcmV2ZW50cyBhZGRpbmcgdHdvIHJlbW92ZSBwYXRjaGVzIGZvciBhIHdpZGdldC5cbiAgICAgICAgaWYgKCFpc1dpZGdldChhKSkge1xuICAgICAgICAgICAgY2xlYXJTdGF0ZShhLCBwYXRjaCwgaW5kZXgpXG4gICAgICAgICAgICBhcHBseSA9IHBhdGNoW2luZGV4XVxuICAgICAgICB9XG5cbiAgICAgICAgYXBwbHkgPSBhcHBlbmRQYXRjaChhcHBseSwgbmV3IFZQYXRjaChWUGF0Y2guUkVNT1ZFLCBhLCBiKSlcbiAgICB9IGVsc2UgaWYgKGlzVk5vZGUoYikpIHtcbiAgICAgICAgaWYgKGlzVk5vZGUoYSkpIHtcbiAgICAgICAgICAgIGlmIChhLnRhZ05hbWUgPT09IGIudGFnTmFtZSAmJlxuICAgICAgICAgICAgICAgIGEubmFtZXNwYWNlID09PSBiLm5hbWVzcGFjZSAmJlxuICAgICAgICAgICAgICAgIGEua2V5ID09PSBiLmtleSkge1xuICAgICAgICAgICAgICAgIHZhciBwcm9wc1BhdGNoID0gZGlmZlByb3BzKGEucHJvcGVydGllcywgYi5wcm9wZXJ0aWVzKVxuICAgICAgICAgICAgICAgIGlmIChwcm9wc1BhdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXcgVlBhdGNoKFZQYXRjaC5QUk9QUywgYSwgcHJvcHNQYXRjaCkpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGFwcGx5ID0gZGlmZkNoaWxkcmVuKGEsIGIsIHBhdGNoLCBhcHBseSwgaW5kZXgpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLlZOT0RFLCBhLCBiKSlcbiAgICAgICAgICAgICAgICBhcHBseUNsZWFyID0gdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXBwbHkgPSBhcHBlbmRQYXRjaChhcHBseSwgbmV3IFZQYXRjaChWUGF0Y2guVk5PREUsIGEsIGIpKVxuICAgICAgICAgICAgYXBwbHlDbGVhciA9IHRydWVcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNWVGV4dChiKSkge1xuICAgICAgICBpZiAoIWlzVlRleHQoYSkpIHtcbiAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLlZURVhULCBhLCBiKSlcbiAgICAgICAgICAgIGFwcGx5Q2xlYXIgPSB0cnVlXG4gICAgICAgIH0gZWxzZSBpZiAoYS50ZXh0ICE9PSBiLnRleHQpIHtcbiAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLlZURVhULCBhLCBiKSlcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNXaWRnZXQoYikpIHtcbiAgICAgICAgaWYgKCFpc1dpZGdldChhKSkge1xuICAgICAgICAgICAgYXBwbHlDbGVhciA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFZQYXRjaC5XSURHRVQsIGEsIGIpKVxuICAgIH1cblxuICAgIGlmIChhcHBseSkge1xuICAgICAgICBwYXRjaFtpbmRleF0gPSBhcHBseVxuICAgIH1cblxuICAgIGlmIChhcHBseUNsZWFyKSB7XG4gICAgICAgIGNsZWFyU3RhdGUoYSwgcGF0Y2gsIGluZGV4KVxuICAgIH1cbn1cblxuZnVuY3Rpb24gZGlmZkNoaWxkcmVuKGEsIGIsIHBhdGNoLCBhcHBseSwgaW5kZXgpIHtcbiAgICB2YXIgYUNoaWxkcmVuID0gYS5jaGlsZHJlblxuICAgIHZhciBiQ2hpbGRyZW4gPSByZW9yZGVyKGFDaGlsZHJlbiwgYi5jaGlsZHJlbilcblxuICAgIHZhciBhTGVuID0gYUNoaWxkcmVuLmxlbmd0aFxuICAgIHZhciBiTGVuID0gYkNoaWxkcmVuLmxlbmd0aFxuICAgIHZhciBsZW4gPSBhTGVuID4gYkxlbiA/IGFMZW4gOiBiTGVuXG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIHZhciBsZWZ0Tm9kZSA9IGFDaGlsZHJlbltpXVxuICAgICAgICB2YXIgcmlnaHROb2RlID0gYkNoaWxkcmVuW2ldXG4gICAgICAgIGluZGV4ICs9IDFcblxuICAgICAgICBpZiAoIWxlZnROb2RlKSB7XG4gICAgICAgICAgICBpZiAocmlnaHROb2RlKSB7XG4gICAgICAgICAgICAgICAgLy8gRXhjZXNzIG5vZGVzIGluIGIgbmVlZCB0byBiZSBhZGRlZFxuICAgICAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBWUGF0Y2goVlBhdGNoLklOU0VSVCwgbnVsbCwgcmlnaHROb2RlKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHdhbGsobGVmdE5vZGUsIHJpZ2h0Tm9kZSwgcGF0Y2gsIGluZGV4KVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzVk5vZGUobGVmdE5vZGUpICYmIGxlZnROb2RlLmNvdW50KSB7XG4gICAgICAgICAgICBpbmRleCArPSBsZWZ0Tm9kZS5jb3VudFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGJDaGlsZHJlbi5tb3Zlcykge1xuICAgICAgICAvLyBSZW9yZGVyIG5vZGVzIGxhc3RcbiAgICAgICAgYXBwbHkgPSBhcHBlbmRQYXRjaChhcHBseSwgbmV3IFZQYXRjaChWUGF0Y2guT1JERVIsIGEsIGJDaGlsZHJlbi5tb3ZlcykpXG4gICAgfVxuXG4gICAgcmV0dXJuIGFwcGx5XG59XG5cbmZ1bmN0aW9uIGNsZWFyU3RhdGUodk5vZGUsIHBhdGNoLCBpbmRleCkge1xuICAgIC8vIFRPRE86IE1ha2UgdGhpcyBhIHNpbmdsZSB3YWxrLCBub3QgdHdvXG4gICAgdW5ob29rKHZOb2RlLCBwYXRjaCwgaW5kZXgpXG4gICAgZGVzdHJveVdpZGdldHModk5vZGUsIHBhdGNoLCBpbmRleClcbn1cblxuLy8gUGF0Y2ggcmVjb3JkcyBmb3IgYWxsIGRlc3Ryb3llZCB3aWRnZXRzIG11c3QgYmUgYWRkZWQgYmVjYXVzZSB3ZSBuZWVkXG4vLyBhIERPTSBub2RlIHJlZmVyZW5jZSBmb3IgdGhlIGRlc3Ryb3kgZnVuY3Rpb25cbmZ1bmN0aW9uIGRlc3Ryb3lXaWRnZXRzKHZOb2RlLCBwYXRjaCwgaW5kZXgpIHtcbiAgICBpZiAoaXNXaWRnZXQodk5vZGUpKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygdk5vZGUuZGVzdHJveSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBwYXRjaFtpbmRleF0gPSBhcHBlbmRQYXRjaChcbiAgICAgICAgICAgICAgICBwYXRjaFtpbmRleF0sXG4gICAgICAgICAgICAgICAgbmV3IFZQYXRjaChWUGF0Y2guUkVNT1ZFLCB2Tm9kZSwgbnVsbClcbiAgICAgICAgICAgIClcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNWTm9kZSh2Tm9kZSkgJiYgKHZOb2RlLmhhc1dpZGdldHMgfHwgdk5vZGUuaGFzVGh1bmtzKSkge1xuICAgICAgICB2YXIgY2hpbGRyZW4gPSB2Tm9kZS5jaGlsZHJlblxuICAgICAgICB2YXIgbGVuID0gY2hpbGRyZW4ubGVuZ3RoXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW2ldXG4gICAgICAgICAgICBpbmRleCArPSAxXG5cbiAgICAgICAgICAgIGRlc3Ryb3lXaWRnZXRzKGNoaWxkLCBwYXRjaCwgaW5kZXgpXG5cbiAgICAgICAgICAgIGlmIChpc1ZOb2RlKGNoaWxkKSAmJiBjaGlsZC5jb3VudCkge1xuICAgICAgICAgICAgICAgIGluZGV4ICs9IGNoaWxkLmNvdW50XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzVGh1bmsodk5vZGUpKSB7XG4gICAgICAgIHRodW5rcyh2Tm9kZSwgbnVsbCwgcGF0Y2gsIGluZGV4KVxuICAgIH1cbn1cblxuLy8gQ3JlYXRlIGEgc3ViLXBhdGNoIGZvciB0aHVua3NcbmZ1bmN0aW9uIHRodW5rcyhhLCBiLCBwYXRjaCwgaW5kZXgpIHtcbiAgICB2YXIgbm9kZXMgPSBoYW5kbGVUaHVuayhhLCBiKTtcbiAgICB2YXIgdGh1bmtQYXRjaCA9IGRpZmYobm9kZXMuYSwgbm9kZXMuYilcbiAgICBpZiAoaGFzUGF0Y2hlcyh0aHVua1BhdGNoKSkge1xuICAgICAgICBwYXRjaFtpbmRleF0gPSBuZXcgVlBhdGNoKFZQYXRjaC5USFVOSywgbnVsbCwgdGh1bmtQYXRjaClcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGhhc1BhdGNoZXMocGF0Y2gpIHtcbiAgICBmb3IgKHZhciBpbmRleCBpbiBwYXRjaCkge1xuICAgICAgICBpZiAoaW5kZXggIT09IFwiYVwiKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuLy8gRXhlY3V0ZSBob29rcyB3aGVuIHR3byBub2RlcyBhcmUgaWRlbnRpY2FsXG5mdW5jdGlvbiB1bmhvb2sodk5vZGUsIHBhdGNoLCBpbmRleCkge1xuICAgIGlmIChpc1ZOb2RlKHZOb2RlKSkge1xuICAgICAgICBpZiAodk5vZGUuaG9va3MpIHtcbiAgICAgICAgICAgIHBhdGNoW2luZGV4XSA9IGFwcGVuZFBhdGNoKFxuICAgICAgICAgICAgICAgIHBhdGNoW2luZGV4XSxcbiAgICAgICAgICAgICAgICBuZXcgVlBhdGNoKFxuICAgICAgICAgICAgICAgICAgICBWUGF0Y2guUFJPUFMsXG4gICAgICAgICAgICAgICAgICAgIHZOb2RlLFxuICAgICAgICAgICAgICAgICAgICB1bmRlZmluZWRLZXlzKHZOb2RlLmhvb2tzKVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgIClcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2Tm9kZS5kZXNjZW5kYW50SG9va3MgfHwgdk5vZGUuaGFzVGh1bmtzKSB7XG4gICAgICAgICAgICB2YXIgY2hpbGRyZW4gPSB2Tm9kZS5jaGlsZHJlblxuICAgICAgICAgICAgdmFyIGxlbiA9IGNoaWxkcmVuLmxlbmd0aFxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW2ldXG4gICAgICAgICAgICAgICAgaW5kZXggKz0gMVxuXG4gICAgICAgICAgICAgICAgdW5ob29rKGNoaWxkLCBwYXRjaCwgaW5kZXgpXG5cbiAgICAgICAgICAgICAgICBpZiAoaXNWTm9kZShjaGlsZCkgJiYgY2hpbGQuY291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXggKz0gY2hpbGQuY291bnRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzVGh1bmsodk5vZGUpKSB7XG4gICAgICAgIHRodW5rcyh2Tm9kZSwgbnVsbCwgcGF0Y2gsIGluZGV4KVxuICAgIH1cbn1cblxuZnVuY3Rpb24gdW5kZWZpbmVkS2V5cyhvYmopIHtcbiAgICB2YXIgcmVzdWx0ID0ge31cblxuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgICAgcmVzdWx0W2tleV0gPSB1bmRlZmluZWRcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0XG59XG5cbi8vIExpc3QgZGlmZiwgbmFpdmUgbGVmdCB0byByaWdodCByZW9yZGVyaW5nXG5mdW5jdGlvbiByZW9yZGVyKGFDaGlsZHJlbiwgYkNoaWxkcmVuKSB7XG5cbiAgICB2YXIgYktleXMgPSBrZXlJbmRleChiQ2hpbGRyZW4pXG5cbiAgICBpZiAoIWJLZXlzKSB7XG4gICAgICAgIHJldHVybiBiQ2hpbGRyZW5cbiAgICB9XG5cbiAgICB2YXIgYUtleXMgPSBrZXlJbmRleChhQ2hpbGRyZW4pXG5cbiAgICBpZiAoIWFLZXlzKSB7XG4gICAgICAgIHJldHVybiBiQ2hpbGRyZW5cbiAgICB9XG5cbiAgICB2YXIgYk1hdGNoID0ge30sIGFNYXRjaCA9IHt9XG5cbiAgICBmb3IgKHZhciBhS2V5IGluIGJLZXlzKSB7XG4gICAgICAgIGJNYXRjaFtiS2V5c1thS2V5XV0gPSBhS2V5c1thS2V5XVxuICAgIH1cblxuICAgIGZvciAodmFyIGJLZXkgaW4gYUtleXMpIHtcbiAgICAgICAgYU1hdGNoW2FLZXlzW2JLZXldXSA9IGJLZXlzW2JLZXldXG4gICAgfVxuXG4gICAgdmFyIGFMZW4gPSBhQ2hpbGRyZW4ubGVuZ3RoXG4gICAgdmFyIGJMZW4gPSBiQ2hpbGRyZW4ubGVuZ3RoXG4gICAgdmFyIGxlbiA9IGFMZW4gPiBiTGVuID8gYUxlbiA6IGJMZW5cbiAgICB2YXIgc2h1ZmZsZSA9IFtdXG4gICAgdmFyIGZyZWVJbmRleCA9IDBcbiAgICB2YXIgaSA9IDBcbiAgICB2YXIgbW92ZUluZGV4ID0gMFxuICAgIHZhciBtb3ZlcyA9IHt9XG4gICAgdmFyIHJlbW92ZXMgPSBtb3Zlcy5yZW1vdmVzID0ge31cbiAgICB2YXIgcmV2ZXJzZSA9IG1vdmVzLnJldmVyc2UgPSB7fVxuICAgIHZhciBoYXNNb3ZlcyA9IGZhbHNlXG5cbiAgICB3aGlsZSAoZnJlZUluZGV4IDwgbGVuKSB7XG4gICAgICAgIHZhciBtb3ZlID0gYU1hdGNoW2ldXG4gICAgICAgIGlmIChtb3ZlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNodWZmbGVbaV0gPSBiQ2hpbGRyZW5bbW92ZV1cbiAgICAgICAgICAgIGlmIChtb3ZlICE9PSBtb3ZlSW5kZXgpIHtcbiAgICAgICAgICAgICAgICBtb3Zlc1ttb3ZlXSA9IG1vdmVJbmRleFxuICAgICAgICAgICAgICAgIHJldmVyc2VbbW92ZUluZGV4XSA9IG1vdmVcbiAgICAgICAgICAgICAgICBoYXNNb3ZlcyA9IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1vdmVJbmRleCsrXG4gICAgICAgIH0gZWxzZSBpZiAoaSBpbiBhTWF0Y2gpIHtcbiAgICAgICAgICAgIHNodWZmbGVbaV0gPSB1bmRlZmluZWRcbiAgICAgICAgICAgIHJlbW92ZXNbaV0gPSBtb3ZlSW5kZXgrK1xuICAgICAgICAgICAgaGFzTW92ZXMgPSB0cnVlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB3aGlsZSAoYk1hdGNoW2ZyZWVJbmRleF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGZyZWVJbmRleCsrXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmcmVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgICAgICB2YXIgZnJlZUNoaWxkID0gYkNoaWxkcmVuW2ZyZWVJbmRleF1cbiAgICAgICAgICAgICAgICBpZiAoZnJlZUNoaWxkKSB7XG4gICAgICAgICAgICAgICAgICAgIHNodWZmbGVbaV0gPSBmcmVlQ2hpbGRcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZyZWVJbmRleCAhPT0gbW92ZUluZGV4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYXNNb3ZlcyA9IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vdmVzW2ZyZWVJbmRleF0gPSBtb3ZlSW5kZXhcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldmVyc2VbbW92ZUluZGV4XSA9IGZyZWVJbmRleFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIG1vdmVJbmRleCsrXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZyZWVJbmRleCsrXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaSsrXG4gICAgfVxuXG4gICAgaWYgKGhhc01vdmVzKSB7XG4gICAgICAgIHNodWZmbGUubW92ZXMgPSBtb3Zlc1xuICAgIH1cblxuICAgIHJldHVybiBzaHVmZmxlXG59XG5cbmZ1bmN0aW9uIGtleUluZGV4KGNoaWxkcmVuKSB7XG4gICAgdmFyIGksIGtleXNcblxuICAgIGZvciAoaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltpXVxuXG4gICAgICAgIGlmIChjaGlsZC5rZXkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAga2V5cyA9IGtleXMgfHwge31cbiAgICAgICAgICAgIGtleXNbY2hpbGQua2V5XSA9IGlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBrZXlzXG59XG5cbmZ1bmN0aW9uIGFwcGVuZFBhdGNoKGFwcGx5LCBwYXRjaCkge1xuICAgIGlmIChhcHBseSkge1xuICAgICAgICBpZiAoaXNBcnJheShhcHBseSkpIHtcbiAgICAgICAgICAgIGFwcGx5LnB1c2gocGF0Y2gpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcHBseSA9IFthcHBseSwgcGF0Y2hdXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXBwbHlcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcGF0Y2hcbiAgICB9XG59XG4iLCJ2YXIgbmF0aXZlSXNBcnJheSA9IEFycmF5LmlzQXJyYXlcbnZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmdcblxubW9kdWxlLmV4cG9ydHMgPSBuYXRpdmVJc0FycmF5IHx8IGlzQXJyYXlcblxuZnVuY3Rpb24gaXNBcnJheShvYmopIHtcbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChvYmopID09PSBcIltvYmplY3QgQXJyYXldXCJcbn1cbiJdfQ==
