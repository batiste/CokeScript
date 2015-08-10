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
  }, LAMBDA: {rules: [
    "fd:function_def open_par params:FUNC_DEF_PARAMS? close_par W block:EXPR",
    "fd:function_def W fn:name open_par params:FUNC_DEF_PARAMS? close_par W block:EXPR",
    "fd:function_def W block:EXPR"
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
      return name + ': ' + generateCode(node.children.e);
    } else {
      return name + ': true';
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
    
    str += '\n' + sp() + CN() + '.push(virtualDom.h("' + name + '", {attributes: ' + params + '}, ' + sub + '))';
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

module.exports = {
  grammar: gram, strGrammar: strGram, grammarDef: grammarDef, epegjs: epegjs, tokenDef: tokenDef, generateModule: generateModule, generateCode: generateCode, generateExports: generateExports
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb2tlc2NyaXB0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUR4OEJBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBlcGVnanMsIGRlcHRoLCBmb3JMb29wQ291bnQsIHVucGFja2luZywgbmFtZXNwYWNlcywgbGV2ZWxTdGFjaywgcHJlZml4LCB0b2tlbkRlZiwgc3RySW50ZXJwb2xhdGlvblRva2VuRGVmLCBzdHJJbnRlcnBvbGF0aW9uR3JhbW1hckRlZiwgc3RyR3JhbSwgZ3JhbW1hckRlZiwgbmMsIGJhY2tlbmQsIGdyYW07XG4vLyBDb2tlU2NyaXB0IGxhbmd1YWdlIGJ5IEJhdGlzdGUgQmllbGVyIDIwMTVcbi8vIEltcGxlbWVudGVkIHVzaW5nIEVQRUcuSlNcblxuZXBlZ2pzID0gcmVxdWlyZShcImVwZWdqc1wiKTtcblxuZGVwdGggPSAwO1xuZm9yTG9vcENvdW50ID0gMTtcbnVucGFja2luZyA9IDA7XG5uYW1lc3BhY2VzID0gW3t9XTtcbmxldmVsU3RhY2sgPSBbMF07XG5wcmVmaXggPSAnX18nO1xuXG5mdW5jdGlvbiBjdXJyZW50TnMoKSB7XG4gIHJldHVybiBuYW1lc3BhY2VzW25hbWVzcGFjZXMubGVuZ3RoIC0gMV07XG59XG5cbmZ1bmN0aW9uIGN1cnJlbnROc0hhcyhwKSB7XG4gIHJldHVybiBuYW1lc3BhY2VzW25hbWVzcGFjZXMubGVuZ3RoIC0gMV0uaGFzT3duUHJvcGVydHkocCk7XG59XG5cbmZ1bmN0aW9uIG5ld05zKCkge1xuICBuYW1lc3BhY2VzLnB1c2goe30pO1xuICByZXR1cm4gbmFtZXNwYWNlc1tuYW1lc3BhY2VzLmxlbmd0aCAtIDFdO1xufVxuXG5mdW5jdGlvbiByZXNldEdsb2JhbCgpIHtcbiAgbmFtZXNwYWNlcyA9IFt7fV07XG4gIGZvckxvb3BDb3VudCA9IDE7XG4gIGxldmVsU3RhY2sgPSBbMF07XG4gIGRlcHRoID0gMDtcbiAgdW5wYWNraW5nID0gMDtcbn1cblxuLy8gdG9rZW4gYXJlIG1hdGNoZWQgaW4gb3JkZXIgb2YgZGVjbGFyYXRpb247XG4vLyBUT0RPOiBhZGQgZnVuY3Rpb25zXG5cbnRva2VuRGVmID0gW1xuICB7a2V5OiBcInN0cmluZ1wiLCBmdW5jOiBzdHJpbmdEZWZ9LFxuICB7a2V5OiBcImNvbW1lbnRcIiwgZnVuYzogY29tbWVudERlZn0sXG4gIHtrZXk6IFwiZnVuY3Rpb25fZGVmXCIsIGZ1bmM6IGRlZkRlZiwgdmVyYm9zZTogXCJmdW5jdGlvblwifSxcbiAge2tleTogXCJjbGFzc1wiLCByZWc6IC9eY2xhc3MgL30sXG4gIHtrZXk6IFwicmV0XCIsIHJlZzogL15yZXR1cm4vLCB2ZXJib3NlOiBcInJldHVyblwifSxcbiAge2tleTogXCJpZlwiLCByZWc6IC9eaWYgL30sXG4gIHtrZXk6IFwib3JcIiwgcmVnOiAvXm9yIC99LFxuICB7a2V5OiBcImFuZFwiLCByZWc6IC9eYW5kIC99LFxuICB7a2V5OiBcIndoaWxlXCIsIHJlZzogL153aGlsZSAvfSxcbiAge2tleTogXCJpbnN0YW5jZW9mXCIsIHJlZzogL15pbnN0YW5jZW9mIC99LFxuICB7a2V5OiBcInRyeVwiLCByZWc6IC9edHJ5L30sXG4gIHtrZXk6IFwiY2F0Y2hcIiwgcmVnOiAvXmNhdGNoL30sXG4gIHtrZXk6IFwidGhyb3dcIiwgcmVnOiAvXnRocm93IC99LFxuICB7a2V5OiBcInBhenpcIiwgcmVnOiAvXnBhc3MvLCB2ZXJib3NlOiBcInBhc3NcIn0sXG4gIHtrZXk6IFwibmV3XCIsIHJlZzogL15uZXcgL30sXG4gIHtrZXk6IFwidGFnXCIsIHJlZzogL148W2EtekEtWl1bMC05YS16QS1aXXswLDI5fS99LFxuICB7a2V5OiBcIj5cIiwgcmVnOiAvXj4vfSxcbiAge2tleTogXCJlbHNlaWZcIiwgcmVnOiAvXmVsc2VpZiAvfSxcbiAge2tleTogXCJlbHNlXCIsIHJlZzogL15lbHNlL30sXG4gIHtrZXk6IFwiZm9yX2xvb3BcIiwgcmVnOiAvXmZvciAvLCB2ZXJib3NlOiBcImZvciBsb29wXCJ9LFxuICB7a2V5OiBcImluXCIsIHJlZzogL15pbiAvfSxcbiAge2tleTogXCJub3RcIiwgcmVnOiAvXm5vdCAvLCB2ZXJib3NlOiBcIm5vdFwifSxcbiAge2tleTogXCJuYW1lXCIsIHJlZzogL15bYS16QS1aXyRdWzAtOWEtekEtWl8kXXswLDI5fS99LFxuICB7a2V5OiBcInJlZ2V4cFwiLCBmdW5jOiByZWdFeHBEZWYsIHZlcmJvc2U6IFwicmVndWxhciBleHByZXNzaW9uXCJ9LFxuICB7a2V5OiBcIm1hdGhfb3BlcmF0b3JzXCIsIHJlZzogL14oXFwrXFwrfFxcLVxcLSkvLCB2ZXJib3NlOiBcIm1hdGggb3BlcmF0b3JcIn0sXG4gIHtrZXk6IFwiYmluYXJ5X29wZXJhdG9yc1wiLCByZWc6IC9eKFxcJlxcJnxcXHxcXHx8XFwmfFxcfHw8PHxcXD5cXD4pLywgdmVyYm9zZTogXCJiaW5hcnkgb3BlcmF0b3JcIn0sXG4gIHtrZXk6IFwiY29tcGFyaXNvblwiLCByZWc6IC9eKDw9fD49fDx8PnwhPXw9PSkvfSxcbiAge2tleTogXCJhc3NpZ25cIiwgcmVnOiAvXihcXCs9fC09fD18Oj0pL30sXG4gIHtrZXk6IFwibnVtYmVyXCIsIHJlZzogL15bLV0/WzAtOV0rXFwuP1swLTldKi99LFxuICB7a2V5OiBcImNvbW1hXCIsIHJlZzogL15cXCwvfSxcbiAge2tleTogXCJkb3RcIiwgcmVnOiAvXlxcLi99LFxuICB7a2V5OiBcImNvbG9uXCIsIHJlZzogL15cXDovLCB2ZXJib3NlOiBcIjpcIn0sXG4gIHtrZXk6IFwib3Blbl9wYXJcIiwgcmVnOiAvXlxcKC8sIHZlcmJvc2U6IFwiKFwifSxcbiAge2tleTogXCJjbG9zZV9wYXJcIiwgcmVnOiAvXlxcKS8sIHZlcmJvc2U6IFwiKVwifSxcbiAge2tleTogXCJvcGVuX2JyYVwiLCByZWc6IC9eXFxbLywgdmVyYm9zZTogXCJbXCJ9LFxuICB7a2V5OiBcImNsb3NlX2JyYVwiLCByZWc6IC9eXFxdLywgdmVyYm9zZTogXCJdXCJ9LFxuICB7a2V5OiBcIm9wZW5fY3VybHlcIiwgcmVnOiAvXlxcey8sIHZlcmJvc2U6IFwie1wifSxcbiAge2tleTogXCJjbG9zZV9jdXJseVwiLCByZWc6IC9eXFx9LywgdmVyYm9zZTogXCJ9XCJ9LFxuICB7a2V5OiBcIm1hdGhcIiwgcmVnOiAvXlstfFxcK3xcXCp8XFwvfCVdL30sXG4gIHtrZXk6IFwic2FtZWRlbnRcIiwgZnVuYzogZGVudChcInNhbWVkZW50XCIpLCB2ZXJib3NlOiBcInNhbWUgaW5kZW50YXRpb25cIn0sXG4gIHtrZXk6IFwiZGVkZW50XCIsIGZ1bmM6IGRlbnQoXCJkZWRlbnRcIil9LFxuICB7a2V5OiBcImluZGVudFwiLCBmdW5jOiBkZW50KFwiaW5kZW50XCIpfSxcbiAge2tleTogXCJXXCIsIHJlZzogL15bIF0vLCB2ZXJib3NlOiBcInNpbmdsZSB3aGl0ZXNwYWNlXCJ9XG5dO1xuXG5mdW5jdGlvbiBzdGFydFN0cihpbnB1dCxzdHJlYW0pIHtcbiAgdmFyIGxhc3Q7XG4gIGxhc3QgPSBzdHJlYW1bc3RyZWFtLmxlbmd0aCAtIDFdO1xuICBpZihsYXN0ICYmIGxhc3QudmFsdWUgPT09IFwiXFxcXFwiKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmKGlucHV0Lm1hdGNoKC9eI3svKSkge1xuICAgIHJldHVybiBcIiN7XCI7XG4gIH1cbn1cblxuc3RySW50ZXJwb2xhdGlvblRva2VuRGVmID0gW1xuICB7a2V5OiBcInN0YXJ0XCIsIGZ1bmM6IHN0YXJ0U3RyfSxcbiAge2tleTogXCJlbmRcIiwgcmVnOiAvXn0vfSxcbiAge2tleTogXCJuYW1lXCIsIHJlZzogL15bYS16QS1aXyRdWzAtOWEtekEtWl9dezAsMjl9L30sXG4gIHtrZXk6IFwiZG90XCIsIHJlZzogL15cXC4vfSxcbiAge2tleTogXCJjaGFyXCIsIHJlZzogL14uL31cbl07XG5cbnN0ckludGVycG9sYXRpb25HcmFtbWFyRGVmID0ge1xuICBTVEFSVDoge3J1bGVzOiBbXCJFTCogRU9GXCJdfSwgRUw6IHtydWxlczogW1wiVkFSXCIsIFwiY2hhclwiLCBcIm5hbWVcIiwgXCJzdGFydFwiLCBcImVuZFwiLCBcImRvdFwiXX0sIFZBUjoge3J1bGVzOiBbXCJzdGFydCBOQU1FIGVuZFwiXX0sIE5BTUU6IHtydWxlczogW1wibmFtZSBkb3QgTkFNRVwiLCBcIm5hbWVcIl19XG59O1xuXG5zdHJHcmFtID0gZXBlZ2pzLmNvbXBpbGVHcmFtbWFyKHN0ckludGVycG9sYXRpb25HcmFtbWFyRGVmLCBzdHJJbnRlcnBvbGF0aW9uVG9rZW5EZWYpO1xuXG5mdW5jdGlvbiBnZW5lcmF0ZVN0cmluZ0NvZGUobm9kZSxjKSB7XG4gIHZhciBzdHIsIF9faW5kZXgxLCBfX2tleXMxLCBjaGlsZDtcbiAgaWYobm9kZS50eXBlID09PSAnVkFSJykge1xuICAgIHJldHVybiBjICsgJyArICcgKyBnZW5lcmF0ZVN0cmluZ0NvZGUobm9kZS5jaGlsZHJlblsxXSwgYykgKyAnICsgJyArIGM7XG4gIH1cbiAgXG4gIGlmKG5vZGUudmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9XG4gIFxuICBzdHIgPSAnJztcbiAgaWYoIW5vZGUuY2hpbGRyZW4pIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgXG4gIF9fa2V5czEgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgZm9yKF9faW5kZXgxID0gMDsgX19pbmRleDEgPCBfX2tleXMxLmxlbmd0aDsgX19pbmRleDErKykge1xuICAgIGNoaWxkID0gbm9kZS5jaGlsZHJlbltfX2tleXMxW19faW5kZXgxXV07XG4gICAgc3RyICs9IGdlbmVyYXRlU3RyaW5nQ29kZShjaGlsZCwgYyk7XG4gIH1cbiAgcmV0dXJuIHN0cjtcbn1cblxuZnVuY3Rpb24gY3VycmVudExldmVsKCkge1xuICByZXR1cm4gbGV2ZWxTdGFja1tsZXZlbFN0YWNrLmxlbmd0aCAtIDFdO1xufVxuXG5mdW5jdGlvbiBpbmRlbnRUeXBlKGwpIHtcbiAgaWYobCA+IGN1cnJlbnRMZXZlbCgpKSB7XG4gICAgcmV0dXJuICdpbmRlbnQnO1xuICB9XG4gIFxuICBpZihsIDwgY3VycmVudExldmVsKCkpIHtcbiAgICByZXR1cm4gJ2RlZGVudCc7XG4gIH1cbiAgXG4gIGlmKGwgPT09IGN1cnJlbnRMZXZlbCgpKSB7XG4gICAgcmV0dXJuICdzYW1lZGVudCc7XG4gIH1cbn1cblxuZnVuY3Rpb24gZGVudChkZW50VHlwZSkge1xuICByZXR1cm4gZnVuY3Rpb24gX2RlbnQoaW5wdXQpIHtcbiAgICB2YXIgbSwgbGluZXMsIGluZGVudDtcbiAgICAvLyBlbXB0eSBsaW5lIGlzIGEgc2FtZWRlbnRcbiAgICBtID0gaW5wdXQubWF0Y2goL15cXG5bXFxzXSovKTtcbiAgICBpZihtKSB7XG4gICAgICBsaW5lcyA9IG1bMF0uc3BsaXQoXCJcXG5cIik7XG4gICAgICBpbmRlbnQgPSBsaW5lc1tsaW5lcy5sZW5ndGggLSAxXS5sZW5ndGg7XG4gICAgICBpZihpbmRlbnRUeXBlKGluZGVudCkgPT09IGRlbnRUeXBlKSB7XG4gICAgICAgIGlmKGRlbnRUeXBlID09PSAnZGVkZW50Jykge1xuICAgICAgICAgIGxldmVsU3RhY2sucG9wKCk7XG4gICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZihkZW50VHlwZSA9PT0gJ2luZGVudCcpIHtcbiAgICAgICAgICBsZXZlbFN0YWNrLnB1c2goaW5kZW50KTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIG1bMF07XG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuXG5mdW5jdGlvbiBzdHJpbmdEZWYoaW5wdXQpIHtcbiAgdmFyIGZpcnN0LCBpLCBjaDtcbiAgZmlyc3QgPSBpbnB1dC5jaGFyQXQoMCk7XG4gIGlmKGZpcnN0ID09PSAnXCInIHx8IGZpcnN0ID09PSBcIidcIikge1xuICAgIGkgPSAxO1xuICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSl7XG4gICAgICBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxcXCcpIHtcbiAgICAgICAgaSsrO1xuICAgICAgfSBlbHNlIGlmKGNoID09PSBmaXJzdCkge1xuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSArIDEpO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiByZWdFeHBEZWYoaW5wdXQpIHtcbiAgdmFyIGksIGNoO1xuICBpZihpbnB1dC5jaGFyQXQoMCkgPT09ICcvJykge1xuICAgIGkgPSAxO1xuICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSl7XG4gICAgICBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxcXCcpIHtcbiAgICAgICAgaSsrO1xuICAgICAgfSBlbHNlIGlmKGNoID09PSAnLycpIHtcbiAgICAgICAgaSsrO1xuICAgICAgICAvLyBtb2RpZmllcnNcbiAgICAgICAgd2hpbGUoaW5wdXQuY2hhckF0KGkpICYmIFwiaWdtXCIuaW5kZXhPZihpbnB1dC5jaGFyQXQoaSkpICE9PSAtMSl7XG4gICAgICAgICAgaSsrO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpbnB1dC5zbGljZSgwLCBpKTtcbiAgICAgIH1cbiAgICAgIGkrKztcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZGVmRGVmKGlucHV0KSB7XG4gIGlmKGlucHV0Lm1hdGNoKC9eZGVmW1xcKHwgfFxcbl0vKSkge1xuICAgIHJldHVybiBcImRlZlwiO1xuICB9XG4gIFxuICBpZihpbnB1dC5pbmRleE9mKFwiZG9tIFwiKSA9PT0gMCkge1xuICAgIHJldHVybiBcImRvbVwiO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbW1lbnREZWYoaW5wdXQpIHtcbiAgdmFyIG0sIGksIGNoO1xuICBtID0gaW5wdXQubWF0Y2goL14jLyk7XG4gIGlmKG0pIHtcbiAgICBpID0gbVswXS5sZW5ndGg7XG4gICAgd2hpbGUoaW5wdXQuY2hhckF0KGkpKXtcbiAgICAgIGNoID0gaW5wdXQuY2hhckF0KGkpO1xuICAgICAgaWYoY2ggPT09ICdcXG4nKSB7XG4gICAgICAgIHJldHVybiBpbnB1dC5zbGljZSgwLCBpKTtcbiAgICAgIH1cbiAgICAgIGkrKztcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVmbGVjdChwYXJhbXMpIHsgcmV0dXJuIHBhcmFtczsgfVxuXG5ncmFtbWFyRGVmID0ge1xuICBTVEFSVDoge3J1bGVzOiBbXCJMSU5FKiBFT0ZcIl19LCBFTEM6IHtydWxlczogW1wiVyogY29tbWVudFwiXSwgdmVyYm9zZTogXCJjb21tZW50XCJ9LCBMSU5FOiB7cnVsZXM6IFtcIlNUQVRFTUVOVCBFTEM/IHNhbWVkZW50K1wiLCBcIlNUQVRFTUVOVCBFTEM/ICFkZWRlbnRcIiwgXG4gICAgXCJFTEM/IHNhbWVkZW50XCIsIFwiRUxDICFkZWRlbnRcIl0sIHZlcmJvc2U6IFwibmV3IGxpbmVcIn0sIEJMT0NLOiB7cnVsZXM6IFtcImluZGVudCBwYXp6IGRlZGVudFwiLCBcImluZGVudCBMSU5FKyBkZWRlbnRcIl19LCBTVEFURU1FTlQ6IHtydWxlczogW1wiQVNTSUdOXCIsIFwiRVhQUlwiLCBcIklGXCIsIFwiV0hJTEVcIiwgXCJGT1JcIiwgXCJSRVRVUk5cIiwgXG4gICAgXCJDTEFTU1wiLCBcIlRBR1wiLCBcIkRPTV9BU1NJR05cIiwgXCJUUllfQ0FUQ0hcIiwgXCJUSFJPV1wiXX0sIENMQVNTX01FVEhPRFM6IHtcbiAgICBydWxlczogW1wic2FtZWRlbnQqIGY6RlVOQ19ERUYgc2FtZWRlbnQqXCJdLCBob29rczogZnVuY3Rpb24gKHApIHsgcmV0dXJuIHAuZjsgfVxuICB9LCBDTEFTUzoge1xuICAgIHJ1bGVzOiBbXG4gICAgICBcImNsYXNzIG46bmFtZSBvcGVuX3BhciBwOm5hbWUgY2xvc2VfcGFyIGluZGVudCBtOkNMQVNTX01FVEhPRFMrIGRlZGVudFwiLFxuICAgICAgXCJjbGFzcyBuOm5hbWUgaW5kZW50IG06Q0xBU1NfTUVUSE9EUysgZGVkZW50XCJcbiAgICBdLCBob29rczogW1xuICAgICAgZnVuY3Rpb24gKHApIHsgcmV0dXJuIHtuYW1lOiBwLm4sIG1ldGhvZHM6IHAubSwgcGFyZW50OiBwLnB9OyB9LFxuICAgICAgZnVuY3Rpb24gKHApIHsgcmV0dXJuIHtuYW1lOiBwLm4sIG1ldGhvZHM6IHAubX07IH1cbiAgICBdXG4gIH0sIEZVTkNfREVGX1BBUkFNUzoge3J1bGVzOiBbXG4gICAgXCJwMTpGVU5DX0RFRl9QQVJBTVMgY29tbWEgVyBwMjpGVU5DX0RFRl9QQVJBTVNcIixcbiAgICBcInAxOm5hbWUgYXNzaWduIGU6RVhQUlwiLFxuICAgIFwicDE6bmFtZVwiXG4gICAgXSwgdmVyYm9zZTogXCJkZWYgcGFyYW1ldGVyc1wiXG4gIH0sIExBTUJEQToge3J1bGVzOiBbXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIFcgYmxvY2s6RVhQUlwiLFxuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBvcGVuX3BhciBwYXJhbXM6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgVyBibG9jazpFWFBSXCIsXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgVyBibG9jazpFWFBSXCJcbiAgICBdLCBob29rczogcmVmbGVjdFxuICB9LCBGVU5DX0RFRjoge3J1bGVzOiBbXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIGJsb2NrOkJMT0NLXCIsXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgVyBmbjpuYW1lIG9wZW5fcGFyIHBhcmFtczpGVU5DX0RFRl9QQVJBTVM/IGNsb3NlX3BhciBibG9jazpCTE9DS1wiLFxuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBibG9jazpCTE9DS1wiLFxuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIGJsb2NrOkJMT0NLXCJcbiAgICBdLCBob29rczogcmVmbGVjdCwgdmVyYm9zZTogXCJkZWYgZGVmaW5pdGlvblwiXG4gIH0sIEVMU0VfSUY6IHtydWxlczogW1wic2FtZWRlbnQgZWxzZWlmIGU6RVhQUiBiOkJMT0NLXCJdLCBob29rczogcmVmbGVjdH0sIEVMU0U6IHtydWxlczogW1wic2FtZWRlbnQgZWxzZSBiOkJMT0NLXCJdLCBob29rczogcmVmbGVjdH0sIElGOiB7cnVsZXM6IFtcImlmIGU6RVhQUiBiOkJMT0NLIGVsaWY6RUxTRV9JRiogZWw6RUxTRT9cIl0sIGhvb2tzOiByZWZsZWN0fSwgRUxTRV9FWFBSOiB7cnVsZXM6IFtcIlcgZWxzZSBXIGI6RVhQUlwiXSwgaG9va3M6IHJlZmxlY3R9LCBJRl9FWFBSOiB7cnVsZXM6IFtcImU6RVhQUiBXIGlmIHRlc3Q6RVhQUiBlbDpFTFNFX0VYUFI/XCJdLCBob29rczogcmVmbGVjdH0sIFdISUxFOiB7cnVsZXM6IFtcIndoaWxlIGU6RVhQUiBiOkJMT0NLXCJdLCBob29rczogcmVmbGVjdH0sIE1BVEg6IHtydWxlczogW1wiZTE6RVhQUiBXIG9wOm1hdGggVyBlMjpFWFBSXCJdfSwgUEFUSDoge3J1bGVzOiBbXCJQQVRIIGRvdCBuYW1lXCIsIFwiUEFUSCBvcGVuX2JyYSBudW1iZXIgY2xvc2VfYnJhXCIsIFwibmFtZVwiXX0sIEFTU0lHTjoge3J1bGVzOiBbXG4gICAgXCJsZWZ0Ok9CSkVDVCBXIG9wOmFzc2lnbiBXIHJpZ2h0OkVYUFJcIixcbiAgICBcImxlZnQ6RVhQUiBXIG9wOmFzc2lnbiBXIHJpZ2h0OkVYUFJcIixcbiAgICBcImxlZnQ6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSIFcgb3A6YXNzaWduIFcgcmlnaHQ6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSXCIsXG4gICAgXCJsZWZ0OlNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUiBXIG9wOmFzc2lnbiBXIHJpZ2h0OkVYUFJcIlxuICBdLCBob29rczogcmVmbGVjdH0sIFdfT1JfU0FNRURFTlQ6IHtydWxlczogW1wiV1wiLCBcInNhbWVkZW50XCJdLCB2ZXJib3NlOiBcInNhbWVkZW50IG9yIHdoaXRlc3BhY2VcIn0sIFdfU0FNRURFTlRfSU5ERU5UOiB7cnVsZXM6IFtcIldcIiwgXCJzYW1lZGVudFwiLCBcImluZGVudFwiXSwgdmVyYm9zZTogXCJpbmRlbnQgb3Igc2FtZWRlbnQgb3Igd2hpdGVzcGFjZVwifSwgQU5ZX1NQQUNFOiB7cnVsZXM6IFtcIldcIiwgXCJzYW1lZGVudFwiLCBcImluZGVudFwiLCBcImRlZGVudFwiLCBcImNvbW1lbnRcIl0sIHZlcmJvc2U6IFwiYW55IHNwYWNlXCJ9LCBGVU5DX0NBTExfUEFSQU1TOiB7cnVsZXM6IFtcIkVYUFIgY29tbWEgQU5ZX1NQQUNFKyBGVU5DX0NBTExfUEFSQU1TIEFOWV9TUEFDRSpcIiwgXCJFWFBSIEFOWV9TUEFDRSpcIl19LCBGVU5DX0NBTEw6IHtydWxlczogW1xuICAgIFwib3Blbl9wYXIgRlVOQ19DQUxMX1BBUkFNUz8gY2xvc2VfcGFyXCJcbiAgXX0sIFRZUEU6IHtydWxlczogW1wibmFtZSBjb2xvblwiXX0sIEZPUjoge3J1bGVzOiBbXG4gICAgXCJmb3JfbG9vcCBrOm5hbWUgY29tbWEgVyB2Om5hbWUgVyBpbiBhOkVYUFIgYjpCTE9DS1wiLFxuICAgIFwiZm9yX2xvb3AgdjpuYW1lIFcgaW4gYTpFWFBSIGI6QkxPQ0tcIl0sIGhvb2tzOiByZWZsZWN0XG4gIH0sIFNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUjoge3J1bGVzOiBbXG4gICAgXCJlMTpFWFBSIGNvbW1hIFcgZTI6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSXCIsXG4gICAgXCJlMTpFWFBSIGNvbW1hIFcgZTI6RVhQUlwiXG4gIF0sIGhvb2tzOiBbXG4gICAgZnVuY3Rpb24gKHApIHsgcmV0dXJuIFtwLmUxXS5jb25jYXQocC5lMi5jaGlsZHJlbik7IH0sIGZ1bmN0aW9uIChwKSB7IHJldHVybiBbcC5lMSwgcC5lMl07IH1cbiAgXSBcbiAgfSwgQ09NTUFfU0VQQVJBVEVEX0VYUFI6IHtydWxlczogW1xuICAgIFwiRVhQUiBjb21tYSBBTllfU1BBQ0UrIENPTU1BX1NFUEFSQVRFRF9FWFBSIEFOWV9TUEFDRSpcIixcbiAgICBcIkVYUFIgQU5ZX1NQQUNFKlwiXG4gIF19LCBBUlJBWToge3J1bGVzOiBbXG4gICAgXCJvcGVuX2JyYSBBTllfU1BBQ0UqIGM6Q09NTUFfU0VQQVJBVEVEX0VYUFI/IEFOWV9TUEFDRSogY2xvc2VfYnJhXCJcbiAgXX0sIE1FTUJFUlM6IHtydWxlczogW1xuICAgIFwibmFtZTpuYW1lIGNvbG9uIFcgdmFsdWU6RVhQUiBzYW1lOnNhbWVkZW50PyBjb21tYSBhbnk6QU5ZX1NQQUNFKyBtOk1FTUJFUlMgc3BhY2U6QU5ZX1NQQUNFKlwiLFxuICAgIFwibmFtZTpuYW1lIGNvbG9uIFcgdmFsdWU6RVhQUiBzcGFjZTpBTllfU1BBQ0UqXCJcbiAgXSwgaG9va3M6IFtcbiAgICBmdW5jdGlvbiAocCkgeyByZXR1cm4gW3BdLmNvbmNhdChwLm0uY2hpbGRyZW4pOyB9LCBmdW5jdGlvbiAocCkgeyByZXR1cm4gW3BdOyB9XG4gIF1cbiAgfSwgT0JKRUNUOiB7cnVsZXM6IFtcbiAgICBcIm9wZW5fY3VybHkgaW5kZW50PyBNRU1CRVJTPyBjbG9zZV9jdXJseVwiXG4gIF19LCBUQUdfUEFSQU1TOiB7cnVsZXM6IFtcbiAgICBcImxlZnQ6VEFHX1BBUkFNUyBXIHJpZ2h0OlRBR19QQVJBTVNcIixcbiAgICBcIm46bmFtZSBhc3NpZ24gZTpFWFBSXCIsXG4gICAgXCJuOm5hbWVcIlxuICAgIF0sIGhvb2tzOiByZWZsZWN0LCB2ZXJib3NlOiBcInRhZyBwYXJhbWV0ZXJzXCJcbiAgfSwgVEFHOiB7cnVsZXM6IFtcbiAgICBcInRhZzp0YWcgVz8gcGFyYW1zOlRBR19QQVJBTVM/IGVuZDo+PyBibG9jazpCTE9DSz9cIlxuICBdLCBob29rczogcmVmbGVjdFxuICB9LCBET01fQVNTSUdOOiB7cnVsZXM6IFtcbiAgICBcImFzc2lnbiBFWFBSXCJcbiAgXX0sIFRSWV9DQVRDSDoge3J1bGVzOiBbXG4gICAgXCJ0cnkgYjE6QkxPQ0sgc2FtZWRlbnQ/IGNhdGNoIG9wZW5fcGFyIGVycjpuYW1lPyBjbG9zZV9wYXIgYjI6QkxPQ0tcIlxuICAgIF0sIGhvb2tzOiByZWZsZWN0XG4gIH0sIFRIUk9XOiB7cnVsZXM6IFtcbiAgICBcInRocm93IEVYUFJcIlxuICBdfSwgUkVUVVJOOiB7cnVsZXM6IFtcInJldCBXIFNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUlwiLCBcInJldCBXIEVYUFJcIiwgXCJyZXRcIl19LCBSSUdIVF9FWFBSOiB7cnVsZXM6IFtcbiAgICBcIm1hdGhfb3BlcmF0b3JzXCIsXG4gICAgXCJXIGJpbmFyeV9vcGVyYXRvcnMgVyBFWFBSXCIsXG4gICAgXCJXIG9yIEVYUFJcIixcbiAgICBcIlcgYW5kIEVYUFJcIixcbiAgICBcIlcgY29tcGFyaXNvbiBXIEVYUFJcIixcbiAgICBcIlcgPiBXIEVYUFJcIixcbiAgICBcImRvdCBFWFBSXCIsXG4gICAgXCJXIGluc3RhbmNlb2YgRVhQUlwiLFxuICAgIFwib3Blbl9icmEgRVhQUiBjbG9zZV9icmFcIixcbiAgICBcIkZVTkNfQ0FMTFwiXG4gICAgXSwgdmVyYm9zZTogXCJleHByZXNzaW9uXCJcbiAgfSwgRVhQUjoge3J1bGVzOiBbXG4gICAgXCJJRl9FWFBSXCIsXG4gICAgXCJNQVRIXCIsXG4gICAgXCJPQkpFQ1RcIixcbiAgICBcIkZVTkNfREVGXCIsXG4gICAgXCJFWFBSIFJJR0hUX0VYUFJcIixcbiAgICBcIm5hbWVcIixcbiAgICBcIm51bWJlclwiLFxuICAgIFwiTEFNQkRBXCIsXG4gICAgXCJzdHJpbmdcIixcbiAgICBcInJlZ2V4cFwiLFxuICAgIFwib3Blbl9wYXIgRVhQUiBjbG9zZV9wYXJcIixcbiAgICBcIm5ldyBFWFBSXCIsXG4gICAgXCJub3QgRVhQUlwiLFxuICAgIFwiQVJSQVlcIlxuICAgIF0sIHZlcmJvc2U6IFwiZXhwcmVzc2lvblwiXG4gIH1cbn07XG5cbmZ1bmN0aW9uIHNwYWNlcihuKSB7XG4gIHZhciBvdXQsIGk7XG4gIG91dCA9IFwiXCI7XG4gIGkgPSAwO1xuICB3aGlsZShpIDwgbil7XG4gICAgb3V0ICs9IFwiIFwiO1xuICAgIGkrKztcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiBzcChtb2QpIHtcbiAgaWYobW9kKSB7XG4gICAgcmV0dXJuIHNwYWNlcigyICogKGRlcHRoICsgbW9kKSk7XG4gIH1cbiAgcmV0dXJuIHNwYWNlcigyICogZGVwdGgpO1xufVxuXG5uYyA9IDE7XG5cbi8vIGNoaWxkcmVuIG5hbWVcbmZ1bmN0aW9uIENOKCkge1xuICByZXR1cm4gcHJlZml4ICsgJ2MnICsgbmM7XG59XG5cbmZ1bmN0aW9uIHB1c2hDTigpIHtcbiAgbmMrKztcbiAgcmV0dXJuIHByZWZpeCArICdjJyArIG5jO1xufVxuXG5mdW5jdGlvbiBwb3BDTigpIHtcbiAgbmMtLTtcbiAgcmV0dXJuIHByZWZpeCArICdjJyArIG5jO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZUhvaXN0ZWRWYXIoKSB7XG4gIHZhciBucywgaG9pc3RlZCwgX19pbmRleDIsIF9fa2V5czIsIGtleSwgdmFsdWU7XG4gIG5zID0gY3VycmVudE5zKCk7XG4gIGhvaXN0ZWQgPSBbXTtcbiAgX19rZXlzMiA9IE9iamVjdC5rZXlzKG5zKTtcbiAgZm9yKF9faW5kZXgyID0gMDsgX19pbmRleDIgPCBfX2tleXMyLmxlbmd0aDsgX19pbmRleDIrKykge1xuICAgIGtleSA9IF9fa2V5czJbX19pbmRleDJdO1xuICAgIHZhbHVlID0gbnNbX19rZXlzMltfX2luZGV4Ml1dO1xuICAgIGlmKHZhbHVlID09PSAnaG9pc3QnKSB7XG4gICAgICBob2lzdGVkLnB1c2goa2V5KTtcbiAgICB9XG4gIH1cbiAgaWYoaG9pc3RlZC5sZW5ndGgpIHtcbiAgICByZXR1cm4gJ3ZhciAnICsgaG9pc3RlZC5qb2luKCcsICcpICsgJzsnO1xuICB9XG4gIHJldHVybiAnJztcbn1cblxuZnVuY3Rpb24gaG9pc3RWYXIobmFtZSkge1xuICB2YXIgbnM7XG4gIG5zID0gY3VycmVudE5zKCk7XG4gIG5zW25hbWVdID0gJ2hvaXN0Jztcbn1cblxuYmFja2VuZCA9IHtcbiAgU1RBUlQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciwgX19pbmRleDMsIF9fa2V5czMsIGNoaWxkLCBob2lzdGVkO1xuICAgIHN0ciA9ICcnO1xuICAgIF9fa2V5czMgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgICBmb3IoX19pbmRleDMgPSAwOyBfX2luZGV4MyA8IF9fa2V5czMubGVuZ3RoOyBfX2luZGV4MysrKSB7XG4gICAgICBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX19rZXlzM1tfX2luZGV4M11dO1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShjaGlsZCk7XG4gICAgfVxuICAgIGhvaXN0ZWQgPSBnZW5lcmF0ZUhvaXN0ZWRWYXIoKTtcbiAgICBpZihob2lzdGVkKSB7XG4gICAgICByZXR1cm4gZ2VuZXJhdGVIb2lzdGVkVmFyKCkgKyAnXFxuJyArIHN0cjtcbiAgICB9XG4gICAgcmV0dXJuIHN0cjtcbiAgfSwgXG4gIGRlZGVudDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICBkZXB0aCA9IE1hdGgubWF4KDAsIGRlcHRoIC0gMSk7XG4gICAgcmV0dXJuICcnO1xuICB9LCBcbiAgaW5kZW50OiBmdW5jdGlvbiAobm9kZSkge1xuICAgIGRlcHRoID0gZGVwdGggKyAxO1xuICAgIHJldHVybiAnXFxuJyArIHNwKCk7XG4gIH0sIFxuICBzYW1lZGVudDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgbCwgaSwgc3RyO1xuICAgIGwgPSBub2RlLnZhbHVlLnNwbGl0KCdcXG4nKS5sZW5ndGggLSAxO1xuICAgIGkgPSAwO1xuICAgIHN0ciA9ICcnO1xuICAgIHdoaWxlKGkgPCBsKXtcbiAgICAgIHN0ciArPSAnXFxuJyArIHNwKCk7XG4gICAgICBpKys7XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG4gIH0sIFxuICBET01fQVNTSUdOOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBuYW1lLCB2YXJuYW1lLCBzdHI7XG4gICAgbmFtZSA9IENOKCk7XG4gICAgdmFybmFtZSA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzFdKTtcbiAgICBob2lzdFZhcihDTigpKTtcbiAgICBob2lzdFZhcignJyArIHByZWZpeCArICd0bXAnKTtcbiAgICBzdHIgPSAnJyArIHByZWZpeCArICd0bXAgPSAnICsgdmFybmFtZSArICc7ICcgKyBwcmVmaXggKyAndG1wIGluc3RhbmNlb2YgQXJyYXkgPyAoJyArIG5hbWUgKyAnID0gJyArIG5hbWUgKyAnLmNvbmNhdCgnICsgcHJlZml4ICsgJ3RtcCkpIDogJyArIG5hbWUgKyAnLnB1c2goU3RyaW5nKCcgKyBwcmVmaXggKyAndG1wKSknO1xuICAgIHJldHVybiBzdHI7XG4gIH0sIFxuICBUQUdfUEFSQU1TOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBuYW1lO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ubGVmdCkge1xuICAgICAgcmV0dXJuIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmxlZnQpICsgJywgJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnJpZ2h0KTtcbiAgICB9XG4gICAgXG4gICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4ubi52YWx1ZTtcbiAgICBcbiAgICBpZihub2RlLmNoaWxkcmVuLmUpIHtcbiAgICAgIHJldHVybiBuYW1lICsgJzogJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbmFtZSArICc6IHRydWUnO1xuICAgIH1cbiAgfSwgXG4gIFRBRzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyLCBwYXJhbXMsIG5hbWUsIHN1YiwgbnM7XG4gICAgc3RyID0gJyc7XG4gICAgcGFyYW1zID0gXCJ7XCI7XG4gICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4udGFnLnZhbHVlLnN1YnN0cmluZygxKTtcbiAgICBpZihub2RlLmNoaWxkcmVuLnBhcmFtcykge1xuICAgICAgcGFyYW1zICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnBhcmFtcyk7XG4gICAgfVxuICAgIFxuICAgIHBhcmFtcyArPSAnfSc7XG4gICAgc3ViID0gJ1tdJztcbiAgICBucyA9IGN1cnJlbnROcygpO1xuICAgIFxuICAgIGlmKG5vZGUuY2hpbGRyZW4uYmxvY2spIHtcbiAgICAgIHN1YiA9IHB1c2hDTigpO1xuICAgICAgc3RyICs9IENOKCkgKyAnID0gW107JztcbiAgICAgIGhvaXN0VmFyKENOKCkpO1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrKTtcbiAgICAgIHBvcENOKCk7XG4gICAgfVxuICAgIFxuICAgIHN0ciArPSAnXFxuJyArIHNwKCkgKyBDTigpICsgJy5wdXNoKHZpcnR1YWxEb20uaChcIicgKyBuYW1lICsgJ1wiLCB7YXR0cmlidXRlczogJyArIHBhcmFtcyArICd9LCAnICsgc3ViICsgJykpJztcbiAgICByZXR1cm4gc3RyO1xuICB9LCBcbiAgQ0xBU1M6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIG5hbWUsIGZ1bmNzLCBwYXJlbnQsIHN0ciwgY29uc3RydWN0b3IsIF9faW5kZXg0LCBfX2tleXM0LCBmdW5jLCBmdW5jX2RlZiwgZnVuY19uYW1lLCBucywgcGFyYW1zLCBib2R5LCBjb25zX3N0ciwgX19pbmRleDUsIF9fa2V5czUsIGtleSwgdmFsdWU7XG4gICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4ubmFtZS52YWx1ZTtcbiAgICBmdW5jcyA9IG5vZGUuY2hpbGRyZW4ubWV0aG9kcztcbiAgICBwYXJlbnQgPSBub2RlLmNoaWxkcmVuLnBhcmVudDtcbiAgICBzdHIgPSAnJztcbiAgICBjb25zdHJ1Y3RvciA9IG51bGw7XG4gICAgX19rZXlzNCA9IE9iamVjdC5rZXlzKGZ1bmNzKTtcbiAgICBmb3IoX19pbmRleDQgPSAwOyBfX2luZGV4NCA8IF9fa2V5czQubGVuZ3RoOyBfX2luZGV4NCsrKSB7XG4gICAgICBmdW5jID0gZnVuY3NbX19rZXlzNFtfX2luZGV4NF1dO1xuICAgICAgZnVuY19kZWYgPSBmdW5jLmNoaWxkcmVuO1xuICAgICAgZnVuY19uYW1lID0gZnVuY19kZWYuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICBpZihmdW5jX25hbWUgPT09ICdjb25zdHJ1Y3RvcicpIHtcbiAgICAgICAgY29uc3RydWN0b3IgPSBmdW5jX2RlZjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSAnXFxuJyArIHNwKCkgKyBuYW1lICsgJy5wcm90b3R5cGUuJyArIGZ1bmNfbmFtZSArICcgPSAnICsgZ2VuZXJhdGVDb2RlKGZ1bmNfZGVmKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgaG9pc3RWYXIobmFtZSk7XG4gICAgbnMgPSBuZXdOcygpO1xuICAgIFxuICAgIHBhcmFtcyA9IGNvbnN0cnVjdG9yICYmIGNvbnN0cnVjdG9yLmNoaWxkcmVuLnBhcmFtcztcbiAgICBpZihwYXJhbXMpIHtcbiAgICAgIHBhcmFtcyA9IGdlbmVyYXRlQ29kZShwYXJhbXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJhbXMgPSAnJztcbiAgICB9XG4gICAgXG4gICAgYm9keSA9IGNvbnN0cnVjdG9yICYmIGNvbnN0cnVjdG9yLmNoaWxkcmVuLmJsb2NrO1xuICAgIGNvbnNfc3RyID0gJycgKyBuYW1lICsgJyA9IGZ1bmN0aW9uICcgKyBuYW1lICsgJyAoICcgKyBwYXJhbXMgKyAnICkgeyc7XG4gICAgY29uc19zdHIgKz0gJ1xcbicgKyBzcCgxKSArICdpZighKHRoaXMgaW5zdGFuY2VvZiAnICsgbmFtZSArICcpKXsgcmV0dXJuIG5ldyAnICsgbmFtZSArICcoJyArIE9iamVjdC5rZXlzKG5zKS5qb2luKCcsJykgKyAnKX0nO1xuICAgIF9fa2V5czUgPSBPYmplY3Qua2V5cyhucyk7XG4gICAgZm9yKF9faW5kZXg1ID0gMDsgX19pbmRleDUgPCBfX2tleXM1Lmxlbmd0aDsgX19pbmRleDUrKykge1xuICAgICAga2V5ID0gX19rZXlzNVtfX2luZGV4NV07XG4gICAgICB2YWx1ZSA9IG5zW19fa2V5czVbX19pbmRleDVdXTtcbiAgICAgIGlmKHZhbHVlICE9PSB0cnVlICYmIHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc19zdHIgKz0gJ1xcbicgKyBzcCgxKSArICdpZignICsga2V5ICsgJyA9PT0gdW5kZWZpbmVkKSB7JyArIGtleSArICcgPSAnICsgZ2VuZXJhdGVDb2RlKHZhbHVlKSArICd9JztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYoYm9keSkge1xuICAgICAgY29uc19zdHIgKz0gZ2VuZXJhdGVDb2RlKGJvZHkpO1xuICAgIH1cbiAgICBjb25zX3N0ciArPSBzcCgpICsgJ1xcbn0nO1xuICAgIFxuICAgIGlmKHBhcmVudCkge1xuICAgICAgY29uc19zdHIgKz0gJ1xcbicgKyBzcCgpICsgJycgKyBuYW1lICsgJy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCcgKyBwYXJlbnQudmFsdWUgKyAnLnByb3RvdHlwZSknO1xuICAgICAgY29uc19zdHIgKz0gJ1xcbicgKyBzcCgpICsgJycgKyBuYW1lICsgJy5wcm90b3R5cGUuY29uc3RydWN0b3IgPSAnICsgbmFtZSArICcnO1xuICAgIH1cbiAgICBcbiAgICBuYW1lc3BhY2VzLnBvcCgpO1xuICAgIHJldHVybiBjb25zX3N0ciArIHN0cjtcbiAgfSwgXG4gIExBTUJEQTogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgbmFtZSwgbnMsIHN0ciwgX19pbmRleDYsIF9fa2V5czYsIGtleSwgdmFsdWUsIGNvZGU7XG4gICAgbmFtZSA9IFwiXCI7XG4gICAgbnMgPSBuZXdOcygpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uZm4pIHtcbiAgICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuLmZuLnZhbHVlO1xuICAgICAgbnNbbmFtZV0gPSB0cnVlO1xuICAgIH1cbiAgICBcbiAgICBzdHIgPSBcImZ1bmN0aW9uIFwiICsgbmFtZSArIFwiKFwiO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ucGFyYW1zKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucGFyYW1zLCBucyk7XG4gICAgfVxuICAgIFxuICAgIHN0ciArPSAnKSB7JztcbiAgICBfX2tleXM2ID0gT2JqZWN0LmtleXMobnMpO1xuICAgIGZvcihfX2luZGV4NiA9IDA7IF9faW5kZXg2IDwgX19rZXlzNi5sZW5ndGg7IF9faW5kZXg2KyspIHtcbiAgICAgIGtleSA9IF9fa2V5czZbX19pbmRleDZdO1xuICAgICAgdmFsdWUgPSBuc1tfX2tleXM2W19faW5kZXg2XV07XG4gICAgICBpZih2YWx1ZSAhPT0gdHJ1ZSAmJiB2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvZGUgPSBnZW5lcmF0ZUNvZGUodmFsdWUpO1xuICAgICAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArICdpZignICsga2V5ICsgJyA9PT0gdW5kZWZpbmVkKSB7JyArIGtleSArICcgPSAnICsgY29kZSArICd9JztcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgc3RyICs9ICcgcmV0dXJuICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5ibG9jaywgbnMpO1xuICAgIH1cbiAgICBcbiAgICBuYW1lc3BhY2VzLnBvcCgpO1xuICAgIHJldHVybiBzdHIgKyBcIjsgfVwiO1xuICB9LCBcbiAgRlVOQ19ERUY6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIG5hbWUsIG5zLCBpc19kb20sIHN0ciwgX19pbmRleDcsIF9fa2V5czcsIGtleSwgdmFsdWUsIGNvZGUsIGJvZHksIGhvaXN0ZWQ7XG4gICAgbmFtZSA9IFwiXCI7XG4gICAgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBpc19kb20gPSBub2RlLmNoaWxkcmVuLmZkLnZhbHVlID09PSAnZG9tJztcbiAgICBpZihub2RlLmNoaWxkcmVuLmZuKSB7XG4gICAgICBuYW1lID0gbm9kZS5jaGlsZHJlbi5mbi52YWx1ZTtcbiAgICAgIG5zW25hbWVdID0gdHJ1ZTtcbiAgICB9XG4gICAgXG4gICAgbnMgPSBuZXdOcygpO1xuICAgIHN0ciA9IFwiZnVuY3Rpb24gXCIgKyBuYW1lICsgXCIoXCI7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5wYXJhbXMpIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMpO1xuICAgIH1cbiAgICBcbiAgICBzdHIgKz0gJykgeyc7XG4gICAgX19rZXlzNyA9IE9iamVjdC5rZXlzKG5zKTtcbiAgICBmb3IoX19pbmRleDcgPSAwOyBfX2luZGV4NyA8IF9fa2V5czcubGVuZ3RoOyBfX2luZGV4NysrKSB7XG4gICAgICBrZXkgPSBfX2tleXM3W19faW5kZXg3XTtcbiAgICAgIHZhbHVlID0gbnNbX19rZXlzN1tfX2luZGV4N11dO1xuICAgICAgaWYodmFsdWUgIT09IHRydWUgJiYgdmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb2RlID0gZ2VuZXJhdGVDb2RlKHZhbHVlKTtcbiAgICAgICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyAnaWYoJyArIGtleSArICcgPT09IHVuZGVmaW5lZCkgeycgKyBrZXkgKyAnID0gJyArIGNvZGUgKyAnO30nO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBib2R5ID0gJyc7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgYm9keSA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrKTtcbiAgICB9XG4gICAgXG4gICAgaWYoaXNfZG9tKSB7XG4gICAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArICd2YXIgJyArIENOKCkgKyAnID0gW107JztcbiAgICB9XG4gICAgXG4gICAgaG9pc3RlZCA9IGdlbmVyYXRlSG9pc3RlZFZhcigpO1xuICAgIGlmKGhvaXN0ZWQpIHtcbiAgICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgaG9pc3RlZDtcbiAgICB9XG4gICAgXG4gICAgc3RyICs9IGJvZHk7XG4gICAgXG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICBcbiAgICBpZihpc19kb20pIHtcbiAgICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgJ3JldHVybiAnICsgQ04oKSArICc7JztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHN0ciArICdcXG4nICsgc3AoKSArICd9JztcbiAgfSwgXG4gIEZVTkNfREVGX1BBUkFNUzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyLCBucywgX19pbmRleDgsIF9fa2V5czgsIG47XG4gICAgc3RyID0gXCJcIjtcbiAgICBucyA9IGN1cnJlbnROcygpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW5bMF0udHlwZSA9PT0gJ25hbWUnKSB7XG4gICAgICBuc1tub2RlLmNoaWxkcmVuWzBdLnZhbHVlXSA9IHRydWU7XG4gICAgICBpZihub2RlLmNoaWxkcmVuWzFdICYmIG5vZGUuY2hpbGRyZW5bMV0udHlwZSA9PT0gJ2Fzc2lnbicpIHtcbiAgICAgICAgbnNbbm9kZS5jaGlsZHJlblswXS52YWx1ZV0gPSBub2RlLmNoaWxkcmVuWzJdO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBfX2tleXM4ID0gT2JqZWN0LmtleXMobm9kZS5jaGlsZHJlbik7XG4gICAgZm9yKF9faW5kZXg4ID0gMDsgX19pbmRleDggPCBfX2tleXM4Lmxlbmd0aDsgX19pbmRleDgrKykge1xuICAgICAgbiA9IG5vZGUuY2hpbGRyZW5bX19rZXlzOFtfX2luZGV4OF1dO1xuICAgICAgaWYobi50eXBlID09PSAnbmFtZScgfHwgbi50eXBlID09PSAnRlVOQ19ERUZfUEFSQU1TJyB8fCBuLnR5cGUgPT09ICdjb21tYScgfHwgbi50eXBlID09PSAnd2luZG93Jykge1xuICAgICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG4pO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc3RyO1xuICB9LCBcbiAgQVNTSUdOOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHIsIG9wLCBleHBsaWNpdF9nbG9iYWwsIG5zLCBsZWZ0LCByaWdodF9jb2RlLCB1bnBhY2tfbmFtZSwgaSwgX19pbmRleDksIF9fa2V5czksIGNoaWxkLCBuLCBtZW1iZXJzLCBfX2luZGV4MTAsIF9fa2V5czEwLCBtZW1iZXIsIG5hbWUsIHZhbHVlLCBfX2luZGV4MTEsIF9fa2V5czExLCBzLCBfX2luZGV4MTIsIF9fa2V5czEyLCBjaDtcbiAgICBzdHIgPSBcIlwiO1xuICAgIG9wID0gbm9kZS5jaGlsZHJlbi5vcC52YWx1ZTtcbiAgICBleHBsaWNpdF9nbG9iYWwgPSBvcCA9PT0gJzo9JztcbiAgICBpZihleHBsaWNpdF9nbG9iYWwpIHtcbiAgICAgIG9wID0gJz0nO1xuICAgIH1cbiAgICBcbiAgICBucyA9IGN1cnJlbnROcygpO1xuICAgIGxlZnQgPSBub2RlLmNoaWxkcmVuLmxlZnQ7XG4gICAgcmlnaHRfY29kZSA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnJpZ2h0KTtcbiAgICBcbiAgICAvLyBhc3NpZ25lbWVudCB1bnBhY2tpbmdcbiAgICBpZihsZWZ0LnR5cGUgPT09ICdTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFInKSB7XG4gICAgICB1bnBhY2tpbmcrKztcbiAgICAgIHVucGFja19uYW1lID0gJycgKyBwcmVmaXggKyAndW5wYWNrJyArIHVucGFja2luZyArICcnO1xuICAgICAgc3RyICs9ICd2YXIgJyArIHVucGFja19uYW1lICsgJyA9ICcgKyByaWdodF9jb2RlICsgJztcXG4nICsgc3AoKTtcbiAgICAgIGkgPSAwO1xuICAgICAgX19rZXlzOSA9IE9iamVjdC5rZXlzKGxlZnQuY2hpbGRyZW4pO1xuICAgICAgZm9yKF9faW5kZXg5ID0gMDsgX19pbmRleDkgPCBfX2tleXM5Lmxlbmd0aDsgX19pbmRleDkrKykge1xuICAgICAgICBjaGlsZCA9IGxlZnQuY2hpbGRyZW5bX19rZXlzOVtfX2luZGV4OV1dO1xuICAgICAgICBuID0gY2hpbGQuY2hpbGRyZW5bMF07XG4gICAgICAgIGlmKG4udHlwZSA9PT0gJ25hbWUnICYmIGNoaWxkLmNoaWxkcmVuLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIGhvaXN0VmFyKG4udmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoY2hpbGQpICsgJyAnICsgb3AgKyAnICcgKyB1bnBhY2tfbmFtZSArICdbJyArIGkgKyAnXSc7XG4gICAgICAgIGlmKGkgPCBsZWZ0LmNoaWxkcmVuLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICBzdHIgKz0gJztcXG4nICsgc3AoKTtcbiAgICAgICAgfVxuICAgICAgICBpKys7XG4gICAgICB9XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgICBcbiAgICAvLyBhc3NpZ25lbWVudCBtYXBwaW5nXG4gICAgaWYobGVmdC50eXBlID09PSAnT0JKRUNUJykge1xuICAgICAgdW5wYWNraW5nKys7XG4gICAgICB1bnBhY2tfbmFtZSA9ICcnICsgcHJlZml4ICsgJ3VucGFjaycgKyB1bnBhY2tpbmcgKyAnJztcbiAgICAgIHN0ciArPSAndmFyICcgKyB1bnBhY2tfbmFtZSArICcgPSAnICsgcmlnaHRfY29kZSArICc7XFxuJyArIHNwKCk7XG4gICAgICBpID0gMDtcbiAgICAgIG1lbWJlcnMgPSBsZWZ0LmNoaWxkcmVuWzFdLmNoaWxkcmVuO1xuICAgICAgX19rZXlzMTAgPSBPYmplY3Qua2V5cyhtZW1iZXJzKTtcbiAgICAgIGZvcihfX2luZGV4MTAgPSAwOyBfX2luZGV4MTAgPCBfX2tleXMxMC5sZW5ndGg7IF9faW5kZXgxMCsrKSB7XG4gICAgICAgIG1lbWJlciA9IG1lbWJlcnNbX19rZXlzMTBbX19pbmRleDEwXV07XG4gICAgICAgIG5hbWUgPSBnZW5lcmF0ZUNvZGUobWVtYmVyLm5hbWUpO1xuICAgICAgICB2YWx1ZSA9IGdlbmVyYXRlQ29kZShtZW1iZXIudmFsdWUpO1xuICAgICAgICBpZihtZW1iZXIuc2FtZWRlbnQpIHtcbiAgICAgICAgICBnZW5lcmF0ZUNvZGUobWVtYmVyLnNhbWVkZW50KTtcbiAgICAgICAgfVxuICAgICAgICBpZihtZW1iZXIuYW55KSB7XG4gICAgICAgICAgX19rZXlzMTEgPSBPYmplY3Qua2V5cyhtZW1iZXIuYW55KTtcbiAgICAgICAgICBmb3IoX19pbmRleDExID0gMDsgX19pbmRleDExIDwgX19rZXlzMTEubGVuZ3RoOyBfX2luZGV4MTErKykge1xuICAgICAgICAgICAgcyA9IG1lbWJlci5hbnlbX19rZXlzMTFbX19pbmRleDExXV07XG4gICAgICAgICAgICBnZW5lcmF0ZUNvZGUocyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmKG1lbWJlci5zcGFjZSkge1xuICAgICAgICAgIF9fa2V5czEyID0gT2JqZWN0LmtleXMobWVtYmVyLnNwYWNlKTtcbiAgICAgICAgICBmb3IoX19pbmRleDEyID0gMDsgX19pbmRleDEyIDwgX19rZXlzMTIubGVuZ3RoOyBfX2luZGV4MTIrKykge1xuICAgICAgICAgICAgcyA9IG1lbWJlci5zcGFjZVtfX2tleXMxMltfX2luZGV4MTJdXTtcbiAgICAgICAgICAgIGdlbmVyYXRlQ29kZShzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgc3RyICs9IFwiXCIgKyB2YWx1ZSArIFwiLlwiICsgbmFtZSArIFwiID0gXCIgKyB1bnBhY2tfbmFtZSArIFwiLlwiICsgbmFtZSArIFwiXCI7XG4gICAgICAgIGlmKGkgPCBtZW1iZXJzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICBzdHIgKz0gJztcXG4nICsgc3AoKTtcbiAgICAgICAgfVxuICAgICAgICBpKys7XG4gICAgICB9XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgICBcbiAgICBcbiAgICBpZihsZWZ0LmNoaWxkcmVuWzBdLnR5cGUgPT09ICduYW1lJykge1xuICAgICAgY2ggPSBsZWZ0LmNoaWxkcmVuWzBdO1xuICAgICAgaWYoIWN1cnJlbnROc0hhcyhjaC52YWx1ZSkpIHtcbiAgICAgICAgaWYoIWV4cGxpY2l0X2dsb2JhbCkge1xuICAgICAgICAgIGhvaXN0VmFyKGNoLnZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ubGVmdCkgKyAnICcgKyBvcCArICcgJyArIHJpZ2h0X2NvZGU7XG4gIH0sIFxuICBTVEFURU1FTlQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciwgX19pbmRleDEzLCBfX2tleXMxMywgY2hpbGQsIGUsIHQsIG90aGVyO1xuICAgIHN0ciA9ICcnO1xuICAgIF9fa2V5czEzID0gT2JqZWN0LmtleXMobm9kZS5jaGlsZHJlbik7XG4gICAgZm9yKF9faW5kZXgxMyA9IDA7IF9faW5kZXgxMyA8IF9fa2V5czEzLmxlbmd0aDsgX19pbmRleDEzKyspIHtcbiAgICAgIGNoaWxkID0gbm9kZS5jaGlsZHJlbltfX2tleXMxM1tfX2luZGV4MTNdXTtcbiAgICAgIGUgPSBjaGlsZC5jaGlsZHJlbiAmJiBjaGlsZC5jaGlsZHJlblswXTtcbiAgICAgIC8vIFRPRE86IHRoaXMgc2hvdWxkIGJlIHBvc3NpYmxlXG4gICAgICB0ID0gY2hpbGQudHlwZTtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoY2hpbGQpO1xuICAgICAgb3RoZXIgPSBlICYmIChlLnR5cGUgPT09ICdGVU5DX0RFRicgfHwgZS50eXBlID09PSAnTEFNQkRBJyk7XG4gICAgICBpZih0ID09PSAnRk9SJyB8fCB0ID09PSAnVFJZX0NBVENIJyB8fCB0ID09PSAnV0hJTEUnIHx8IHQgPT09ICdJRicgfHwgdCA9PT0gJ1NUQVRFTUVOVCcgfHwgdCA9PT0gJ3NhbWVkZW50JyB8fCBvdGhlcikge1xuICAgICAgICBcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSAnOyc7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzdHI7XG4gIH0sIFxuICBJRjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyLCBlbGlmLCBfX2luZGV4MTQsIF9fa2V5czE0LCB2YWx1ZTtcbiAgICBzdHIgPSAnJztcbiAgICBzdHIgPSAnaWYoJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJykgeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgICBlbGlmID0gbm9kZS5jaGlsZHJlbi5lbGlmO1xuICAgIGlmKGVsaWYpIHtcbiAgICAgIGlmKEFycmF5LmlzQXJyYXkoZWxpZikpIHtcbiAgICAgICAgX19rZXlzMTQgPSBPYmplY3Qua2V5cyhlbGlmKTtcbiAgICAgICAgZm9yKF9faW5kZXgxNCA9IDA7IF9faW5kZXgxNCA8IF9fa2V5czE0Lmxlbmd0aDsgX19pbmRleDE0KyspIHtcbiAgICAgICAgICB2YWx1ZSA9IGVsaWZbX19rZXlzMTRbX19pbmRleDE0XV07XG4gICAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZSh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoZWxpZik7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmKG5vZGUuY2hpbGRyZW4uZWwpIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lbCk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzdHI7XG4gIH0sIFxuICBJRl9FWFBSOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHI7XG4gICAgc3RyID0gJyc7XG4gICAgc3RyID0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4udGVzdCkgKyAnID8gJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJyA6ICc7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5lbCkge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmVsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyICs9ICd1bmRlZmluZWQnO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc3RyO1xuICB9LCBcbiAgRUxTRV9FWFBSOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKTtcbiAgfSwgXG4gIFdISUxFOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnd2hpbGUoJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJyl7JyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICB9LCBcbiAgRk9SOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBrZXlJbmRleE5hbWUsIGtleUFycmF5TmFtZSwgYXJyYXlOYW1lLCB2YXJOYW1lLCBpbmRleE5hbWUsIHN0cjtcbiAgICBrZXlJbmRleE5hbWUgPSBwcmVmaXggKyBcImluZGV4XCIgKyBmb3JMb29wQ291bnQ7XG4gICAga2V5QXJyYXlOYW1lID0gcHJlZml4ICsgXCJrZXlzXCIgKyBmb3JMb29wQ291bnQ7XG4gICAgaG9pc3RWYXIoa2V5SW5kZXhOYW1lKTtcbiAgICBob2lzdFZhcihrZXlBcnJheU5hbWUpO1xuICAgIFxuICAgIGFycmF5TmFtZSA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmEpO1xuICAgIHZhck5hbWUgPSBub2RlLmNoaWxkcmVuLnYudmFsdWU7XG4gICAgZm9yTG9vcENvdW50Kys7XG4gICAgaW5kZXhOYW1lID0gZmFsc2U7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5rKSB7XG4gICAgICBpbmRleE5hbWUgPSBub2RlLmNoaWxkcmVuLmsudmFsdWU7XG4gICAgfVxuICAgIFxuICAgIGlmKGluZGV4TmFtZSkge1xuICAgICAgaG9pc3RWYXIoaW5kZXhOYW1lKTtcbiAgICB9XG4gICAgaG9pc3RWYXIodmFyTmFtZSk7XG4gICAgXG4gICAgc3RyID0gJycgKyBrZXlBcnJheU5hbWUgKyAnID0gT2JqZWN0LmtleXMoJyArIGFycmF5TmFtZSArICcpO1xcbic7XG4gICAgc3RyICs9IHNwKCkgKyAnZm9yKCcgKyBrZXlJbmRleE5hbWUgKyAnID0gMDsgJyArIGtleUluZGV4TmFtZSArICcgPCAnICsga2V5QXJyYXlOYW1lICsgJy5sZW5ndGg7ICcgKyBrZXlJbmRleE5hbWUgKyAnKyspIHtcXG4nO1xuICAgIGlmKGluZGV4TmFtZSkge1xuICAgICAgc3RyICs9IHNwKDEpICsgJycgKyBpbmRleE5hbWUgKyAnID0gJyArIGtleUFycmF5TmFtZSArICdbJyArIGtleUluZGV4TmFtZSArICddO1xcbic7XG4gICAgfVxuICAgIFxuICAgIHN0ciArPSBzcCgxKSArICcnICsgdmFyTmFtZSArICcgPSAnICsgYXJyYXlOYW1lICsgJ1snICsga2V5QXJyYXlOYW1lICsgJ1snICsga2V5SW5kZXhOYW1lICsgJ11dOyc7XG4gICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICAgIHJldHVybiBzdHI7XG4gIH0sIFxuICBFTFNFX0lGOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnIGVsc2UgaWYoJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJykgeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgfSwgXG4gIEVMU0U6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuICcgZWxzZSB7JyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICB9LCBcbiAgVFJZX0NBVENIOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHI7XG4gICAgc3RyID0gXCJ0cnkge1wiO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iMSk7XG4gICAgc3RyICs9ICdcXG4nICsgc3AoKSArIFwifSBjYXRjaChcIiArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmVycikgKyBcIikge1wiO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iMik7XG4gICAgcmV0dXJuIHN0ciArICdcXG4nICsgc3AoKSArIFwifVwiO1xuICB9LCBcbiAgU1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBlbGVtZW50cywgX19pbmRleDE1LCBfX2tleXMxNSwgY2hpbGQ7XG4gICAgZWxlbWVudHMgPSBbXTtcbiAgICBfX2tleXMxNSA9IE9iamVjdC5rZXlzKG5vZGUuY2hpbGRyZW4pO1xuICAgIGZvcihfX2luZGV4MTUgPSAwOyBfX2luZGV4MTUgPCBfX2tleXMxNS5sZW5ndGg7IF9faW5kZXgxNSsrKSB7XG4gICAgICBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX19rZXlzMTVbX19pbmRleDE1XV07XG4gICAgICBlbGVtZW50cy5wdXNoKGdlbmVyYXRlQ29kZShjaGlsZCkpO1xuICAgIH1cbiAgICByZXR1cm4gJ1snICsgZWxlbWVudHMuam9pbihcIiwgXCIpICsgJ10nO1xuICB9LCBcbiAgTUVNQkVSUzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyLCBpLCBfX2luZGV4MTYsIF9fa2V5czE2LCBtZW1iZXIsIF9faW5kZXgxNywgX19rZXlzMTcsIHMsIF9faW5kZXgxOCwgX19rZXlzMTg7XG4gICAgc3RyID0gXCJcIjtcbiAgICBpID0gMDtcbiAgICBfX2tleXMxNiA9IE9iamVjdC5rZXlzKG5vZGUuY2hpbGRyZW4pO1xuICAgIGZvcihfX2luZGV4MTYgPSAwOyBfX2luZGV4MTYgPCBfX2tleXMxNi5sZW5ndGg7IF9faW5kZXgxNisrKSB7XG4gICAgICBtZW1iZXIgPSBub2RlLmNoaWxkcmVuW19fa2V5czE2W19faW5kZXgxNl1dO1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShtZW1iZXIubmFtZSkgKyAnOiAnICsgZ2VuZXJhdGVDb2RlKG1lbWJlci52YWx1ZSk7XG4gICAgICBpZihpIDwgbm9kZS5jaGlsZHJlbi5sZW5ndGggLSAxKSB7XG4gICAgICAgIHN0ciArPSAnLCAnO1xuICAgICAgfVxuICAgICAgaWYobWVtYmVyLnNhbWUpIHtcbiAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShtZW1iZXIuc2FtZSk7XG4gICAgICB9XG4gICAgICBpZihtZW1iZXIuYW55KSB7XG4gICAgICAgIF9fa2V5czE3ID0gT2JqZWN0LmtleXMobWVtYmVyLmFueSk7XG4gICAgICAgIGZvcihfX2luZGV4MTcgPSAwOyBfX2luZGV4MTcgPCBfX2tleXMxNy5sZW5ndGg7IF9faW5kZXgxNysrKSB7XG4gICAgICAgICAgcyA9IG1lbWJlci5hbnlbX19rZXlzMTdbX19pbmRleDE3XV07XG4gICAgICAgICAgZ2VuZXJhdGVDb2RlKHMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZihtZW1iZXIuc3BhY2UpIHtcbiAgICAgICAgX19rZXlzMTggPSBPYmplY3Qua2V5cyhtZW1iZXIuc3BhY2UpO1xuICAgICAgICBmb3IoX19pbmRleDE4ID0gMDsgX19pbmRleDE4IDwgX19rZXlzMTgubGVuZ3RoOyBfX2luZGV4MTgrKykge1xuICAgICAgICAgIHMgPSBtZW1iZXIuc3BhY2VbX19rZXlzMThbX19pbmRleDE4XV07XG4gICAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaSsrO1xuICAgIH1cbiAgICByZXR1cm4gc3RyO1xuICB9LCBcbiAgc3RyaW5nOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciB2LCBhc3Q7XG4gICAgdiA9IG5vZGUudmFsdWU7XG4gICAgdiA9IHYucmVwbGFjZSgvXFxuL2csIFwiXFxcXG5cIik7XG4gICAgYXN0ID0gc3RyR3JhbS5wYXJzZSh2KTtcbiAgICBpZighYXN0LmNvbXBsZXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYXN0LmhpbnQpO1xuICAgIH1cbiAgICByZXR1cm4gZ2VuZXJhdGVTdHJpbmdDb2RlKGFzdCwgdi5jaGFyQXQoMCkpO1xuICB9LCBcbiAgY29tbWVudDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZS5yZXBsYWNlKC9eIy9nLCBcIi8vXCIpO1xuICB9LCBcbiAgcGF6ejogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyc7XG4gIH0sIFxuICBub3Q6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuICchJztcbiAgfSwgXG4gIGFuZDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyYmICc7XG4gIH0sIFxuICBvcjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJ3x8ICc7XG4gIH0sIFxuICBjb21wYXJpc29uOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIGlmKG5vZGUudmFsdWUgPT09ICc9PScpIHtcbiAgICAgIHJldHVybiAnPT09JztcbiAgICB9XG4gICAgXG4gICAgaWYobm9kZS52YWx1ZSA9PT0gJyE9Jykge1xuICAgICAgcmV0dXJuICchPT0nO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgfVxufTtcblxuZnVuY3Rpb24gZ2VuZXJhdGVDb2RlKG5vZGUpIHtcbiAgdmFyIHN0ciwgX19pbmRleDE5LCBfX2tleXMxOSwgY2hpbGQ7XG4gIGlmKCFub2RlKSB7XG4gICAgLy8gZGVidWdnZXJcbiAgfVxuICBpZihiYWNrZW5kW25vZGUudHlwZV0pIHtcbiAgICByZXR1cm4gYmFja2VuZFtub2RlLnR5cGVdKG5vZGUpO1xuICB9XG4gIFxuICBpZihub2RlLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgfVxuICBcbiAgc3RyID0gXCJcIjtcbiAgaWYoIW5vZGUuY2hpbGRyZW4pIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgXG4gIF9fa2V5czE5ID0gT2JqZWN0LmtleXMobm9kZS5jaGlsZHJlbik7XG4gIGZvcihfX2luZGV4MTkgPSAwOyBfX2luZGV4MTkgPCBfX2tleXMxOS5sZW5ndGg7IF9faW5kZXgxOSsrKSB7XG4gICAgY2hpbGQgPSBub2RlLmNoaWxkcmVuW19fa2V5czE5W19faW5kZXgxOV1dO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoY2hpbGQpO1xuICB9XG4gIFxuICByZXR1cm4gc3RyO1xufVxuXG5cbmZ1bmN0aW9uIGdlbmVyYXRlRXhwb3J0cyhrZXlzKSB7XG4gIHZhciBzdHIsIF9faW5kZXgyMCwgX19rZXlzMjAsIGtleTtcbiAgc3RyID0gJ1xcbm1vZHVsZS5leHBvcnRzID0geyc7XG4gIGtleXMgPSBrZXlzIHx8IE9iamVjdC5rZXlzKGN1cnJlbnROcygpKTtcbiAgX19rZXlzMjAgPSBPYmplY3Qua2V5cyhrZXlzKTtcbiAgZm9yKF9faW5kZXgyMCA9IDA7IF9faW5kZXgyMCA8IF9fa2V5czIwLmxlbmd0aDsgX19pbmRleDIwKyspIHtcbiAgICBrZXkgPSBrZXlzW19fa2V5czIwW19faW5kZXgyMF1dO1xuICAgIHN0ciArPSAnXFxuICAnICsga2V5ICsgJyA6ICcgKyBrZXkgKyAnLCc7XG4gIH1cbiAgcmV0dXJuIHN0ciArICdcXG59Jztcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVNb2R1bGUoaW5wdXQsb3B0cykge1xuICB2YXIgYXN0LCBvYmo7XG4gIHJlc2V0R2xvYmFsKCk7XG4gIGFzdCA9IGdyYW0ucGFyc2UoaW5wdXQgKyBcIlxcblwiKTtcbiAgaWYoIWFzdC5jb21wbGV0ZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihhc3QuaGludCk7XG4gIH1cbiAgXG4gIG9iaiA9IHthc3Q6IGFzdCwgY29kZTogZ2VuZXJhdGVDb2RlKGFzdCksIG5zOiBjdXJyZW50TnMoKX07XG4gIHJldHVybiBvYmo7XG59XG5cblxuZ3JhbSA9IGVwZWdqcy5jb21waWxlR3JhbW1hcihncmFtbWFyRGVmLCB0b2tlbkRlZik7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBncmFtbWFyOiBncmFtLCBzdHJHcmFtbWFyOiBzdHJHcmFtLCBncmFtbWFyRGVmOiBncmFtbWFyRGVmLCBlcGVnanM6IGVwZWdqcywgdG9rZW5EZWY6IHRva2VuRGVmLCBnZW5lcmF0ZU1vZHVsZTogZ2VuZXJhdGVNb2R1bGUsIGdlbmVyYXRlQ29kZTogZ2VuZXJhdGVDb2RlLCBnZW5lcmF0ZUV4cG9ydHM6IGdlbmVyYXRlRXhwb3J0c1xufTtcblxuIl19
