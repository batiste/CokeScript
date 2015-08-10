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
  START: {rules: ["EL* EOF"]}, EL: {rules: ["VAR", "char", "name", "start", "end", "dot"]}, VAR: {rules: ["start NAME end"]}, NAME: {rules: ["name dot NAME", "name"]}};

strGram = epegjs.compileGrammar(strInterpolationGrammarDef, strInterpolationTokenDef);

function generateStringCode(node,c) {
  var str, child;
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
    rules: ["samedent* f:FUNC_DEF samedent*"], hooks: function (p) { return p.f; }}, CLASS: {
    rules: [
      "class n:name open_par p:name close_par indent m:CLASS_METHODS+ dedent",
      "class n:name indent m:CLASS_METHODS+ dedent"
    ], hooks: [
    function (p) { return {name: p.n, methods: p.m, parent: p.p}; },
    function (p) { return {name: p.n, methods: p.m}; }
  ]}, FUNC_DEF_PARAMS: {rules: [
    "p1:FUNC_DEF_PARAMS comma W p2:FUNC_DEF_PARAMS",
    "p1:name assign e:EXPR",
    "p1:name"
    ], verbose: "def parameters"}, LAMBDA: {rules: [
    "fd:function_def open_par params:FUNC_DEF_PARAMS? close_par W block:EXPR",
    "fd:function_def W fn:name open_par params:FUNC_DEF_PARAMS? close_par W block:EXPR",
    "fd:function_def W block:EXPR"
    ], hooks: reflect}, FUNC_DEF: {rules: [
    "fd:function_def open_par params:FUNC_DEF_PARAMS? close_par block:BLOCK",
    "fd:function_def W fn:name open_par params:FUNC_DEF_PARAMS? close_par block:BLOCK",
    "fd:function_def W fn:name block:BLOCK",
    "fd:function_def block:BLOCK"
    ], hooks: reflect, verbose: "def definition"}, ELSE_IF: {rules: ["samedent elseif e:EXPR b:BLOCK"], hooks: reflect}, ELSE: {rules: ["samedent else b:BLOCK"], hooks: reflect}, IF: {rules: ["if e:EXPR b:BLOCK elif:ELSE_IF* el:ELSE?"], hooks: reflect}, ELSE_EXPR: {rules: ["W else W b:EXPR"], hooks: reflect}, IF_EXPR: {rules: ["e:EXPR W if test:EXPR el:ELSE_EXPR?"], hooks: reflect}, WHILE: {rules: ["while e:EXPR b:BLOCK"], hooks: reflect}, MATH: {rules: ["e1:EXPR W op:math W e2:EXPR"]}, PATH: {rules: ["PATH dot name", "PATH open_bra number close_bra", "name"]}, ASSIGN: {rules: [
    "left:OBJECT W op:assign W right:EXPR",
    "left:EXPR W op:assign W right:EXPR",
    "left:STRICT_COMMA_SEPARATED_EXPR W op:assign W right:STRICT_COMMA_SEPARATED_EXPR",
    "left:STRICT_COMMA_SEPARATED_EXPR W op:assign W right:EXPR"
  ], hooks: reflect}, W_OR_SAMEDENT: {rules: ["W", "samedent"], verbose: "samedent or whitespace"}, W_SAMEDENT_INDENT: {rules: ["W", "samedent", "indent"], verbose: "indent or samedent or whitespace"}, ANY_SPACE: {rules: ["W", "samedent", "indent", "dedent", "comment"], verbose: "any space"}, FUNC_CALL_PARAMS: {rules: ["EXPR comma ANY_SPACE+ FUNC_CALL_PARAMS ANY_SPACE*", "EXPR ANY_SPACE*"]}, FUNC_CALL: {rules: [
    "open_par FUNC_CALL_PARAMS? close_par"
  ]}, TYPE: {rules: ["name colon"]}, FOR: {rules: [
    "for_loop k:name comma W v:name W in a:EXPR b:BLOCK",
    "for_loop v:name W in a:EXPR b:BLOCK"], hooks: reflect}, STRICT_COMMA_SEPARATED_EXPR: {rules: [
    "e1:EXPR comma W e2:STRICT_COMMA_SEPARATED_EXPR",
    "e1:EXPR comma W e2:EXPR"
  ], hooks: [
    function (p) { return [p.e1].concat(p.e2.children); }, function (p) { return [p.e1, p.e2]; }
  ]}, COMMA_SEPARATED_EXPR: {rules: [
    "EXPR comma ANY_SPACE+ COMMA_SEPARATED_EXPR ANY_SPACE*",
    "EXPR ANY_SPACE*"
  ]}, ARRAY: {rules: [
    "open_bra ANY_SPACE* c:COMMA_SEPARATED_EXPR? ANY_SPACE* close_bra"
  ]}, MEMBERS: {rules: [
    "name:name colon W value:EXPR same:samedent? comma any:ANY_SPACE+ m:MEMBERS space:ANY_SPACE*",
    "name:name colon W value:EXPR space:ANY_SPACE*"
  ], hooks: [
    function (p) { return [p].concat(p.m.children); }, function (p) { return [p]; }
  ]}, OBJECT: {rules: [
    "open_curly indent? MEMBERS? close_curly"
  ]}, TAG_PARAMS: {rules: [
    "left:TAG_PARAMS W right:TAG_PARAMS",
    "n:name assign e:EXPR",
    "n:name"
    ], hooks: reflect, verbose: "tag parameters"}, TAG: {rules: [
    "tag:tag W? params:TAG_PARAMS? end:>? block:BLOCK?"
  ], hooks: reflect}, DOM_ASSIGN: {rules: [
    "assign EXPR"
  ]}, TRY_CATCH: {rules: [
    "try b1:BLOCK samedent? catch open_par err:name? close_par b2:BLOCK"
    ], hooks: reflect}, THROW: {rules: [
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
    ], verbose: "expression"}, EXPR: {rules: [
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
  ], verbose: "expression"}};

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
  var ns, hoisted, key, value;
  ns = currentNs();
  hoisted = [];
  var __keys2 = Object.keys(ns);
  for(var __index2 = 0; __index2 < __keys2.length; __index2++) {
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
    var str, child, hoisted;
    str = '';
    var __keys3 = Object.keys(node.children);
    for(var __index3 = 0; __index3 < __keys3.length; __index3++) {
      child = node.children[__keys3[__index3]];
      str += generateCode(child);
    }
    hoisted = generateHoistedVar();
    if(hoisted) {
      return generateHoistedVar() + '\n' + str;
    }
    return str;
  }, dedent: function (node) {
    depth = Math.max(0, depth - 1);
    return '';
  }, indent: function (node) {
    depth = depth + 1;
    return '\n' + sp();
  }, samedent: function (node) {
    var l, i, str;
    l = node.value.split('\n').length - 1;
    i = 0;
    str = '';
    while(i < l){
      str += '\n' + sp();
      i++;
    }
    return str;
  }, DOM_ASSIGN: function (node) {
    var name, varname, str;
    name = CN();
    varname = generateCode(node.children[1]);
    hoistVar(CN());
    hoistVar('' + prefix + 'tmp');
    str = '' + prefix + 'tmp = ' + varname + '; ' + prefix + 'tmp instanceof Array ? (' + name + ' = ' + name + '.concat(' + prefix + 'tmp)) : ' + name + '.push(String(' + prefix + 'tmp))';
    return str;
  }, TAG_PARAMS: function (node) {
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
  }, TAG: function (node) {
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
  }, CLASS: function (node) {
    var name, funcs, parent, str, constructor, func, func_def, func_name, ns, params, body, cons_str, key, value;
    name = node.children.name.value;
    funcs = node.children.methods;
    parent = node.children.parent;
    str = '';
    constructor = null;
    var __keys4 = Object.keys(funcs);
    for(var __index4 = 0; __index4 < __keys4.length; __index4++) {
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
    var __keys5 = Object.keys(ns);
    for(var __index5 = 0; __index5 < __keys5.length; __index5++) {
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
  }, LAMBDA: function (node) {
    var name, ns, str, key, value, code;
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
  }, FUNC_DEF: function (node) {
    var name, ns, is_dom, str, key, value, code, body, hoisted;
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
  }, FUNC_DEF_PARAMS: function (node) {
    var str, ns, n;
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
      n = node.children[__keys8[__index8]];
      if(n.type === 'name' || n.type === 'FUNC_DEF_PARAMS' || n.type === 'comma' || n.type === 'window') {
        str += generateCode(n);
      }
    }
    
    return str;
  }, ASSIGN: function (node) {
    var str, op, explicit_global, ns, left, right_code, unpack_name, i, child, n, members, member, name, value, s, ch;
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
      var __keys9 = Object.keys(left.children);
      for(var __index9 = 0; __index9 < __keys9.length; __index9++) {
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
      var __keys10 = Object.keys(members);
      for(var __index10 = 0; __index10 < __keys10.length; __index10++) {
        member = members[__keys10[__index10]];
        name = generateCode(member.name);
        value = generateCode(member.value);
        if(member.samedent) {
          generateCode(member.samedent);
        }
        if(member.any) {
          var __keys11 = Object.keys(member.any);
          for(var __index11 = 0; __index11 < __keys11.length; __index11++) {
            s = member.any[__keys11[__index11]];
            generateCode(s);
          }
        }
        if(member.space) {
          var __keys12 = Object.keys(member.space);
          for(var __index12 = 0; __index12 < __keys12.length; __index12++) {
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
  }, STATEMENT: function (node) {
    var str, child, e, t, other;
    str = '';
    var __keys13 = Object.keys(node.children);
    for(var __index13 = 0; __index13 < __keys13.length; __index13++) {
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
  }, IF: function (node) {
    var str, elif, value;
    str = '';
    str = 'if(' + generateCode(node.children.e) + ') {' + generateCode(node.children.b) + '\n' + sp() + '}';
    elif = node.children.elif;
    if(elif) {
      if(Array.isArray(elif)) {
        var __keys14 = Object.keys(elif);
        for(var __index14 = 0; __index14 < __keys14.length; __index14++) {
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
  }, IF_EXPR: function (node) {
    var str;
    str = '';
    str = generateCode(node.children.test) + ' ? ' + generateCode(node.children.e) + ' : ';
    if(node.children.el) {
      str += generateCode(node.children.el);
    } else {
      str += 'undefined';
    }
    
    return str;
  }, ELSE_EXPR: function (node) {
    return generateCode(node.children.b);
  }, WHILE: function (node) {
    return 'while(' + generateCode(node.children.e) + '){' + generateCode(node.children.b) + '\n' + sp() + '}';
  }, FOR: function (node) {
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
    
    if(indexName) {
      hoistVar(indexName);
    }
    hoistVar(varName);
    
    str = 'var ' + keyArrayName + ' = Object.keys(' + arrayName + ');\n';
    str += sp() + 'for(var ' + keyIndexName + ' = 0; ' + keyIndexName + ' < ' + keyArrayName + '.length; ' + keyIndexName + '++) {\n';
    if(indexName) {
      str += sp(1) + '' + indexName + ' = ' + keyArrayName + '[' + keyIndexName + '];\n';
    }
    
    str += sp(1) + '' + varName + ' = ' + arrayName + '[' + keyArrayName + '[' + keyIndexName + ']];';
    str += generateCode(node.children.b) + '\n' + sp() + '}';
    return str;
  }, ELSE_IF: function (node) {
    return ' else if(' + generateCode(node.children.e) + ') {' + generateCode(node.children.b) + '\n' + sp() + '}';
  }, ELSE: function (node) {
    return ' else {' + generateCode(node.children.b) + '\n' + sp() + '}';
  }, TRY_CATCH: function (node) {
    var str;
    str = "try {";
    str += generateCode(node.children.b1);
    str += '\n' + sp() + "} catch(" + generateCode(node.children.err) + ") {";
    str += generateCode(node.children.b2);
    return str + '\n' + sp() + "}";
  }, STRICT_COMMA_SEPARATED_EXPR: function (node) {
    var elements, child;
    elements = [];
    var __keys15 = Object.keys(node.children);
    for(var __index15 = 0; __index15 < __keys15.length; __index15++) {
      child = node.children[__keys15[__index15]];
      elements.push(generateCode(child));
    }
    return '[' + elements.join(", ") + ']';
  }, MEMBERS: function (node) {
    var elements, space, member, s;
    elements = [];
    space = "";
    var __keys16 = Object.keys(node.children);
    for(var __index16 = 0; __index16 < __keys16.length; __index16++) {
      member = node.children[__keys16[__index16]];
      if(member.same) {
        space = generateCode(member.same);
      }
      if(member.any) {
        var __keys17 = Object.keys(member.any);
        for(var __index17 = 0; __index17 < __keys17.length; __index17++) {
          s = member.any[__keys17[__index17]];
          generateCode(s);
        }
      }
      if(member.space) {
        var __keys18 = Object.keys(member.space);
        for(var __index18 = 0; __index18 < __keys18.length; __index18++) {
          s = member.space[__keys18[__index18]];
          generateCode(s);
        }
      }
      elements.push(generateCode(member.name) + ': ' + generateCode(member.value));
    }
    return elements.join(", ");
  }, string: function (node) {
    var v, ast;
    v = node.value;
    v = v.replace(/\n/g, "\\n");
    ast = strGram.parse(v);
    if(!ast.complete) {
      throw new Error(ast.hint);
    }
    return generateStringCode(ast, v.charAt(0));
  }, comment: function (node) {
    return node.value.replace(/^#/g, "//");
  }, pazz: function (node) {
    return '';
  }, not: function (node) {
    return '!';
  }, and: function (node) {
    return '&& ';
  }, or: function (node) {
    return '|| ';
  }, comparison: function (node) {
  if(node.value === '==') {
    return '===';
  }
  
  if(node.value === '!=') {
    return '!==';
  }
  
  return node.value;
}};

function generateCode(node) {
  var str, child;
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
  
  var __keys19 = Object.keys(node.children);
  for(var __index19 = 0; __index19 < __keys19.length; __index19++) {
    child = node.children[__keys19[__index19]];
    str += generateCode(child);
  }
  
  return str;
}


function generateExports(keys) {
  var str, key;
  str = '\nmodule.exports = {';
  keys = keys || Object.keys(currentNs());
  var __keys20 = Object.keys(keys);
  for(var __index20 = 0; __index20 < __keys20.length; __index20++) {
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
  grammar: gram, strGrammar: strGram, grammarDef: grammarDef, epegjs: epegjs, tokenDef: tokenDef, generateModule: generateModule, generateCode: generateCode, generateExports: generateExports};


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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb2tlc2NyaXB0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBRG41QkE7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGVwZWdqcywgZGVwdGgsIGZvckxvb3BDb3VudCwgdW5wYWNraW5nLCBuYW1lc3BhY2VzLCBsZXZlbFN0YWNrLCBwcmVmaXgsIHRva2VuRGVmLCBzdHJJbnRlcnBvbGF0aW9uVG9rZW5EZWYsIHN0ckludGVycG9sYXRpb25HcmFtbWFyRGVmLCBzdHJHcmFtLCBncmFtbWFyRGVmLCBuYywgYmFja2VuZCwgZ3JhbTtcbi8vIENva2VTY3JpcHQgbGFuZ3VhZ2UgYnkgQmF0aXN0ZSBCaWVsZXIgMjAxNVxuLy8gSW1wbGVtZW50ZWQgdXNpbmcgRVBFRy5KU1xuXG5lcGVnanMgPSByZXF1aXJlKFwiZXBlZ2pzXCIpO1xuXG5kZXB0aCA9IDA7XG5mb3JMb29wQ291bnQgPSAxO1xudW5wYWNraW5nID0gMDtcbm5hbWVzcGFjZXMgPSBbe31dO1xubGV2ZWxTdGFjayA9IFswXTtcbnByZWZpeCA9ICdfXyc7XG5cbmZ1bmN0aW9uIGN1cnJlbnROcygpIHtcbiAgcmV0dXJuIG5hbWVzcGFjZXNbbmFtZXNwYWNlcy5sZW5ndGggLSAxXTtcbn1cblxuZnVuY3Rpb24gY3VycmVudE5zSGFzKHApIHtcbiAgcmV0dXJuIG5hbWVzcGFjZXNbbmFtZXNwYWNlcy5sZW5ndGggLSAxXS5oYXNPd25Qcm9wZXJ0eShwKTtcbn1cblxuZnVuY3Rpb24gbmV3TnMoKSB7XG4gIG5hbWVzcGFjZXMucHVzaCh7fSk7XG4gIHJldHVybiBuYW1lc3BhY2VzW25hbWVzcGFjZXMubGVuZ3RoIC0gMV07XG59XG5cbmZ1bmN0aW9uIHJlc2V0R2xvYmFsKCkge1xuICBuYW1lc3BhY2VzID0gW3t9XTtcbiAgZm9yTG9vcENvdW50ID0gMTtcbiAgbGV2ZWxTdGFjayA9IFswXTtcbiAgZGVwdGggPSAwO1xuICB1bnBhY2tpbmcgPSAwO1xufVxuXG4vLyB0b2tlbiBhcmUgbWF0Y2hlZCBpbiBvcmRlciBvZiBkZWNsYXJhdGlvbjtcbi8vIFRPRE86IGFkZCBmdW5jdGlvbnNcblxudG9rZW5EZWYgPSBbXG4gIHtrZXk6IFwic3RyaW5nXCIsIGZ1bmM6IHN0cmluZ0RlZn0sXG4gIHtrZXk6IFwiY29tbWVudFwiLCBmdW5jOiBjb21tZW50RGVmfSxcbiAge2tleTogXCJmdW5jdGlvbl9kZWZcIiwgZnVuYzogZGVmRGVmLCB2ZXJib3NlOiBcImZ1bmN0aW9uXCJ9LFxuICB7a2V5OiBcImNsYXNzXCIsIHJlZzogL15jbGFzcyAvfSxcbiAge2tleTogXCJyZXRcIiwgcmVnOiAvXnJldHVybi8sIHZlcmJvc2U6IFwicmV0dXJuXCJ9LFxuICB7a2V5OiBcImlmXCIsIHJlZzogL15pZiAvfSxcbiAge2tleTogXCJvclwiLCByZWc6IC9eb3IgL30sXG4gIHtrZXk6IFwiYW5kXCIsIHJlZzogL15hbmQgL30sXG4gIHtrZXk6IFwid2hpbGVcIiwgcmVnOiAvXndoaWxlIC99LFxuICB7a2V5OiBcImluc3RhbmNlb2ZcIiwgcmVnOiAvXmluc3RhbmNlb2YgL30sXG4gIHtrZXk6IFwidHJ5XCIsIHJlZzogL150cnkvfSxcbiAge2tleTogXCJjYXRjaFwiLCByZWc6IC9eY2F0Y2gvfSxcbiAge2tleTogXCJ0aHJvd1wiLCByZWc6IC9edGhyb3cgL30sXG4gIHtrZXk6IFwicGF6elwiLCByZWc6IC9ecGFzcy8sIHZlcmJvc2U6IFwicGFzc1wifSxcbiAge2tleTogXCJuZXdcIiwgcmVnOiAvXm5ldyAvfSxcbiAge2tleTogXCJ0YWdcIiwgcmVnOiAvXjxbYS16QS1aXVswLTlhLXpBLVpdezAsMjl9L30sXG4gIHtrZXk6IFwiPlwiLCByZWc6IC9ePi99LFxuICB7a2V5OiBcImVsc2VpZlwiLCByZWc6IC9eZWxzZWlmIC99LFxuICB7a2V5OiBcImVsc2VcIiwgcmVnOiAvXmVsc2UvfSxcbiAge2tleTogXCJmb3JfbG9vcFwiLCByZWc6IC9eZm9yIC8sIHZlcmJvc2U6IFwiZm9yIGxvb3BcIn0sXG4gIHtrZXk6IFwiaW5cIiwgcmVnOiAvXmluIC99LFxuICB7a2V5OiBcIm5vdFwiLCByZWc6IC9ebm90IC8sIHZlcmJvc2U6IFwibm90XCJ9LFxuICB7a2V5OiBcIm5hbWVcIiwgcmVnOiAvXlthLXpBLVpfJF1bMC05YS16QS1aXyRdezAsMjl9L30sXG4gIHtrZXk6IFwicmVnZXhwXCIsIGZ1bmM6IHJlZ0V4cERlZiwgdmVyYm9zZTogXCJyZWd1bGFyIGV4cHJlc3Npb25cIn0sXG4gIHtrZXk6IFwibWF0aF9vcGVyYXRvcnNcIiwgcmVnOiAvXihcXCtcXCt8XFwtXFwtKS8sIHZlcmJvc2U6IFwibWF0aCBvcGVyYXRvclwifSxcbiAge2tleTogXCJiaW5hcnlfb3BlcmF0b3JzXCIsIHJlZzogL14oXFwmXFwmfFxcfFxcfHxcXCZ8XFx8fDw8fFxcPlxcPikvLCB2ZXJib3NlOiBcImJpbmFyeSBvcGVyYXRvclwifSxcbiAge2tleTogXCJjb21wYXJpc29uXCIsIHJlZzogL14oPD18Pj18PHw+fCE9fD09KS99LFxuICB7a2V5OiBcImFzc2lnblwiLCByZWc6IC9eKFxcKz18LT18PXw6PSkvfSxcbiAge2tleTogXCJudW1iZXJcIiwgcmVnOiAvXlstXT9bMC05XStcXC4/WzAtOV0qL30sXG4gIHtrZXk6IFwiY29tbWFcIiwgcmVnOiAvXlxcLC99LFxuICB7a2V5OiBcImRvdFwiLCByZWc6IC9eXFwuL30sXG4gIHtrZXk6IFwiY29sb25cIiwgcmVnOiAvXlxcOi8sIHZlcmJvc2U6IFwiOlwifSxcbiAge2tleTogXCJvcGVuX3BhclwiLCByZWc6IC9eXFwoLywgdmVyYm9zZTogXCIoXCJ9LFxuICB7a2V5OiBcImNsb3NlX3BhclwiLCByZWc6IC9eXFwpLywgdmVyYm9zZTogXCIpXCJ9LFxuICB7a2V5OiBcIm9wZW5fYnJhXCIsIHJlZzogL15cXFsvLCB2ZXJib3NlOiBcIltcIn0sXG4gIHtrZXk6IFwiY2xvc2VfYnJhXCIsIHJlZzogL15cXF0vLCB2ZXJib3NlOiBcIl1cIn0sXG4gIHtrZXk6IFwib3Blbl9jdXJseVwiLCByZWc6IC9eXFx7LywgdmVyYm9zZTogXCJ7XCJ9LFxuICB7a2V5OiBcImNsb3NlX2N1cmx5XCIsIHJlZzogL15cXH0vLCB2ZXJib3NlOiBcIn1cIn0sXG4gIHtrZXk6IFwibWF0aFwiLCByZWc6IC9eWy18XFwrfFxcKnxcXC98JV0vfSxcbiAge2tleTogXCJzYW1lZGVudFwiLCBmdW5jOiBkZW50KFwic2FtZWRlbnRcIiksIHZlcmJvc2U6IFwic2FtZSBpbmRlbnRhdGlvblwifSxcbiAge2tleTogXCJkZWRlbnRcIiwgZnVuYzogZGVudChcImRlZGVudFwiKX0sXG4gIHtrZXk6IFwiaW5kZW50XCIsIGZ1bmM6IGRlbnQoXCJpbmRlbnRcIil9LFxuICB7a2V5OiBcIldcIiwgcmVnOiAvXlsgXS8sIHZlcmJvc2U6IFwic2luZ2xlIHdoaXRlc3BhY2VcIn1cbl07XG5cbmZ1bmN0aW9uIHN0YXJ0U3RyKGlucHV0LHN0cmVhbSkge1xuICB2YXIgbGFzdDtcbiAgbGFzdCA9IHN0cmVhbVtzdHJlYW0ubGVuZ3RoIC0gMV07XG4gIGlmKGxhc3QgJiYgbGFzdC52YWx1ZSA9PT0gXCJcXFxcXCIpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYoaW5wdXQubWF0Y2goL14jey8pKSB7XG4gICAgcmV0dXJuIFwiI3tcIjtcbiAgfVxufVxuXG5zdHJJbnRlcnBvbGF0aW9uVG9rZW5EZWYgPSBbXG4gIHtrZXk6IFwic3RhcnRcIiwgZnVuYzogc3RhcnRTdHJ9LFxuICB7a2V5OiBcImVuZFwiLCByZWc6IC9efS99LFxuICB7a2V5OiBcIm5hbWVcIiwgcmVnOiAvXlthLXpBLVpfJF1bMC05YS16QS1aX117MCwyOX0vfSxcbiAge2tleTogXCJkb3RcIiwgcmVnOiAvXlxcLi99LFxuICB7a2V5OiBcImNoYXJcIiwgcmVnOiAvXi4vfVxuXTtcblxuc3RySW50ZXJwb2xhdGlvbkdyYW1tYXJEZWYgPSB7XG4gIFNUQVJUOiB7cnVsZXM6IFtcIkVMKiBFT0ZcIl19LCBFTDoge3J1bGVzOiBbXCJWQVJcIiwgXCJjaGFyXCIsIFwibmFtZVwiLCBcInN0YXJ0XCIsIFwiZW5kXCIsIFwiZG90XCJdfSwgVkFSOiB7cnVsZXM6IFtcInN0YXJ0IE5BTUUgZW5kXCJdfSwgTkFNRToge3J1bGVzOiBbXCJuYW1lIGRvdCBOQU1FXCIsIFwibmFtZVwiXX19O1xuXG5zdHJHcmFtID0gZXBlZ2pzLmNvbXBpbGVHcmFtbWFyKHN0ckludGVycG9sYXRpb25HcmFtbWFyRGVmLCBzdHJJbnRlcnBvbGF0aW9uVG9rZW5EZWYpO1xuXG5mdW5jdGlvbiBnZW5lcmF0ZVN0cmluZ0NvZGUobm9kZSxjKSB7XG4gIHZhciBzdHIsIGNoaWxkO1xuICBpZihub2RlLnR5cGUgPT09ICdWQVInKSB7XG4gICAgcmV0dXJuIGMgKyAnICsgJyArIGdlbmVyYXRlU3RyaW5nQ29kZShub2RlLmNoaWxkcmVuWzFdLCBjKSArICcgKyAnICsgYztcbiAgfVxuICBcbiAgaWYobm9kZS52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG5vZGUudmFsdWU7XG4gIH1cbiAgXG4gIHN0ciA9ICcnO1xuICBpZighbm9kZS5jaGlsZHJlbikge1xuICAgIHJldHVybiAnJztcbiAgfVxuICBcbiAgdmFyIF9fa2V5czEgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgZm9yKHZhciBfX2luZGV4MSA9IDA7IF9faW5kZXgxIDwgX19rZXlzMS5sZW5ndGg7IF9faW5kZXgxKyspIHtcbiAgICBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX19rZXlzMVtfX2luZGV4MV1dO1xuICAgIHN0ciArPSBnZW5lcmF0ZVN0cmluZ0NvZGUoY2hpbGQsIGMpO1xuICB9XG4gIHJldHVybiBzdHI7XG59XG5cbmZ1bmN0aW9uIGN1cnJlbnRMZXZlbCgpIHtcbiAgcmV0dXJuIGxldmVsU3RhY2tbbGV2ZWxTdGFjay5sZW5ndGggLSAxXTtcbn1cblxuZnVuY3Rpb24gaW5kZW50VHlwZShsKSB7XG4gIGlmKGwgPiBjdXJyZW50TGV2ZWwoKSkge1xuICAgIHJldHVybiAnaW5kZW50JztcbiAgfVxuICBcbiAgaWYobCA8IGN1cnJlbnRMZXZlbCgpKSB7XG4gICAgcmV0dXJuICdkZWRlbnQnO1xuICB9XG4gIFxuICBpZihsID09PSBjdXJyZW50TGV2ZWwoKSkge1xuICAgIHJldHVybiAnc2FtZWRlbnQnO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRlbnQoZGVudFR5cGUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIF9kZW50KGlucHV0KSB7XG4gICAgdmFyIG0sIGxpbmVzLCBpbmRlbnQ7XG4gICAgLy8gZW1wdHkgbGluZSBpcyBhIHNhbWVkZW50XG4gICAgbSA9IGlucHV0Lm1hdGNoKC9eXFxuW1xcc10qLyk7XG4gICAgaWYobSkge1xuICAgICAgbGluZXMgPSBtWzBdLnNwbGl0KFwiXFxuXCIpO1xuICAgICAgaW5kZW50ID0gbGluZXNbbGluZXMubGVuZ3RoIC0gMV0ubGVuZ3RoO1xuICAgICAgaWYoaW5kZW50VHlwZShpbmRlbnQpID09PSBkZW50VHlwZSkge1xuICAgICAgICBpZihkZW50VHlwZSA9PT0gJ2RlZGVudCcpIHtcbiAgICAgICAgICBsZXZlbFN0YWNrLnBvcCgpO1xuICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYoZGVudFR5cGUgPT09ICdpbmRlbnQnKSB7XG4gICAgICAgICAgbGV2ZWxTdGFjay5wdXNoKGluZGVudCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiBtWzBdO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gc3RyaW5nRGVmKGlucHV0KSB7XG4gIHZhciBmaXJzdCwgaSwgY2g7XG4gIGZpcnN0ID0gaW5wdXQuY2hhckF0KDApO1xuICBpZihmaXJzdCA9PT0gJ1wiJyB8fCBmaXJzdCA9PT0gXCInXCIpIHtcbiAgICBpID0gMTtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpe1xuICAgICAgY2ggPSBpbnB1dC5jaGFyQXQoaSk7XG4gICAgICBpZihjaCA9PT0gJ1xcXFwnKSB7XG4gICAgICAgIGkrKztcbiAgICAgIH0gZWxzZSBpZihjaCA9PT0gZmlyc3QpIHtcbiAgICAgICAgcmV0dXJuIGlucHV0LnNsaWNlKDAsIGkgKyAxKTtcbiAgICAgIH1cbiAgICAgIGkrKztcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVnRXhwRGVmKGlucHV0KSB7XG4gIHZhciBpLCBjaDtcbiAgaWYoaW5wdXQuY2hhckF0KDApID09PSAnLycpIHtcbiAgICBpID0gMTtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpe1xuICAgICAgY2ggPSBpbnB1dC5jaGFyQXQoaSk7XG4gICAgICBpZihjaCA9PT0gJ1xcXFwnKSB7XG4gICAgICAgIGkrKztcbiAgICAgIH0gZWxzZSBpZihjaCA9PT0gJy8nKSB7XG4gICAgICAgIGkrKztcbiAgICAgICAgLy8gbW9kaWZpZXJzXG4gICAgICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSAmJiBcImlnbVwiLmluZGV4T2YoaW5wdXQuY2hhckF0KGkpKSAhPT0gLTEpe1xuICAgICAgICAgIGkrKztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGRlZkRlZihpbnB1dCkge1xuICBpZihpbnB1dC5tYXRjaCgvXmRlZltcXCh8IHxcXG5dLykpIHtcbiAgICByZXR1cm4gXCJkZWZcIjtcbiAgfVxuICBcbiAgaWYoaW5wdXQuaW5kZXhPZihcImRvbSBcIikgPT09IDApIHtcbiAgICByZXR1cm4gXCJkb21cIjtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb21tZW50RGVmKGlucHV0KSB7XG4gIHZhciBtLCBpLCBjaDtcbiAgbSA9IGlucHV0Lm1hdGNoKC9eIy8pO1xuICBpZihtKSB7XG4gICAgaSA9IG1bMF0ubGVuZ3RoO1xuICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSl7XG4gICAgICBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxuJykge1xuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHJlZmxlY3QocGFyYW1zKSB7IHJldHVybiBwYXJhbXM7IH1cblxuZ3JhbW1hckRlZiA9IHtcbiAgU1RBUlQ6IHtydWxlczogW1wiTElORSogRU9GXCJdfSwgRUxDOiB7cnVsZXM6IFtcIlcqIGNvbW1lbnRcIl0sIHZlcmJvc2U6IFwiY29tbWVudFwifSwgTElORToge3J1bGVzOiBbXCJTVEFURU1FTlQgRUxDPyBzYW1lZGVudCtcIiwgXCJTVEFURU1FTlQgRUxDPyAhZGVkZW50XCIsIFxuICBcIkVMQz8gc2FtZWRlbnRcIiwgXCJFTEMgIWRlZGVudFwiXSwgdmVyYm9zZTogXCJuZXcgbGluZVwifSwgQkxPQ0s6IHtydWxlczogW1wiaW5kZW50IHBhenogZGVkZW50XCIsIFwiaW5kZW50IExJTkUrIGRlZGVudFwiXX0sIFNUQVRFTUVOVDoge3J1bGVzOiBbXCJBU1NJR05cIiwgXCJFWFBSXCIsIFwiSUZcIiwgXCJXSElMRVwiLCBcIkZPUlwiLCBcIlJFVFVSTlwiLCBcbiAgXCJDTEFTU1wiLCBcIlRBR1wiLCBcIkRPTV9BU1NJR05cIiwgXCJUUllfQ0FUQ0hcIiwgXCJUSFJPV1wiXX0sIENMQVNTX01FVEhPRFM6IHtcbiAgICBydWxlczogW1wic2FtZWRlbnQqIGY6RlVOQ19ERUYgc2FtZWRlbnQqXCJdLCBob29rczogZnVuY3Rpb24gKHApIHsgcmV0dXJuIHAuZjsgfX0sIENMQVNTOiB7XG4gICAgcnVsZXM6IFtcbiAgICAgIFwiY2xhc3MgbjpuYW1lIG9wZW5fcGFyIHA6bmFtZSBjbG9zZV9wYXIgaW5kZW50IG06Q0xBU1NfTUVUSE9EUysgZGVkZW50XCIsXG4gICAgICBcImNsYXNzIG46bmFtZSBpbmRlbnQgbTpDTEFTU19NRVRIT0RTKyBkZWRlbnRcIlxuICAgIF0sIGhvb2tzOiBbXG4gICAgZnVuY3Rpb24gKHApIHsgcmV0dXJuIHtuYW1lOiBwLm4sIG1ldGhvZHM6IHAubSwgcGFyZW50OiBwLnB9OyB9LFxuICAgIGZ1bmN0aW9uIChwKSB7IHJldHVybiB7bmFtZTogcC5uLCBtZXRob2RzOiBwLm19OyB9XG4gIF19LCBGVU5DX0RFRl9QQVJBTVM6IHtydWxlczogW1xuICAgIFwicDE6RlVOQ19ERUZfUEFSQU1TIGNvbW1hIFcgcDI6RlVOQ19ERUZfUEFSQU1TXCIsXG4gICAgXCJwMTpuYW1lIGFzc2lnbiBlOkVYUFJcIixcbiAgICBcInAxOm5hbWVcIlxuICAgIF0sIHZlcmJvc2U6IFwiZGVmIHBhcmFtZXRlcnNcIn0sIExBTUJEQToge3J1bGVzOiBbXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIFcgYmxvY2s6RVhQUlwiLFxuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBvcGVuX3BhciBwYXJhbXM6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgVyBibG9jazpFWFBSXCIsXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgVyBibG9jazpFWFBSXCJcbiAgICBdLCBob29rczogcmVmbGVjdH0sIEZVTkNfREVGOiB7cnVsZXM6IFtcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBvcGVuX3BhciBwYXJhbXM6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgYmxvY2s6QkxPQ0tcIixcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGZuOm5hbWUgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIGJsb2NrOkJMT0NLXCIsXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgVyBmbjpuYW1lIGJsb2NrOkJMT0NLXCIsXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgYmxvY2s6QkxPQ0tcIlxuICAgIF0sIGhvb2tzOiByZWZsZWN0LCB2ZXJib3NlOiBcImRlZiBkZWZpbml0aW9uXCJ9LCBFTFNFX0lGOiB7cnVsZXM6IFtcInNhbWVkZW50IGVsc2VpZiBlOkVYUFIgYjpCTE9DS1wiXSwgaG9va3M6IHJlZmxlY3R9LCBFTFNFOiB7cnVsZXM6IFtcInNhbWVkZW50IGVsc2UgYjpCTE9DS1wiXSwgaG9va3M6IHJlZmxlY3R9LCBJRjoge3J1bGVzOiBbXCJpZiBlOkVYUFIgYjpCTE9DSyBlbGlmOkVMU0VfSUYqIGVsOkVMU0U/XCJdLCBob29rczogcmVmbGVjdH0sIEVMU0VfRVhQUjoge3J1bGVzOiBbXCJXIGVsc2UgVyBiOkVYUFJcIl0sIGhvb2tzOiByZWZsZWN0fSwgSUZfRVhQUjoge3J1bGVzOiBbXCJlOkVYUFIgVyBpZiB0ZXN0OkVYUFIgZWw6RUxTRV9FWFBSP1wiXSwgaG9va3M6IHJlZmxlY3R9LCBXSElMRToge3J1bGVzOiBbXCJ3aGlsZSBlOkVYUFIgYjpCTE9DS1wiXSwgaG9va3M6IHJlZmxlY3R9LCBNQVRIOiB7cnVsZXM6IFtcImUxOkVYUFIgVyBvcDptYXRoIFcgZTI6RVhQUlwiXX0sIFBBVEg6IHtydWxlczogW1wiUEFUSCBkb3QgbmFtZVwiLCBcIlBBVEggb3Blbl9icmEgbnVtYmVyIGNsb3NlX2JyYVwiLCBcIm5hbWVcIl19LCBBU1NJR046IHtydWxlczogW1xuICAgIFwibGVmdDpPQkpFQ1QgVyBvcDphc3NpZ24gVyByaWdodDpFWFBSXCIsXG4gICAgXCJsZWZ0OkVYUFIgVyBvcDphc3NpZ24gVyByaWdodDpFWFBSXCIsXG4gICAgXCJsZWZ0OlNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUiBXIG9wOmFzc2lnbiBXIHJpZ2h0OlNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUlwiLFxuICAgIFwibGVmdDpTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFIgVyBvcDphc3NpZ24gVyByaWdodDpFWFBSXCJcbiAgXSwgaG9va3M6IHJlZmxlY3R9LCBXX09SX1NBTUVERU5UOiB7cnVsZXM6IFtcIldcIiwgXCJzYW1lZGVudFwiXSwgdmVyYm9zZTogXCJzYW1lZGVudCBvciB3aGl0ZXNwYWNlXCJ9LCBXX1NBTUVERU5UX0lOREVOVDoge3J1bGVzOiBbXCJXXCIsIFwic2FtZWRlbnRcIiwgXCJpbmRlbnRcIl0sIHZlcmJvc2U6IFwiaW5kZW50IG9yIHNhbWVkZW50IG9yIHdoaXRlc3BhY2VcIn0sIEFOWV9TUEFDRToge3J1bGVzOiBbXCJXXCIsIFwic2FtZWRlbnRcIiwgXCJpbmRlbnRcIiwgXCJkZWRlbnRcIiwgXCJjb21tZW50XCJdLCB2ZXJib3NlOiBcImFueSBzcGFjZVwifSwgRlVOQ19DQUxMX1BBUkFNUzoge3J1bGVzOiBbXCJFWFBSIGNvbW1hIEFOWV9TUEFDRSsgRlVOQ19DQUxMX1BBUkFNUyBBTllfU1BBQ0UqXCIsIFwiRVhQUiBBTllfU1BBQ0UqXCJdfSwgRlVOQ19DQUxMOiB7cnVsZXM6IFtcbiAgICBcIm9wZW5fcGFyIEZVTkNfQ0FMTF9QQVJBTVM/IGNsb3NlX3BhclwiXG4gIF19LCBUWVBFOiB7cnVsZXM6IFtcIm5hbWUgY29sb25cIl19LCBGT1I6IHtydWxlczogW1xuICAgIFwiZm9yX2xvb3AgazpuYW1lIGNvbW1hIFcgdjpuYW1lIFcgaW4gYTpFWFBSIGI6QkxPQ0tcIixcbiAgICBcImZvcl9sb29wIHY6bmFtZSBXIGluIGE6RVhQUiBiOkJMT0NLXCJdLCBob29rczogcmVmbGVjdH0sIFNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUjoge3J1bGVzOiBbXG4gICAgXCJlMTpFWFBSIGNvbW1hIFcgZTI6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSXCIsXG4gICAgXCJlMTpFWFBSIGNvbW1hIFcgZTI6RVhQUlwiXG4gIF0sIGhvb2tzOiBbXG4gICAgZnVuY3Rpb24gKHApIHsgcmV0dXJuIFtwLmUxXS5jb25jYXQocC5lMi5jaGlsZHJlbik7IH0sIGZ1bmN0aW9uIChwKSB7IHJldHVybiBbcC5lMSwgcC5lMl07IH1cbiAgXX0sIENPTU1BX1NFUEFSQVRFRF9FWFBSOiB7cnVsZXM6IFtcbiAgICBcIkVYUFIgY29tbWEgQU5ZX1NQQUNFKyBDT01NQV9TRVBBUkFURURfRVhQUiBBTllfU1BBQ0UqXCIsXG4gICAgXCJFWFBSIEFOWV9TUEFDRSpcIlxuICBdfSwgQVJSQVk6IHtydWxlczogW1xuICAgIFwib3Blbl9icmEgQU5ZX1NQQUNFKiBjOkNPTU1BX1NFUEFSQVRFRF9FWFBSPyBBTllfU1BBQ0UqIGNsb3NlX2JyYVwiXG4gIF19LCBNRU1CRVJTOiB7cnVsZXM6IFtcbiAgICBcIm5hbWU6bmFtZSBjb2xvbiBXIHZhbHVlOkVYUFIgc2FtZTpzYW1lZGVudD8gY29tbWEgYW55OkFOWV9TUEFDRSsgbTpNRU1CRVJTIHNwYWNlOkFOWV9TUEFDRSpcIixcbiAgICBcIm5hbWU6bmFtZSBjb2xvbiBXIHZhbHVlOkVYUFIgc3BhY2U6QU5ZX1NQQUNFKlwiXG4gIF0sIGhvb2tzOiBbXG4gICAgZnVuY3Rpb24gKHApIHsgcmV0dXJuIFtwXS5jb25jYXQocC5tLmNoaWxkcmVuKTsgfSwgZnVuY3Rpb24gKHApIHsgcmV0dXJuIFtwXTsgfVxuICBdfSwgT0JKRUNUOiB7cnVsZXM6IFtcbiAgICBcIm9wZW5fY3VybHkgaW5kZW50PyBNRU1CRVJTPyBjbG9zZV9jdXJseVwiXG4gIF19LCBUQUdfUEFSQU1TOiB7cnVsZXM6IFtcbiAgICBcImxlZnQ6VEFHX1BBUkFNUyBXIHJpZ2h0OlRBR19QQVJBTVNcIixcbiAgICBcIm46bmFtZSBhc3NpZ24gZTpFWFBSXCIsXG4gICAgXCJuOm5hbWVcIlxuICAgIF0sIGhvb2tzOiByZWZsZWN0LCB2ZXJib3NlOiBcInRhZyBwYXJhbWV0ZXJzXCJ9LCBUQUc6IHtydWxlczogW1xuICAgIFwidGFnOnRhZyBXPyBwYXJhbXM6VEFHX1BBUkFNUz8gZW5kOj4/IGJsb2NrOkJMT0NLP1wiXG4gIF0sIGhvb2tzOiByZWZsZWN0fSwgRE9NX0FTU0lHTjoge3J1bGVzOiBbXG4gICAgXCJhc3NpZ24gRVhQUlwiXG4gIF19LCBUUllfQ0FUQ0g6IHtydWxlczogW1xuICAgIFwidHJ5IGIxOkJMT0NLIHNhbWVkZW50PyBjYXRjaCBvcGVuX3BhciBlcnI6bmFtZT8gY2xvc2VfcGFyIGIyOkJMT0NLXCJcbiAgICBdLCBob29rczogcmVmbGVjdH0sIFRIUk9XOiB7cnVsZXM6IFtcbiAgICBcInRocm93IEVYUFJcIlxuICBdfSwgUkVUVVJOOiB7cnVsZXM6IFtcInJldCBXIFNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUlwiLCBcInJldCBXIEVYUFJcIiwgXCJyZXRcIl19LCBSSUdIVF9FWFBSOiB7cnVsZXM6IFtcbiAgICBcIm1hdGhfb3BlcmF0b3JzXCIsXG4gICAgXCJXIGJpbmFyeV9vcGVyYXRvcnMgVyBFWFBSXCIsXG4gICAgXCJXIG9yIEVYUFJcIixcbiAgICBcIlcgYW5kIEVYUFJcIixcbiAgICBcIlcgY29tcGFyaXNvbiBXIEVYUFJcIixcbiAgICBcIlcgPiBXIEVYUFJcIixcbiAgICBcImRvdCBFWFBSXCIsXG4gICAgXCJXIGluc3RhbmNlb2YgRVhQUlwiLFxuICAgIFwib3Blbl9icmEgRVhQUiBjbG9zZV9icmFcIixcbiAgICBcIkZVTkNfQ0FMTFwiXG4gICAgXSwgdmVyYm9zZTogXCJleHByZXNzaW9uXCJ9LCBFWFBSOiB7cnVsZXM6IFtcbiAgXCJJRl9FWFBSXCIsXG4gIFwiTUFUSFwiLFxuICBcIk9CSkVDVFwiLFxuICBcIkZVTkNfREVGXCIsXG4gIFwiRVhQUiBSSUdIVF9FWFBSXCIsXG4gIFwibmFtZVwiLFxuICBcIm51bWJlclwiLFxuICBcIkxBTUJEQVwiLFxuICBcInN0cmluZ1wiLFxuICBcInJlZ2V4cFwiLFxuICBcIm9wZW5fcGFyIEVYUFIgY2xvc2VfcGFyXCIsXG4gIFwibmV3IEVYUFJcIixcbiAgXCJub3QgRVhQUlwiLFxuICBcIkFSUkFZXCJcbiAgXSwgdmVyYm9zZTogXCJleHByZXNzaW9uXCJ9fTtcblxuZnVuY3Rpb24gc3BhY2VyKG4pIHtcbiAgdmFyIG91dCwgaTtcbiAgb3V0ID0gXCJcIjtcbiAgaSA9IDA7XG4gIHdoaWxlKGkgPCBuKXtcbiAgICBvdXQgKz0gXCIgXCI7XG4gICAgaSsrO1xuICB9XG4gIHJldHVybiBvdXQ7XG59XG5cbmZ1bmN0aW9uIHNwKG1vZCkge1xuICBpZihtb2QpIHtcbiAgICByZXR1cm4gc3BhY2VyKDIgKiAoZGVwdGggKyBtb2QpKTtcbiAgfVxuICByZXR1cm4gc3BhY2VyKDIgKiBkZXB0aCk7XG59XG5cbm5jID0gMTtcblxuLy8gY2hpbGRyZW4gbmFtZVxuZnVuY3Rpb24gQ04oKSB7XG4gIHJldHVybiBwcmVmaXggKyAnYycgKyBuYztcbn1cblxuZnVuY3Rpb24gcHVzaENOKCkge1xuICBuYysrO1xuICByZXR1cm4gcHJlZml4ICsgJ2MnICsgbmM7XG59XG5cbmZ1bmN0aW9uIHBvcENOKCkge1xuICBuYy0tO1xuICByZXR1cm4gcHJlZml4ICsgJ2MnICsgbmM7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlSG9pc3RlZFZhcigpIHtcbiAgdmFyIG5zLCBob2lzdGVkLCBrZXksIHZhbHVlO1xuICBucyA9IGN1cnJlbnROcygpO1xuICBob2lzdGVkID0gW107XG4gIHZhciBfX2tleXMyID0gT2JqZWN0LmtleXMobnMpO1xuICBmb3IodmFyIF9faW5kZXgyID0gMDsgX19pbmRleDIgPCBfX2tleXMyLmxlbmd0aDsgX19pbmRleDIrKykge1xuICAgIGtleSA9IF9fa2V5czJbX19pbmRleDJdO1xuICAgIHZhbHVlID0gbnNbX19rZXlzMltfX2luZGV4Ml1dO1xuICAgIGlmKHZhbHVlID09PSAnaG9pc3QnKSB7XG4gICAgICBob2lzdGVkLnB1c2goa2V5KTtcbiAgICB9XG4gIH1cbiAgaWYoaG9pc3RlZC5sZW5ndGgpIHtcbiAgICByZXR1cm4gJ3ZhciAnICsgaG9pc3RlZC5qb2luKCcsICcpICsgJzsnO1xuICB9XG4gIHJldHVybiAnJztcbn1cblxuZnVuY3Rpb24gaG9pc3RWYXIobmFtZSkge1xuICB2YXIgbnM7XG4gIG5zID0gY3VycmVudE5zKCk7XG4gIG5zW25hbWVdID0gJ2hvaXN0Jztcbn1cblxuYmFja2VuZCA9IHtcbiAgU1RBUlQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciwgY2hpbGQsIGhvaXN0ZWQ7XG4gICAgc3RyID0gJyc7XG4gICAgdmFyIF9fa2V5czMgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgICBmb3IodmFyIF9faW5kZXgzID0gMDsgX19pbmRleDMgPCBfX2tleXMzLmxlbmd0aDsgX19pbmRleDMrKykge1xuICAgICAgY2hpbGQgPSBub2RlLmNoaWxkcmVuW19fa2V5czNbX19pbmRleDNdXTtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoY2hpbGQpO1xuICAgIH1cbiAgICBob2lzdGVkID0gZ2VuZXJhdGVIb2lzdGVkVmFyKCk7XG4gICAgaWYoaG9pc3RlZCkge1xuICAgICAgcmV0dXJuIGdlbmVyYXRlSG9pc3RlZFZhcigpICsgJ1xcbicgKyBzdHI7XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG4gIH0sIGRlZGVudDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICBkZXB0aCA9IE1hdGgubWF4KDAsIGRlcHRoIC0gMSk7XG4gICAgcmV0dXJuICcnO1xuICB9LCBpbmRlbnQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgZGVwdGggPSBkZXB0aCArIDE7XG4gICAgcmV0dXJuICdcXG4nICsgc3AoKTtcbiAgfSwgc2FtZWRlbnQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIGwsIGksIHN0cjtcbiAgICBsID0gbm9kZS52YWx1ZS5zcGxpdCgnXFxuJykubGVuZ3RoIC0gMTtcbiAgICBpID0gMDtcbiAgICBzdHIgPSAnJztcbiAgICB3aGlsZShpIDwgbCl7XG4gICAgICBzdHIgKz0gJ1xcbicgKyBzcCgpO1xuICAgICAgaSsrO1xuICAgIH1cbiAgICByZXR1cm4gc3RyO1xuICB9LCBET01fQVNTSUdOOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBuYW1lLCB2YXJuYW1lLCBzdHI7XG4gICAgbmFtZSA9IENOKCk7XG4gICAgdmFybmFtZSA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzFdKTtcbiAgICBob2lzdFZhcihDTigpKTtcbiAgICBob2lzdFZhcignJyArIHByZWZpeCArICd0bXAnKTtcbiAgICBzdHIgPSAnJyArIHByZWZpeCArICd0bXAgPSAnICsgdmFybmFtZSArICc7ICcgKyBwcmVmaXggKyAndG1wIGluc3RhbmNlb2YgQXJyYXkgPyAoJyArIG5hbWUgKyAnID0gJyArIG5hbWUgKyAnLmNvbmNhdCgnICsgcHJlZml4ICsgJ3RtcCkpIDogJyArIG5hbWUgKyAnLnB1c2goU3RyaW5nKCcgKyBwcmVmaXggKyAndG1wKSknO1xuICAgIHJldHVybiBzdHI7XG4gIH0sIFRBR19QQVJBTVM6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIG5hbWU7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5sZWZ0KSB7XG4gICAgICByZXR1cm4gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ubGVmdCkgKyAnLCAnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucmlnaHQpO1xuICAgIH1cbiAgICBcbiAgICBuYW1lID0gbm9kZS5jaGlsZHJlbi5uLnZhbHVlO1xuICAgIFxuICAgIGlmKG5vZGUuY2hpbGRyZW4uZSkge1xuICAgICAgcmV0dXJuIG5hbWUgKyAnOiAnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBuYW1lICsgJzogdHJ1ZSc7XG4gICAgfVxuICB9LCBUQUc6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciwgcGFyYW1zLCBuYW1lLCBzdWIsIG5zO1xuICAgIHN0ciA9ICcnO1xuICAgIHBhcmFtcyA9IFwie1wiO1xuICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuLnRhZy52YWx1ZS5zdWJzdHJpbmcoMSk7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5wYXJhbXMpIHtcbiAgICAgIHBhcmFtcyArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMpO1xuICAgIH1cbiAgICBcbiAgICBwYXJhbXMgKz0gJ30nO1xuICAgIHN1YiA9ICdbXSc7XG4gICAgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBcbiAgICBpZihub2RlLmNoaWxkcmVuLmJsb2NrKSB7XG4gICAgICBzdWIgPSBwdXNoQ04oKTtcbiAgICAgIHN0ciArPSBDTigpICsgJyA9IFtdOyc7XG4gICAgICBob2lzdFZhcihDTigpKTtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5ibG9jayk7XG4gICAgICBwb3BDTigpO1xuICAgIH1cbiAgICBcbiAgICBzdHIgKz0gJ1xcbicgKyBzcCgpICsgQ04oKSArICcucHVzaCh2aXJ0dWFsRG9tLmgoXCInICsgbmFtZSArICdcIiwge2F0dHJpYnV0ZXM6ICcgKyBwYXJhbXMgKyAnfSwgJyArIHN1YiArICcpKSc7XG4gICAgcmV0dXJuIHN0cjtcbiAgfSwgQ0xBU1M6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIG5hbWUsIGZ1bmNzLCBwYXJlbnQsIHN0ciwgY29uc3RydWN0b3IsIGZ1bmMsIGZ1bmNfZGVmLCBmdW5jX25hbWUsIG5zLCBwYXJhbXMsIGJvZHksIGNvbnNfc3RyLCBrZXksIHZhbHVlO1xuICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuLm5hbWUudmFsdWU7XG4gICAgZnVuY3MgPSBub2RlLmNoaWxkcmVuLm1ldGhvZHM7XG4gICAgcGFyZW50ID0gbm9kZS5jaGlsZHJlbi5wYXJlbnQ7XG4gICAgc3RyID0gJyc7XG4gICAgY29uc3RydWN0b3IgPSBudWxsO1xuICAgIHZhciBfX2tleXM0ID0gT2JqZWN0LmtleXMoZnVuY3MpO1xuICAgIGZvcih2YXIgX19pbmRleDQgPSAwOyBfX2luZGV4NCA8IF9fa2V5czQubGVuZ3RoOyBfX2luZGV4NCsrKSB7XG4gICAgICBmdW5jID0gZnVuY3NbX19rZXlzNFtfX2luZGV4NF1dO1xuICAgICAgZnVuY19kZWYgPSBmdW5jLmNoaWxkcmVuO1xuICAgICAgZnVuY19uYW1lID0gZnVuY19kZWYuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICBpZihmdW5jX25hbWUgPT09ICdjb25zdHJ1Y3RvcicpIHtcbiAgICAgICAgY29uc3RydWN0b3IgPSBmdW5jX2RlZjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSAnXFxuJyArIHNwKCkgKyBuYW1lICsgJy5wcm90b3R5cGUuJyArIGZ1bmNfbmFtZSArICcgPSAnICsgZ2VuZXJhdGVDb2RlKGZ1bmNfZGVmKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgaG9pc3RWYXIobmFtZSk7XG4gICAgbnMgPSBuZXdOcygpO1xuICAgIFxuICAgIHBhcmFtcyA9IGNvbnN0cnVjdG9yICYmIGNvbnN0cnVjdG9yLmNoaWxkcmVuLnBhcmFtcztcbiAgICBpZihwYXJhbXMpIHtcbiAgICAgIHBhcmFtcyA9IGdlbmVyYXRlQ29kZShwYXJhbXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJhbXMgPSAnJztcbiAgICB9XG4gICAgXG4gICAgYm9keSA9IGNvbnN0cnVjdG9yICYmIGNvbnN0cnVjdG9yLmNoaWxkcmVuLmJsb2NrO1xuICAgIGNvbnNfc3RyID0gJycgKyBuYW1lICsgJyA9IGZ1bmN0aW9uICcgKyBuYW1lICsgJyAoICcgKyBwYXJhbXMgKyAnICkgeyc7XG4gICAgY29uc19zdHIgKz0gJ1xcbicgKyBzcCgxKSArICdpZighKHRoaXMgaW5zdGFuY2VvZiAnICsgbmFtZSArICcpKXsgcmV0dXJuIG5ldyAnICsgbmFtZSArICcoJyArIE9iamVjdC5rZXlzKG5zKS5qb2luKCcsJykgKyAnKX0nO1xuICAgIHZhciBfX2tleXM1ID0gT2JqZWN0LmtleXMobnMpO1xuICAgIGZvcih2YXIgX19pbmRleDUgPSAwOyBfX2luZGV4NSA8IF9fa2V5czUubGVuZ3RoOyBfX2luZGV4NSsrKSB7XG4gICAgICBrZXkgPSBfX2tleXM1W19faW5kZXg1XTtcbiAgICAgIHZhbHVlID0gbnNbX19rZXlzNVtfX2luZGV4NV1dO1xuICAgICAgaWYodmFsdWUgIT09IHRydWUgJiYgdmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zX3N0ciArPSAnXFxuJyArIHNwKDEpICsgJ2lmKCcgKyBrZXkgKyAnID09PSB1bmRlZmluZWQpIHsnICsga2V5ICsgJyA9ICcgKyBnZW5lcmF0ZUNvZGUodmFsdWUpICsgJ30nO1xuICAgICAgfVxuICAgIH1cbiAgICBpZihib2R5KSB7XG4gICAgICBjb25zX3N0ciArPSBnZW5lcmF0ZUNvZGUoYm9keSk7XG4gICAgfVxuICAgIGNvbnNfc3RyICs9IHNwKCkgKyAnXFxufSc7XG4gICAgXG4gICAgaWYocGFyZW50KSB7XG4gICAgICBjb25zX3N0ciArPSAnXFxuJyArIHNwKCkgKyAnJyArIG5hbWUgKyAnLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoJyArIHBhcmVudC52YWx1ZSArICcucHJvdG90eXBlKSc7XG4gICAgICBjb25zX3N0ciArPSAnXFxuJyArIHNwKCkgKyAnJyArIG5hbWUgKyAnLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9ICcgKyBuYW1lICsgJyc7XG4gICAgfVxuICAgIFxuICAgIG5hbWVzcGFjZXMucG9wKCk7XG4gICAgcmV0dXJuIGNvbnNfc3RyICsgc3RyO1xuICB9LCBMQU1CREE6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIG5hbWUsIG5zLCBzdHIsIGtleSwgdmFsdWUsIGNvZGU7XG4gICAgbmFtZSA9IFwiXCI7XG4gICAgbnMgPSBuZXdOcygpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uZm4pIHtcbiAgICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuLmZuLnZhbHVlO1xuICAgICAgbnNbbmFtZV0gPSB0cnVlO1xuICAgIH1cbiAgICBcbiAgICBzdHIgPSBcImZ1bmN0aW9uIFwiICsgbmFtZSArIFwiKFwiO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ucGFyYW1zKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucGFyYW1zLCBucyk7XG4gICAgfVxuICAgIFxuICAgIHN0ciArPSAnKSB7JztcbiAgICB2YXIgX19rZXlzNiA9IE9iamVjdC5rZXlzKG5zKTtcbiAgICBmb3IodmFyIF9faW5kZXg2ID0gMDsgX19pbmRleDYgPCBfX2tleXM2Lmxlbmd0aDsgX19pbmRleDYrKykge1xuICAgICAga2V5ID0gX19rZXlzNltfX2luZGV4Nl07XG4gICAgICB2YWx1ZSA9IG5zW19fa2V5czZbX19pbmRleDZdXTtcbiAgICAgIGlmKHZhbHVlICE9PSB0cnVlICYmIHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29kZSA9IGdlbmVyYXRlQ29kZSh2YWx1ZSk7XG4gICAgICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgJ2lmKCcgKyBrZXkgKyAnID09PSB1bmRlZmluZWQpIHsnICsga2V5ICsgJyA9ICcgKyBjb2RlICsgJ30nO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZihub2RlLmNoaWxkcmVuLmJsb2NrKSB7XG4gICAgICBzdHIgKz0gJyByZXR1cm4gJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrLCBucyk7XG4gICAgfVxuICAgIFxuICAgIG5hbWVzcGFjZXMucG9wKCk7XG4gICAgcmV0dXJuIHN0ciArIFwiOyB9XCI7XG4gIH0sIEZVTkNfREVGOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBuYW1lLCBucywgaXNfZG9tLCBzdHIsIGtleSwgdmFsdWUsIGNvZGUsIGJvZHksIGhvaXN0ZWQ7XG4gICAgbmFtZSA9IFwiXCI7XG4gICAgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBpc19kb20gPSBub2RlLmNoaWxkcmVuLmZkLnZhbHVlID09PSAnZG9tJztcbiAgICBpZihub2RlLmNoaWxkcmVuLmZuKSB7XG4gICAgICBuYW1lID0gbm9kZS5jaGlsZHJlbi5mbi52YWx1ZTtcbiAgICAgIG5zW25hbWVdID0gdHJ1ZTtcbiAgICB9XG4gICAgXG4gICAgbnMgPSBuZXdOcygpO1xuICAgIHN0ciA9IFwiZnVuY3Rpb24gXCIgKyBuYW1lICsgXCIoXCI7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5wYXJhbXMpIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMpO1xuICAgIH1cbiAgICBcbiAgICBzdHIgKz0gJykgeyc7XG4gICAgdmFyIF9fa2V5czcgPSBPYmplY3Qua2V5cyhucyk7XG4gICAgZm9yKHZhciBfX2luZGV4NyA9IDA7IF9faW5kZXg3IDwgX19rZXlzNy5sZW5ndGg7IF9faW5kZXg3KyspIHtcbiAgICAgIGtleSA9IF9fa2V5czdbX19pbmRleDddO1xuICAgICAgdmFsdWUgPSBuc1tfX2tleXM3W19faW5kZXg3XV07XG4gICAgICBpZih2YWx1ZSAhPT0gdHJ1ZSAmJiB2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvZGUgPSBnZW5lcmF0ZUNvZGUodmFsdWUpO1xuICAgICAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArICdpZignICsga2V5ICsgJyA9PT0gdW5kZWZpbmVkKSB7JyArIGtleSArICcgPSAnICsgY29kZSArICc7fSc7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGJvZHkgPSAnJztcbiAgICBpZihub2RlLmNoaWxkcmVuLmJsb2NrKSB7XG4gICAgICBib2R5ID0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYmxvY2spO1xuICAgIH1cbiAgICBcbiAgICBpZihpc19kb20pIHtcbiAgICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgJ3ZhciAnICsgQ04oKSArICcgPSBbXTsnO1xuICAgIH1cbiAgICBcbiAgICBob2lzdGVkID0gZ2VuZXJhdGVIb2lzdGVkVmFyKCk7XG4gICAgaWYoaG9pc3RlZCkge1xuICAgICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyBob2lzdGVkO1xuICAgIH1cbiAgICBcbiAgICBzdHIgKz0gYm9keTtcbiAgICBcbiAgICBuYW1lc3BhY2VzLnBvcCgpO1xuICAgIFxuICAgIGlmKGlzX2RvbSkge1xuICAgICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyAncmV0dXJuICcgKyBDTigpICsgJzsnO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc3RyICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICB9LCBGVU5DX0RFRl9QQVJBTVM6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciwgbnMsIG47XG4gICAgc3RyID0gXCJcIjtcbiAgICBucyA9IGN1cnJlbnROcygpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW5bMF0udHlwZSA9PT0gJ25hbWUnKSB7XG4gICAgICBuc1tub2RlLmNoaWxkcmVuWzBdLnZhbHVlXSA9IHRydWU7XG4gICAgICBpZihub2RlLmNoaWxkcmVuWzFdICYmIG5vZGUuY2hpbGRyZW5bMV0udHlwZSA9PT0gJ2Fzc2lnbicpIHtcbiAgICAgICAgbnNbbm9kZS5jaGlsZHJlblswXS52YWx1ZV0gPSBub2RlLmNoaWxkcmVuWzJdO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICB2YXIgX19rZXlzOCA9IE9iamVjdC5rZXlzKG5vZGUuY2hpbGRyZW4pO1xuICAgIGZvcih2YXIgX19pbmRleDggPSAwOyBfX2luZGV4OCA8IF9fa2V5czgubGVuZ3RoOyBfX2luZGV4OCsrKSB7XG4gICAgICBuID0gbm9kZS5jaGlsZHJlbltfX2tleXM4W19faW5kZXg4XV07XG4gICAgICBpZihuLnR5cGUgPT09ICduYW1lJyB8fCBuLnR5cGUgPT09ICdGVU5DX0RFRl9QQVJBTVMnIHx8IG4udHlwZSA9PT0gJ2NvbW1hJyB8fCBuLnR5cGUgPT09ICd3aW5kb3cnKSB7XG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobik7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzdHI7XG4gIH0sIEFTU0lHTjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyLCBvcCwgZXhwbGljaXRfZ2xvYmFsLCBucywgbGVmdCwgcmlnaHRfY29kZSwgdW5wYWNrX25hbWUsIGksIGNoaWxkLCBuLCBtZW1iZXJzLCBtZW1iZXIsIG5hbWUsIHZhbHVlLCBzLCBjaDtcbiAgICBzdHIgPSBcIlwiO1xuICAgIG9wID0gbm9kZS5jaGlsZHJlbi5vcC52YWx1ZTtcbiAgICBleHBsaWNpdF9nbG9iYWwgPSBvcCA9PT0gJzo9JztcbiAgICBpZihleHBsaWNpdF9nbG9iYWwpIHtcbiAgICAgIG9wID0gJz0nO1xuICAgIH1cbiAgICBcbiAgICBucyA9IGN1cnJlbnROcygpO1xuICAgIGxlZnQgPSBub2RlLmNoaWxkcmVuLmxlZnQ7XG4gICAgcmlnaHRfY29kZSA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnJpZ2h0KTtcbiAgICBcbiAgICAvLyBhc3NpZ25lbWVudCB1bnBhY2tpbmdcbiAgICBpZihsZWZ0LnR5cGUgPT09ICdTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFInKSB7XG4gICAgICB1bnBhY2tpbmcrKztcbiAgICAgIHVucGFja19uYW1lID0gJycgKyBwcmVmaXggKyAndW5wYWNrJyArIHVucGFja2luZyArICcnO1xuICAgICAgc3RyICs9ICd2YXIgJyArIHVucGFja19uYW1lICsgJyA9ICcgKyByaWdodF9jb2RlICsgJztcXG4nICsgc3AoKTtcbiAgICAgIGkgPSAwO1xuICAgICAgdmFyIF9fa2V5czkgPSBPYmplY3Qua2V5cyhsZWZ0LmNoaWxkcmVuKTtcbiAgICAgIGZvcih2YXIgX19pbmRleDkgPSAwOyBfX2luZGV4OSA8IF9fa2V5czkubGVuZ3RoOyBfX2luZGV4OSsrKSB7XG4gICAgICAgIGNoaWxkID0gbGVmdC5jaGlsZHJlbltfX2tleXM5W19faW5kZXg5XV07XG4gICAgICAgIG4gPSBjaGlsZC5jaGlsZHJlblswXTtcbiAgICAgICAgaWYobi50eXBlID09PSAnbmFtZScgJiYgY2hpbGQuY2hpbGRyZW4ubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgaG9pc3RWYXIobi52YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShjaGlsZCkgKyAnICcgKyBvcCArICcgJyArIHVucGFja19uYW1lICsgJ1snICsgaSArICddJztcbiAgICAgICAgaWYoaSA8IGxlZnQuY2hpbGRyZW4ubGVuZ3RoIC0gMSkge1xuICAgICAgICAgIHN0ciArPSAnO1xcbicgKyBzcCgpO1xuICAgICAgICB9XG4gICAgICAgIGkrKztcbiAgICAgIH1cbiAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICAgIFxuICAgIC8vIGFzc2lnbmVtZW50IG1hcHBpbmdcbiAgICBpZihsZWZ0LnR5cGUgPT09ICdPQkpFQ1QnKSB7XG4gICAgICB1bnBhY2tpbmcrKztcbiAgICAgIHVucGFja19uYW1lID0gJycgKyBwcmVmaXggKyAndW5wYWNrJyArIHVucGFja2luZyArICcnO1xuICAgICAgc3RyICs9ICd2YXIgJyArIHVucGFja19uYW1lICsgJyA9ICcgKyByaWdodF9jb2RlICsgJztcXG4nICsgc3AoKTtcbiAgICAgIGkgPSAwO1xuICAgICAgbWVtYmVycyA9IGxlZnQuY2hpbGRyZW5bMV0uY2hpbGRyZW47XG4gICAgICB2YXIgX19rZXlzMTAgPSBPYmplY3Qua2V5cyhtZW1iZXJzKTtcbiAgICAgIGZvcih2YXIgX19pbmRleDEwID0gMDsgX19pbmRleDEwIDwgX19rZXlzMTAubGVuZ3RoOyBfX2luZGV4MTArKykge1xuICAgICAgICBtZW1iZXIgPSBtZW1iZXJzW19fa2V5czEwW19faW5kZXgxMF1dO1xuICAgICAgICBuYW1lID0gZ2VuZXJhdGVDb2RlKG1lbWJlci5uYW1lKTtcbiAgICAgICAgdmFsdWUgPSBnZW5lcmF0ZUNvZGUobWVtYmVyLnZhbHVlKTtcbiAgICAgICAgaWYobWVtYmVyLnNhbWVkZW50KSB7XG4gICAgICAgICAgZ2VuZXJhdGVDb2RlKG1lbWJlci5zYW1lZGVudCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYobWVtYmVyLmFueSkge1xuICAgICAgICAgIHZhciBfX2tleXMxMSA9IE9iamVjdC5rZXlzKG1lbWJlci5hbnkpO1xuICAgICAgICAgIGZvcih2YXIgX19pbmRleDExID0gMDsgX19pbmRleDExIDwgX19rZXlzMTEubGVuZ3RoOyBfX2luZGV4MTErKykge1xuICAgICAgICAgICAgcyA9IG1lbWJlci5hbnlbX19rZXlzMTFbX19pbmRleDExXV07XG4gICAgICAgICAgICBnZW5lcmF0ZUNvZGUocyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmKG1lbWJlci5zcGFjZSkge1xuICAgICAgICAgIHZhciBfX2tleXMxMiA9IE9iamVjdC5rZXlzKG1lbWJlci5zcGFjZSk7XG4gICAgICAgICAgZm9yKHZhciBfX2luZGV4MTIgPSAwOyBfX2luZGV4MTIgPCBfX2tleXMxMi5sZW5ndGg7IF9faW5kZXgxMisrKSB7XG4gICAgICAgICAgICBzID0gbWVtYmVyLnNwYWNlW19fa2V5czEyW19faW5kZXgxMl1dO1xuICAgICAgICAgICAgZ2VuZXJhdGVDb2RlKHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzdHIgKz0gXCJcIiArIHZhbHVlICsgXCIuXCIgKyBuYW1lICsgXCIgPSBcIiArIHVucGFja19uYW1lICsgXCIuXCIgKyBuYW1lICsgXCJcIjtcbiAgICAgICAgaWYoaSA8IG1lbWJlcnMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgIHN0ciArPSAnO1xcbicgKyBzcCgpO1xuICAgICAgICB9XG4gICAgICAgIGkrKztcbiAgICAgIH1cbiAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICAgIFxuICAgIFxuICAgIGlmKGxlZnQuY2hpbGRyZW5bMF0udHlwZSA9PT0gJ25hbWUnKSB7XG4gICAgICBjaCA9IGxlZnQuY2hpbGRyZW5bMF07XG4gICAgICBpZighY3VycmVudE5zSGFzKGNoLnZhbHVlKSkge1xuICAgICAgICBpZighZXhwbGljaXRfZ2xvYmFsKSB7XG4gICAgICAgICAgaG9pc3RWYXIoY2gudmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5sZWZ0KSArICcgJyArIG9wICsgJyAnICsgcmlnaHRfY29kZTtcbiAgfSwgU1RBVEVNRU5UOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHIsIGNoaWxkLCBlLCB0LCBvdGhlcjtcbiAgICBzdHIgPSAnJztcbiAgICB2YXIgX19rZXlzMTMgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgICBmb3IodmFyIF9faW5kZXgxMyA9IDA7IF9faW5kZXgxMyA8IF9fa2V5czEzLmxlbmd0aDsgX19pbmRleDEzKyspIHtcbiAgICAgIGNoaWxkID0gbm9kZS5jaGlsZHJlbltfX2tleXMxM1tfX2luZGV4MTNdXTtcbiAgICAgIGUgPSBjaGlsZC5jaGlsZHJlbiAmJiBjaGlsZC5jaGlsZHJlblswXTtcbiAgICAgIC8vIFRPRE86IHRoaXMgc2hvdWxkIGJlIHBvc3NpYmxlXG4gICAgICB0ID0gY2hpbGQudHlwZTtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoY2hpbGQpO1xuICAgICAgb3RoZXIgPSBlICYmIChlLnR5cGUgPT09ICdGVU5DX0RFRicgfHwgZS50eXBlID09PSAnTEFNQkRBJyk7XG4gICAgICBpZih0ID09PSAnRk9SJyB8fCB0ID09PSAnVFJZX0NBVENIJyB8fCB0ID09PSAnV0hJTEUnIHx8IHQgPT09ICdJRicgfHwgdCA9PT0gJ1NUQVRFTUVOVCcgfHwgdCA9PT0gJ3NhbWVkZW50JyB8fCBvdGhlcikge1xuICAgICAgICBcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSAnOyc7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBzdHI7XG4gIH0sIElGOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHIsIGVsaWYsIHZhbHVlO1xuICAgIHN0ciA9ICcnO1xuICAgIHN0ciA9ICdpZignICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZSkgKyAnKSB7JyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICAgIGVsaWYgPSBub2RlLmNoaWxkcmVuLmVsaWY7XG4gICAgaWYoZWxpZikge1xuICAgICAgaWYoQXJyYXkuaXNBcnJheShlbGlmKSkge1xuICAgICAgICB2YXIgX19rZXlzMTQgPSBPYmplY3Qua2V5cyhlbGlmKTtcbiAgICAgICAgZm9yKHZhciBfX2luZGV4MTQgPSAwOyBfX2luZGV4MTQgPCBfX2tleXMxNC5sZW5ndGg7IF9faW5kZXgxNCsrKSB7XG4gICAgICAgICAgdmFsdWUgPSBlbGlmW19fa2V5czE0W19faW5kZXgxNF1dO1xuICAgICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUodmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKGVsaWYpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZihub2RlLmNoaWxkcmVuLmVsKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZWwpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc3RyO1xuICB9LCBJRl9FWFBSOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHI7XG4gICAgc3RyID0gJyc7XG4gICAgc3RyID0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4udGVzdCkgKyAnID8gJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJyA6ICc7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5lbCkge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmVsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyICs9ICd1bmRlZmluZWQnO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc3RyO1xuICB9LCBFTFNFX0VYUFI6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpO1xuICB9LCBXSElMRTogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJ3doaWxlKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcpeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgfSwgRk9SOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBrZXlJbmRleE5hbWUsIGtleUFycmF5TmFtZSwgYXJyYXlOYW1lLCB2YXJOYW1lLCBpbmRleE5hbWUsIHN0cjtcbiAgICBrZXlJbmRleE5hbWUgPSBwcmVmaXggKyBcImluZGV4XCIgKyBmb3JMb29wQ291bnQ7XG4gICAga2V5QXJyYXlOYW1lID0gcHJlZml4ICsgXCJrZXlzXCIgKyBmb3JMb29wQ291bnQ7XG4gICAgYXJyYXlOYW1lID0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYSk7XG4gICAgdmFyTmFtZSA9IG5vZGUuY2hpbGRyZW4udi52YWx1ZTtcbiAgICBmb3JMb29wQ291bnQrKztcbiAgICBpbmRleE5hbWUgPSBmYWxzZTtcbiAgICBpZihub2RlLmNoaWxkcmVuLmspIHtcbiAgICAgIGluZGV4TmFtZSA9IG5vZGUuY2hpbGRyZW4uay52YWx1ZTtcbiAgICB9XG4gICAgXG4gICAgaWYoaW5kZXhOYW1lKSB7XG4gICAgICBob2lzdFZhcihpbmRleE5hbWUpO1xuICAgIH1cbiAgICBob2lzdFZhcih2YXJOYW1lKTtcbiAgICBcbiAgICBzdHIgPSAndmFyICcgKyBrZXlBcnJheU5hbWUgKyAnID0gT2JqZWN0LmtleXMoJyArIGFycmF5TmFtZSArICcpO1xcbic7XG4gICAgc3RyICs9IHNwKCkgKyAnZm9yKHZhciAnICsga2V5SW5kZXhOYW1lICsgJyA9IDA7ICcgKyBrZXlJbmRleE5hbWUgKyAnIDwgJyArIGtleUFycmF5TmFtZSArICcubGVuZ3RoOyAnICsga2V5SW5kZXhOYW1lICsgJysrKSB7XFxuJztcbiAgICBpZihpbmRleE5hbWUpIHtcbiAgICAgIHN0ciArPSBzcCgxKSArICcnICsgaW5kZXhOYW1lICsgJyA9ICcgKyBrZXlBcnJheU5hbWUgKyAnWycgKyBrZXlJbmRleE5hbWUgKyAnXTtcXG4nO1xuICAgIH1cbiAgICBcbiAgICBzdHIgKz0gc3AoMSkgKyAnJyArIHZhck5hbWUgKyAnID0gJyArIGFycmF5TmFtZSArICdbJyArIGtleUFycmF5TmFtZSArICdbJyArIGtleUluZGV4TmFtZSArICddXTsnO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgICByZXR1cm4gc3RyO1xuICB9LCBFTFNFX0lGOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnIGVsc2UgaWYoJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJykgeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgfSwgRUxTRTogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyBlbHNlIHsnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYikgKyAnXFxuJyArIHNwKCkgKyAnfSc7XG4gIH0sIFRSWV9DQVRDSDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyO1xuICAgIHN0ciA9IFwidHJ5IHtcIjtcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYjEpO1xuICAgIHN0ciArPSAnXFxuJyArIHNwKCkgKyBcIn0gY2F0Y2goXCIgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lcnIpICsgXCIpIHtcIjtcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYjIpO1xuICAgIHJldHVybiBzdHIgKyAnXFxuJyArIHNwKCkgKyBcIn1cIjtcbiAgfSwgU1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBlbGVtZW50cywgY2hpbGQ7XG4gICAgZWxlbWVudHMgPSBbXTtcbiAgICB2YXIgX19rZXlzMTUgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgICBmb3IodmFyIF9faW5kZXgxNSA9IDA7IF9faW5kZXgxNSA8IF9fa2V5czE1Lmxlbmd0aDsgX19pbmRleDE1KyspIHtcbiAgICAgIGNoaWxkID0gbm9kZS5jaGlsZHJlbltfX2tleXMxNVtfX2luZGV4MTVdXTtcbiAgICAgIGVsZW1lbnRzLnB1c2goZ2VuZXJhdGVDb2RlKGNoaWxkKSk7XG4gICAgfVxuICAgIHJldHVybiAnWycgKyBlbGVtZW50cy5qb2luKFwiLCBcIikgKyAnXSc7XG4gIH0sIE1FTUJFUlM6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIGVsZW1lbnRzLCBzcGFjZSwgbWVtYmVyLCBzO1xuICAgIGVsZW1lbnRzID0gW107XG4gICAgc3BhY2UgPSBcIlwiO1xuICAgIHZhciBfX2tleXMxNiA9IE9iamVjdC5rZXlzKG5vZGUuY2hpbGRyZW4pO1xuICAgIGZvcih2YXIgX19pbmRleDE2ID0gMDsgX19pbmRleDE2IDwgX19rZXlzMTYubGVuZ3RoOyBfX2luZGV4MTYrKykge1xuICAgICAgbWVtYmVyID0gbm9kZS5jaGlsZHJlbltfX2tleXMxNltfX2luZGV4MTZdXTtcbiAgICAgIGlmKG1lbWJlci5zYW1lKSB7XG4gICAgICAgIHNwYWNlID0gZ2VuZXJhdGVDb2RlKG1lbWJlci5zYW1lKTtcbiAgICAgIH1cbiAgICAgIGlmKG1lbWJlci5hbnkpIHtcbiAgICAgICAgdmFyIF9fa2V5czE3ID0gT2JqZWN0LmtleXMobWVtYmVyLmFueSk7XG4gICAgICAgIGZvcih2YXIgX19pbmRleDE3ID0gMDsgX19pbmRleDE3IDwgX19rZXlzMTcubGVuZ3RoOyBfX2luZGV4MTcrKykge1xuICAgICAgICAgIHMgPSBtZW1iZXIuYW55W19fa2V5czE3W19faW5kZXgxN11dO1xuICAgICAgICAgIGdlbmVyYXRlQ29kZShzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYobWVtYmVyLnNwYWNlKSB7XG4gICAgICAgIHZhciBfX2tleXMxOCA9IE9iamVjdC5rZXlzKG1lbWJlci5zcGFjZSk7XG4gICAgICAgIGZvcih2YXIgX19pbmRleDE4ID0gMDsgX19pbmRleDE4IDwgX19rZXlzMTgubGVuZ3RoOyBfX2luZGV4MTgrKykge1xuICAgICAgICAgIHMgPSBtZW1iZXIuc3BhY2VbX19rZXlzMThbX19pbmRleDE4XV07XG4gICAgICAgICAgZ2VuZXJhdGVDb2RlKHMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbGVtZW50cy5wdXNoKGdlbmVyYXRlQ29kZShtZW1iZXIubmFtZSkgKyAnOiAnICsgZ2VuZXJhdGVDb2RlKG1lbWJlci52YWx1ZSkpO1xuICAgIH1cbiAgICByZXR1cm4gZWxlbWVudHMuam9pbihcIiwgXCIpO1xuICB9LCBzdHJpbmc6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHYsIGFzdDtcbiAgICB2ID0gbm9kZS52YWx1ZTtcbiAgICB2ID0gdi5yZXBsYWNlKC9cXG4vZywgXCJcXFxcblwiKTtcbiAgICBhc3QgPSBzdHJHcmFtLnBhcnNlKHYpO1xuICAgIGlmKCFhc3QuY29tcGxldGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihhc3QuaGludCk7XG4gICAgfVxuICAgIHJldHVybiBnZW5lcmF0ZVN0cmluZ0NvZGUoYXN0LCB2LmNoYXJBdCgwKSk7XG4gIH0sIGNvbW1lbnQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuIG5vZGUudmFsdWUucmVwbGFjZSgvXiMvZywgXCIvL1wiKTtcbiAgfSwgcGF6ejogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyc7XG4gIH0sIG5vdDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyEnO1xuICB9LCBhbmQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuICcmJiAnO1xuICB9LCBvcjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJ3x8ICc7XG4gIH0sIGNvbXBhcmlzb246IGZ1bmN0aW9uIChub2RlKSB7XG4gIGlmKG5vZGUudmFsdWUgPT09ICc9PScpIHtcbiAgICByZXR1cm4gJz09PSc7XG4gIH1cbiAgXG4gIGlmKG5vZGUudmFsdWUgPT09ICchPScpIHtcbiAgICByZXR1cm4gJyE9PSc7XG4gIH1cbiAgXG4gIHJldHVybiBub2RlLnZhbHVlO1xufX07XG5cbmZ1bmN0aW9uIGdlbmVyYXRlQ29kZShub2RlKSB7XG4gIHZhciBzdHIsIGNoaWxkO1xuICBpZighbm9kZSkge1xuICAgIC8vIGRlYnVnZ2VyXG4gIH1cbiAgaWYoYmFja2VuZFtub2RlLnR5cGVdKSB7XG4gICAgcmV0dXJuIGJhY2tlbmRbbm9kZS50eXBlXShub2RlKTtcbiAgfVxuICBcbiAgaWYobm9kZS52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG5vZGUudmFsdWU7XG4gIH1cbiAgXG4gIHN0ciA9IFwiXCI7XG4gIGlmKCFub2RlLmNoaWxkcmVuKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG4gIFxuICB2YXIgX19rZXlzMTkgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgZm9yKHZhciBfX2luZGV4MTkgPSAwOyBfX2luZGV4MTkgPCBfX2tleXMxOS5sZW5ndGg7IF9faW5kZXgxOSsrKSB7XG4gICAgY2hpbGQgPSBub2RlLmNoaWxkcmVuW19fa2V5czE5W19faW5kZXgxOV1dO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoY2hpbGQpO1xuICB9XG4gIFxuICByZXR1cm4gc3RyO1xufVxuXG5cbmZ1bmN0aW9uIGdlbmVyYXRlRXhwb3J0cyhrZXlzKSB7XG4gIHZhciBzdHIsIGtleTtcbiAgc3RyID0gJ1xcbm1vZHVsZS5leHBvcnRzID0geyc7XG4gIGtleXMgPSBrZXlzIHx8IE9iamVjdC5rZXlzKGN1cnJlbnROcygpKTtcbiAgdmFyIF9fa2V5czIwID0gT2JqZWN0LmtleXMoa2V5cyk7XG4gIGZvcih2YXIgX19pbmRleDIwID0gMDsgX19pbmRleDIwIDwgX19rZXlzMjAubGVuZ3RoOyBfX2luZGV4MjArKykge1xuICAgIGtleSA9IGtleXNbX19rZXlzMjBbX19pbmRleDIwXV07XG4gICAgc3RyICs9ICdcXG4gICcgKyBrZXkgKyAnIDogJyArIGtleSArICcsJztcbiAgfVxuICByZXR1cm4gc3RyICsgJ1xcbn0nO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZU1vZHVsZShpbnB1dCxvcHRzKSB7XG4gIHZhciBhc3QsIG9iajtcbiAgcmVzZXRHbG9iYWwoKTtcbiAgYXN0ID0gZ3JhbS5wYXJzZShpbnB1dCArIFwiXFxuXCIpO1xuICBpZighYXN0LmNvbXBsZXRlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGFzdC5oaW50KTtcbiAgfVxuICBcbiAgb2JqID0ge2FzdDogYXN0LCBjb2RlOiBnZW5lcmF0ZUNvZGUoYXN0KSwgbnM6IGN1cnJlbnROcygpfTtcbiAgcmV0dXJuIG9iajtcbn1cblxuXG5ncmFtID0gZXBlZ2pzLmNvbXBpbGVHcmFtbWFyKGdyYW1tYXJEZWYsIHRva2VuRGVmKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGdyYW1tYXI6IGdyYW0sIHN0ckdyYW1tYXI6IHN0ckdyYW0sIGdyYW1tYXJEZWY6IGdyYW1tYXJEZWYsIGVwZWdqczogZXBlZ2pzLCB0b2tlbkRlZjogdG9rZW5EZWYsIGdlbmVyYXRlTW9kdWxlOiBnZW5lcmF0ZU1vZHVsZSwgZ2VuZXJhdGVDb2RlOiBnZW5lcmF0ZUNvZGUsIGdlbmVyYXRlRXhwb3J0czogZ2VuZXJhdGVFeHBvcnRzfTtcblxuIl19
