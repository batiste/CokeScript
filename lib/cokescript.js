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
  var last = stream[stream.length - 1];
  if(last && last.value === "\\") {
    return;
  }
  if(input.match(/^#{/)) {
    return "#{";
  }
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
  if(node.type === 'VAR') {
    return c + ' + ' + generateStringCode(node.children[1], c) + ' + ' + c;
  }
  if(node.value !== undefined) {
    return node.value;
  }
  var str = '';
  if(!node.children) {
    return '';
  }
  var children = node.children;
  var _keys1 = Object.keys(children);
  for(var _index1 = 0; _index1 < _keys1.length; _index1++) {
    var child = children[_keys1[_index1]];
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
    // empty line is a samedent
    var m = input.match(/^\n[\s]*/);
    if(m) {
      var lines = m[0].split("\n");
      var indent = lines[lines.length - 1].length;
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
  var first = input.charAt(0);
  if(first === '"' || first === "'") {
    var i = 1;
    while(input.charAt(i)){
      var ch = input.charAt(i);
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
  if(input.charAt(0) === '/') {
    var i = 1;
    while(input.charAt(i)){
      var ch = input.charAt(i);
      if(ch === '\\') {
        i++;
      } else if(ch === '/') {
        i++;;// modifiers
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
  var m = input.match(/^#/);
  if(m) {
    var i = m[0].length;
    while(input.charAt(i)){
      var ch = input.charAt(i);
      if(ch === '\n') {
        return input.slice(0, i);
      }
      i++;
    }
  }
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
  if(mod) {
    return spacer(2 * (depth + mod));
  }
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
    return '\n' + sp();
  }
  ,
  DOM_ASSIGN: function (node) {
    var name = CN();
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
    var str = '';
    var params = "{";
    var name = node.children.tag.value.substring(1);
    if(node.children.params) {
      params += generateCode(node.children.params);
    }
    params += '}';
    var sub = '[]';
    if(node.children.block) {
      sub = pushCN();
      str += '' + CN() + ' = []';
      str += generateCode(node.children.block);
      popCN();
    }
    str += '\n' + sp(1) + CN() + '.push(h("' + name + '", ' + params + ', ' + sub + '))';
    return str;
  }
  ,
  CLASS: function (node) {
    var name = node.children.name.value;
    var funcs = node.children.methods;
    var parent = node.children.parent;
    var str = '';
    var constructor = null;
    var _keys2 = Object.keys(funcs);
    for(var _index2 = 0; _index2 < _keys2.length; _index2++) {
      var func = funcs[_keys2[_index2]];
      var func_def = func.children;
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
    var cons_str = '' + name + ' = function ' + name + '(' + params + ') {';
    cons_str += '\n' + sp(1) + 'if(!(this instanceof ' + name + ')){ return new ' + name + '(' + Object.keys(ns).join(',') + ')}';
    var _keys3 = Object.keys(ns);
    for(var _index3 = 0; _index3 < _keys3.length; _index3++) {
      var key = _keys3[_index3];
      var value = ns[_keys3[_index3]];
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
    var name = "";
    var ns = newNs();
    if(node.children.fn) {
      name = node.children.fn.value;
      ns[name] = true;
    }
    var str = "function " + name + "(";
    if(node.children.params) {
      str += generateCode(node.children.params, ns);
    }
    str += ') {';
    var _keys4 = Object.keys(ns);
    for(var _index4 = 0; _index4 < _keys4.length; _index4++) {
      var key = _keys4[_index4];
      var value = ns[_keys4[_index4]];
      if(value !== true && value !== undefined) {
        var code = generateCode(value);
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
    var name = "";
    var ns = currentNs();
    var is_dom = node.children.fd.value === 'dom';
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
    var _keys5 = Object.keys(ns);
    for(var _index5 = 0; _index5 < _keys5.length; _index5++) {
      var key = _keys5[_index5];
      var value = ns[_keys5[_index5]];
      if(value !== true && value !== undefined) {
        var code = generateCode(value);
        str += '\n' + sp(1) + 'if(' + key + ' === undefined) {' + key + ' = ' + code + ';}';
      }
    }
    if(is_dom) {
      str += '\n' + sp(1) + '' + CN() + ' = [];';
    }
    if(node.children.block) {
      str += generateCode(node.children.block);
    }
    namespaces.pop();
    if(is_dom) {
      str += '\n' + sp(1) + 'return ' + CN() + ';';
    }
    return str + '\n' + sp() + '}';
  }
  ,
  FUNC_DEF_PARAMS: function (node) {
    var str = "";
    var ns = currentNs();
    if(node.children[0].type === 'name') {
      ns[node.children[0].value] = true;
      if(node.children[1] && node.children[1].type === 'assign') {
        ns[node.children[0].value] = node.children[2];
      }
    };// TODO: fix this
    var children = node.children;
    var _keys6 = Object.keys(children);
    for(var _index6 = 0; _index6 < _keys6.length; _index6++) {
      var n = children[_keys6[_index6]];
      if(n.type === 'name' || n.type === 'FUNC_DEF_PARAMS' || n.type === 'comma' || n.type === 'window') {
        str += generateCode(n);
      }
    }
    return str;
  }
  ,
  ASSIGN: function (node) {
    var prefix = "";
    var str = "";
    var op = node.children.op.value;
    var explicit_global = op === ':=';
    if(explicit_global) {
      op = '=';
    }
    var ns = currentNs();
    var left = node.children.left;
    var right_code = generateCode(node.children.right);
    if(left.type === 'STRICT_COMMA_SEPARATED_EXPR') {
      unpacking++;
      var unpack_name = '__unpack' + unpacking;
      str += 'var ' + unpack_name + " = " + right_code + "\n" + sp();
      var children = left.children;
      var i = 0;
      var _keys7 = Object.keys(children);
      for(var _index7 = 0; _index7 < _keys7.length; _index7++) {
        var child = children[_keys7[_index7]];
        var n = child.children[0];
        prefix = "";
        if(n.type === 'name') {
          if(currentNsHas(n.value) === undefined) {
            ns[n.value] = true;
            if(!explicit_global) {
              prefix = '';
            }
          }
        }
        str += prefix + generateCode(n) + ' ' + op + ' ' + unpack_name + '[' + i + '];\n' + sp();
        i++;
      }
      return str;
    }
    if(left.children[0].type === 'name') {
      var ch = left.children[0];
      if(!currentNsHas(ch.value)) {
        if(!explicit_global) {
          prefix = 'var ';
        }
        ns[ch.value] = true;
      }
    }
    return prefix + generateCode(node.children.left) + ' ' + op + ' ' + right_code;
  }
  ,
  STATEMENT: function (node) {
    var e = node.children[0].children[0];;// TODO: this should be possible
    var t = node.children[0].type;
    var other = e && (e.type === 'FUNC_DEF' || e.type === 'LAMBDA' || e.type === 'COMMENT');
    if(t === 'FOR' || t === 'TRY_CATCH' || t === 'WHILE' || t === 'IF' || t === 'COMMENT' || other) {
      return generateCode(node.children[0]);
    }
    return generateCode(node.children[0]) + ';';
  }
  ,
  IF: function (node) {
    var str = '';
    str = 'if(' + generateCode(node.children.e) + ') {' + generateCode(node.children.b) + '\n' + sp() + '}';
    var elif = node.children.elif;
    if(elif) {
      if(Array.isArray(elif)) {
        var _keys8 = Object.keys(elif);
        for(var _index8 = 0; _index8 < _keys8.length; _index8++) {
          var value = elif[_keys8[_index8]];
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
    var str = '';
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
    var keyIndexName = "_index" + forLoopCount;
    var keyArrayName = "_keys" + forLoopCount;
    forLoopCount++;
    var indexName = false;
    if(node.children.k) {
      indexName = node.children.k.value;
    }
    var str = 'var ' + keyArrayName + ' = Object.keys(' + node.children.a.value + ');\n';
    str += sp() + 'for(var ' + keyIndexName + ' = 0; ' + keyIndexName + ' < ' + keyArrayName + '.length; ' + keyIndexName + '++) {\n';
    if(indexName) {
      str += sp(1) + 'var ' + indexName + ' = ' + keyArrayName + '[' + keyIndexName + '];\n';
    }
    str += sp(1) + 'var ' + node.children.v.value + ' = ' + node.children.a.value + '[' + keyArrayName + '[' + keyIndexName + ']];';
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
    for(var _index9 = 0; _index9 < _keys9.length; _index9++) {
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
  if(!node) {
    // debugger
  }
  if(backend[node.type]) {
    return backend[node.type](node);
  }
  if(node.value !== undefined) {
    return node.value;
  }
  var str = "";
  if(!node.children) {
    return '';
  }
  var children = node.children;
  var _keys10 = Object.keys(children);
  for(var _index10 = 0; _index10 < _keys10.length; _index10++) {
    var child = children[_keys10[_index10]];
    str += generateCode(child);
  }
  return str;
}
function generateExports(keys) {
  var str = '\nmodule.exports = {';
  keys = keys || Object.keys(currentNs());
  var _keys11 = Object.keys(keys);
  for(var _index11 = 0; _index11 < _keys11.length; _index11++) {
    var key = keys[_keys11[_index11]];
    str += '\n  ' + key + ': ' + key + ',';
  }
  return str + '\n}';
}
function generateModule(input,opts) {
  resetGlobal();
  var ast = gram.parse(input + "\n");
  if(!ast.complete) {
    throw new Error(ast.hint);
  }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb2tlc2NyaXB0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FEMXdCQTtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxuLy8gQ29rZVNjcmlwdCBsYW5ndWFnZSBieSBCYXRpc3RlIEJpZWxlciAyMDE1XG4vLyBJbXBsZW1lbnRlZCB1c2luZyBFUEVHLkpTXG52YXIgZXBlZ2pzID0gcmVxdWlyZShcImVwZWdqc1wiKTtcbnZhciBkZXB0aCA9IDA7XG52YXIgZm9yTG9vcENvdW50ID0gMTtcbnZhciB1bnBhY2tpbmcgPSAwO1xudmFyIG5hbWVzcGFjZXMgPSBbe31dO1xudmFyIGxldmVsU3RhY2sgPSBbMF07XG5mdW5jdGlvbiBjdXJyZW50TnMoKSB7XG4gIHJldHVybiBuYW1lc3BhY2VzW25hbWVzcGFjZXMubGVuZ3RoIC0gMV07XG59XG5mdW5jdGlvbiBjdXJyZW50TnNIYXMocCkge1xuICByZXR1cm4gbmFtZXNwYWNlc1tuYW1lc3BhY2VzLmxlbmd0aCAtIDFdLmhhc093blByb3BlcnR5KHApO1xufVxuZnVuY3Rpb24gbmV3TnMoKSB7XG4gIG5hbWVzcGFjZXMucHVzaCh7fSk7XG4gIHJldHVybiBuYW1lc3BhY2VzW25hbWVzcGFjZXMubGVuZ3RoIC0gMV07XG59XG5mdW5jdGlvbiByZXNldEdsb2JhbCgpIHtcbiAgbmFtZXNwYWNlcyA9IFt7fV07XG4gIGZvckxvb3BDb3VudCA9IDE7XG4gIGxldmVsU3RhY2sgPSBbMF07XG4gIGRlcHRoID0gMDtcbiAgdW5wYWNraW5nID0gMDtcbn07Oy8vIFRPRE86IGFkZCBmdW5jdGlvbnNcbnZhciB0b2tlbkRlZiA9IFtcbiAge2tleTogXCJzdHJpbmdcIiwgZnVuYzogc3RyaW5nRGVmfSxcbiAge2tleTogXCJjb21tZW50XCIsIGZ1bmM6IGNvbW1lbnREZWZ9LFxuICB7a2V5OiBcImZ1bmN0aW9uX2RlZlwiLCBmdW5jOiBkZWZEZWYsIHZlcmJvc2U6IFwiZGVmIGRlZmluaXRpb25cIn0sXG4gIHtrZXk6IFwiY2xhc3NcIiwgcmVnOiAvXmNsYXNzIC99LFxuICB7a2V5OiBcInJldFwiLCByZWc6IC9ecmV0dXJuLywgdmVyYm9zZTogXCJyZXR1cm5cIn0sXG4gIHtrZXk6IFwiaWZcIiwgcmVnOiAvXmlmIC99LFxuICB7a2V5OiBcIndoaWxlXCIsIHJlZzogL153aGlsZSAvfSxcbiAge2tleTogXCJ0cnlcIiwgcmVnOiAvXnRyeS99LFxuICB7a2V5OiBcImNhdGNoXCIsIHJlZzogL15jYXRjaC99LFxuICB7a2V5OiBcInRocm93XCIsIHJlZzogL150aHJvdyAvfSxcbiAge2tleTogXCJuZXdcIiwgcmVnOiAvXm5ldyAvfSxcbiAge2tleTogXCJ0YWdcIiwgcmVnOiAvXjxbYS16QS1aXVswLTlhLXpBLVpdezAsMjl9L30sXG4gIHtrZXk6IFwiPlwiLCByZWc6IC9ePi99LFxuICB7a2V5OiBcImVsc2VpZlwiLCByZWc6IC9eZWxzZWlmIC99LFxuICB7a2V5OiBcImVsc2VcIiwgcmVnOiAvXmVsc2UvfSxcbiAge2tleTogXCJmb3JfbG9vcFwiLCByZWc6IC9eZm9yIC8sIHZlcmJvc2U6IFwiZm9yIGxvb3BcIn0sXG4gIHtrZXk6IFwiaW5cIiwgcmVnOiAvXmluIC99LFxuICB7a2V5OiBcIm5vdFwiLCByZWc6IC9ebm90IC8sIHZlcmJvc2U6IFwibm90XCJ9LFxuICB7a2V5OiBcIm5hbWVcIiwgcmVnOiAvXlthLXpBLVpfJF1bMC05YS16QS1aXyRdezAsMjl9L30sXG4gIHtrZXk6IFwicmVnZXhwXCIsIGZ1bmM6IHJlZ0V4cERlZiwgdmVyYm9zZTogXCJyZWd1bGFyIGVwcmVzc2lvblwifSxcbiAge2tleTogXCJtYXRoX29wZXJhdG9yc1wiLCByZWc6IC9eKFxcK1xcK3xcXC1cXC0pLywgdmVyYm9zZTogXCJtYXRoIG9wZXJhdG9yXCJ9LFxuICB7a2V5OiBcImJpbmFyeV9vcGVyYXRvcnNcIiwgcmVnOiAvXihcXCZcXCZ8XFx8XFx8fFxcJnxcXHx8PDx8XFw+XFw+KS8sIHZlcmJvc2U6IFwiYmluYXJ5IG9wZXJhdG9yXCJ9LFxuICB7a2V5OiBcImNvbXBhcmlzb25cIiwgcmVnOiAvXig8PXw+PXw8fD58IT18PT0pL30sXG4gIHtrZXk6IFwiYXNzaWduXCIsIHJlZzogL14oXFwrPXwtPXw9fDo9KS99LFxuICB7a2V5OiBcIm51bWJlclwiLCByZWc6IC9eWy1dP1swLTldK1xcLj9bMC05XSovfSxcbiAge2tleTogXCJjb21tYVwiLCByZWc6IC9eXFwsL30sXG4gIHtrZXk6IFwiZG90XCIsIHJlZzogL15cXC4vfSxcbiAge2tleTogXCJjb2xvblwiLCByZWc6IC9eXFw6LywgdmVyYm9zZTogXCI6XCJ9LFxuICB7a2V5OiBcIm9wZW5fcGFyXCIsIHJlZzogL15cXCgvLCB2ZXJib3NlOiBcIihcIn0sXG4gIHtrZXk6IFwiY2xvc2VfcGFyXCIsIHJlZzogL15cXCkvLCB2ZXJib3NlOiBcIilcIn0sXG4gIHtrZXk6IFwib3Blbl9icmFcIiwgcmVnOiAvXlxcWy8sIHZlcmJvc2U6IFwiW1wifSxcbiAge2tleTogXCJjbG9zZV9icmFcIiwgcmVnOiAvXlxcXS8sIHZlcmJvc2U6IFwiXVwifSxcbiAge2tleTogXCJvcGVuX2N1cmx5XCIsIHJlZzogL15cXHsvLCB2ZXJib3NlOiBcIntcIn0sXG4gIHtrZXk6IFwiY2xvc2VfY3VybHlcIiwgcmVnOiAvXlxcfS8sIHZlcmJvc2U6IFwifVwifSxcbiAge2tleTogXCJtYXRoXCIsIHJlZzogL15bLXxcXCt8XFwqfFxcL3wlXS99LFxuICB7a2V5OiBcInNhbWVkZW50XCIsIGZ1bmM6IGRlbnQoXCJzYW1lZGVudFwiKSwgdmVyYm9zZTogXCJzYW1lIGluZGVudGF0aW9uXCJ9LFxuICB7a2V5OiBcImRlZGVudFwiLCBmdW5jOiBkZW50KFwiZGVkZW50XCIpfSxcbiAge2tleTogXCJpbmRlbnRcIiwgZnVuYzogZGVudChcImluZGVudFwiKX0sXG4gIHtrZXk6IFwiV1wiLCByZWc6IC9eWyBdLywgdmVyYm9zZTogXCJzaW5nbGUgd2hpdGVzcGFjZVwifVxuXTtcbmZ1bmN0aW9uIHN0YXJ0U3RyKGlucHV0LHN0cmVhbSkge1xuICB2YXIgbGFzdCA9IHN0cmVhbVtzdHJlYW0ubGVuZ3RoIC0gMV07XG4gIGlmKGxhc3QgJiYgbGFzdC52YWx1ZSA9PT0gXCJcXFxcXCIpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYoaW5wdXQubWF0Y2goL14jey8pKSB7XG4gICAgcmV0dXJuIFwiI3tcIjtcbiAgfVxufVxudmFyIHN0ckludGVycG9sYXRpb25Ub2tlbkRlZiA9IFtcbiAge2tleTogXCJzdGFydFwiLCBmdW5jOiBzdGFydFN0cn0sXG4gIHtrZXk6IFwiZW5kXCIsIHJlZzogL159L30sXG4gIHtrZXk6IFwibmFtZVwiLCByZWc6IC9eW2EtekEtWl8kXVswLTlhLXpBLVpfXXswLDI5fS99LFxuICB7a2V5OiBcImRvdFwiLCByZWc6IC9eXFwuL30sXG4gIHtrZXk6IFwiY2hhclwiLCByZWc6IC9eLi99XG5dO1xudmFyIHN0ckludGVycG9sYXRpb25HcmFtbWFyRGVmID0ge1xuICBTVEFSVDoge3J1bGVzOiBbXCJFTCogRU9GXCJdfSxcbiAgRUw6IHtydWxlczogW1wiVkFSXCIsIFwiY2hhclwiLCBcIm5hbWVcIiwgXCJzdGFydFwiLCBcImVuZFwiLCBcImRvdFwiXX0sXG4gIFZBUjoge3J1bGVzOiBbXCJzdGFydCBOQU1FIGVuZFwiXX0sXG4gIE5BTUU6IHtydWxlczogW1wibmFtZSBkb3QgTkFNRVwiLCBcIm5hbWVcIl19XG59O1xudmFyIHN0ckdyYW0gPSBlcGVnanMuY29tcGlsZUdyYW1tYXIoc3RySW50ZXJwb2xhdGlvbkdyYW1tYXJEZWYsIHN0ckludGVycG9sYXRpb25Ub2tlbkRlZik7XG5mdW5jdGlvbiBnZW5lcmF0ZVN0cmluZ0NvZGUobm9kZSxjKSB7XG4gIGlmKG5vZGUudHlwZSA9PT0gJ1ZBUicpIHtcbiAgICByZXR1cm4gYyArICcgKyAnICsgZ2VuZXJhdGVTdHJpbmdDb2RlKG5vZGUuY2hpbGRyZW5bMV0sIGMpICsgJyArICcgKyBjO1xuICB9XG4gIGlmKG5vZGUudmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9XG4gIHZhciBzdHIgPSAnJztcbiAgaWYoIW5vZGUuY2hpbGRyZW4pIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgdmFyIGNoaWxkcmVuID0gbm9kZS5jaGlsZHJlbjtcbiAgdmFyIF9rZXlzMSA9IE9iamVjdC5rZXlzKGNoaWxkcmVuKTtcbiAgZm9yKHZhciBfaW5kZXgxID0gMDsgX2luZGV4MSA8IF9rZXlzMS5sZW5ndGg7IF9pbmRleDErKykge1xuICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW19rZXlzMVtfaW5kZXgxXV07XG4gICAgc3RyICs9IGdlbmVyYXRlU3RyaW5nQ29kZShjaGlsZCwgYyk7XG4gIH1cbiAgcmV0dXJuIHN0cjtcbn1cbmZ1bmN0aW9uIGN1cnJlbnRMZXZlbCgpIHtcbiAgcmV0dXJuIGxldmVsU3RhY2tbbGV2ZWxTdGFjay5sZW5ndGggLSAxXTtcbn1cbmZ1bmN0aW9uIGluZGVudFR5cGUobCkge1xuICBpZihsID4gY3VycmVudExldmVsKCkpIHtcbiAgICByZXR1cm4gJ2luZGVudCc7XG4gIH1cbiAgaWYobCA8IGN1cnJlbnRMZXZlbCgpKSB7XG4gICAgcmV0dXJuICdkZWRlbnQnO1xuICB9XG4gIGlmKGwgPT09IGN1cnJlbnRMZXZlbCgpKSB7XG4gICAgcmV0dXJuICdzYW1lZGVudCc7XG4gIH1cbn1cbmZ1bmN0aW9uIGRlbnQoZGVudFR5cGUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIF9kZW50KGlucHV0KSB7XG4gICAgLy8gZW1wdHkgbGluZSBpcyBhIHNhbWVkZW50XG4gICAgdmFyIG0gPSBpbnB1dC5tYXRjaCgvXlxcbltcXHNdKi8pO1xuICAgIGlmKG0pIHtcbiAgICAgIHZhciBsaW5lcyA9IG1bMF0uc3BsaXQoXCJcXG5cIik7XG4gICAgICB2YXIgaW5kZW50ID0gbGluZXNbbGluZXMubGVuZ3RoIC0gMV0ubGVuZ3RoO1xuICAgICAgaWYoaW5kZW50VHlwZShpbmRlbnQpID09PSBkZW50VHlwZSkge1xuICAgICAgICBpZihkZW50VHlwZSA9PT0gJ2RlZGVudCcpIHtcbiAgICAgICAgICBsZXZlbFN0YWNrLnBvcCgpO1xuICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfVxuICAgICAgICBpZihkZW50VHlwZSA9PT0gJ2luZGVudCcpIHtcbiAgICAgICAgICBsZXZlbFN0YWNrLnB1c2goaW5kZW50KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbVswXTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG5mdW5jdGlvbiBzdHJpbmdEZWYoaW5wdXQpIHtcbiAgdmFyIGZpcnN0ID0gaW5wdXQuY2hhckF0KDApO1xuICBpZihmaXJzdCA9PT0gJ1wiJyB8fCBmaXJzdCA9PT0gXCInXCIpIHtcbiAgICB2YXIgaSA9IDE7XG4gICAgd2hpbGUoaW5wdXQuY2hhckF0KGkpKXtcbiAgICAgIHZhciBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxcXCcpIHtcbiAgICAgICAgaSsrO1xuICAgICAgfSBlbHNlIGlmKGNoID09PSBmaXJzdCkge1xuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSArIDEpO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgIH1cbiAgfVxufVxuZnVuY3Rpb24gcmVnRXhwRGVmKGlucHV0KSB7XG4gIGlmKGlucHV0LmNoYXJBdCgwKSA9PT0gJy8nKSB7XG4gICAgdmFyIGkgPSAxO1xuICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSl7XG4gICAgICB2YXIgY2ggPSBpbnB1dC5jaGFyQXQoaSk7XG4gICAgICBpZihjaCA9PT0gJ1xcXFwnKSB7XG4gICAgICAgIGkrKztcbiAgICAgIH0gZWxzZSBpZihjaCA9PT0gJy8nKSB7XG4gICAgICAgIGkrKzs7Ly8gbW9kaWZpZXJzXG4gICAgICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSAmJiBcImlnbVwiLmluZGV4T2YoaW5wdXQuY2hhckF0KGkpKSAhPT0gLTEpe1xuICAgICAgICAgIGkrKztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5mdW5jdGlvbiBkZWZEZWYoaW5wdXQpIHtcbiAgaWYoaW5wdXQubWF0Y2goL15kZWZbXFwofCB8XFxuXS8pKSB7XG4gICAgcmV0dXJuIFwiZGVmXCI7XG4gIH1cbiAgaWYoaW5wdXQuaW5kZXhPZihcImRvbSBcIikgPT09IDApIHtcbiAgICByZXR1cm4gXCJkb21cIjtcbiAgfVxufVxuZnVuY3Rpb24gY29tbWVudERlZihpbnB1dCkge1xuICB2YXIgbSA9IGlucHV0Lm1hdGNoKC9eIy8pO1xuICBpZihtKSB7XG4gICAgdmFyIGkgPSBtWzBdLmxlbmd0aDtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpe1xuICAgICAgdmFyIGNoID0gaW5wdXQuY2hhckF0KGkpO1xuICAgICAgaWYoY2ggPT09ICdcXG4nKSB7XG4gICAgICAgIHJldHVybiBpbnB1dC5zbGljZSgwLCBpKTtcbiAgICAgIH1cbiAgICAgIGkrKztcbiAgICB9XG4gIH1cbn1cbmZ1bmN0aW9uIHJlZmxlY3QocGFyYW1zKSB7IHJldHVybiBwYXJhbXM7IH1cbnZhciBncmFtbWFyRGVmID0ge1xuICBTVEFSVDoge3J1bGVzOiBbXCJMSU5FKiBFT0ZcIl19LFxuICBFTEM6IHtydWxlczogW1wiVyogY29tbWVudFwiXSwgdmVyYm9zZTogXCJjb21tZW50XCJ9LFxuICBMSU5FOiB7cnVsZXM6IFtcIlNUQVRFTUVOVCBFTEM/IHNhbWVkZW50K1wiLCBcIlNUQVRFTUVOVCBFTEM/ICFkZWRlbnRcIiwgXG4gICAgXCJFTEM/IHNhbWVkZW50XCIsIFwiRUxDICFkZWRlbnRcIl0sIHZlcmJvc2U6IFwibmV3IGxpbmVcIn0sXG4gIEJMT0NLOiB7cnVsZXM6IFtcImluZGVudCBMSU5FKyBkZWRlbnRcIl19LFxuICBTVEFURU1FTlQ6IHtydWxlczogW1wiQVNTSUdOXCIsIFwiRVhQUlwiLCBcIklGXCIsIFwiV0hJTEVcIiwgXCJGT1JcIiwgXCJSRVRVUk5cIiwgXG4gICAgXCJDTEFTU1wiLCBcIlRBR1wiLCBcIkRPTV9BU1NJR05cIiwgXCJUUllfQ0FUQ0hcIiwgXCJUSFJPV1wiXX0sXG4gIENMQVNTX01FVEhPRFM6IHtcbiAgICBydWxlczogW1wic2FtZWRlbnQqIGY6RlVOQ19ERUYgc2FtZWRlbnQqXCJdLFxuICAgIGhvb2tzOiBbZnVuY3Rpb24gKHApIHsgcmV0dXJuIHAuZjsgfV1cbiAgfSxcbiAgQ0xBU1M6IHtcbiAgICBydWxlczogW1xuICAgICAgXCJjbGFzcyBuOm5hbWUgb3Blbl9wYXIgcDpuYW1lIGNsb3NlX3BhciBpbmRlbnQgbTpDTEFTU19NRVRIT0RTKyBkZWRlbnRcIixcbiAgICAgIFwiY2xhc3MgbjpuYW1lIGluZGVudCBtOkNMQVNTX01FVEhPRFMrIGRlZGVudFwiXG4gICAgXSxcbiAgICBob29rczogW1xuICAgICAgZnVuY3Rpb24gKHApIHsgcmV0dXJuIHtuYW1lOiBwLm4sIG1ldGhvZHM6IHAubSwgcGFyZW50OiBwLnB9OyB9LFxuICAgICAgZnVuY3Rpb24gKHApIHsgcmV0dXJuIHtuYW1lOiBwLm4sIG1ldGhvZHM6IHAubX07IH1cbiAgICBdXG4gIH0sXG4gIEZVTkNfREVGX1BBUkFNUzoge3J1bGVzOiBbXG4gICAgXCJwMTpGVU5DX0RFRl9QQVJBTVMgY29tbWEgVyBwMjpGVU5DX0RFRl9QQVJBTVNcIixcbiAgICBcInAxOm5hbWUgYXNzaWduIGU6RVhQUlwiLFxuICAgIFwicDE6bmFtZVwiXG4gICAgXSxcbiAgICB2ZXJib3NlOiBcImRlZiBwYXJhbWV0ZXJzXCJcbiAgfSxcbiAgTEFNQkRBOiB7cnVsZXM6IFtcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBvcGVuX3BhciBwYXJhbXM6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgVyBibG9jazpFWFBSXCIsXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgVyBmbjpuYW1lIG9wZW5fcGFyIHBhcmFtczpGVU5DX0RFRl9QQVJBTVM/IGNsb3NlX3BhciBXIGJsb2NrOkVYUFJcIixcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGJsb2NrOkVYUFJcIlxuICAgIF0sXG4gICAgaG9va3M6IFtyZWZsZWN0LCByZWZsZWN0LCByZWZsZWN0XVxuICB9LFxuICBGVU5DX0RFRjoge3J1bGVzOiBbXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIGJsb2NrOkJMT0NLXCIsXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgVyBmbjpuYW1lIG9wZW5fcGFyIHBhcmFtczpGVU5DX0RFRl9QQVJBTVM/IGNsb3NlX3BhciBibG9jazpCTE9DS1wiLFxuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBibG9jazpCTE9DS1wiLFxuICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIGJsb2NrOkJMT0NLXCJcbiAgICBdLFxuICAgIGhvb2tzOiBbcmVmbGVjdCwgcmVmbGVjdCwgcmVmbGVjdCwgcmVmbGVjdF0sXG4gICAgdmVyYm9zZTogXCJkZWYgZGVmaW5pdGlvblwiXG4gIH0sXG4gIEVMU0VfSUY6IHtydWxlczogW1wic2FtZWRlbnQgZWxzZWlmIGU6RVhQUiBiOkJMT0NLXCJdLCBob29rczogW3JlZmxlY3RdfSxcbiAgRUxTRToge3J1bGVzOiBbXCJzYW1lZGVudCBlbHNlIGI6QkxPQ0tcIl0sIGhvb2tzOiBbcmVmbGVjdF19LFxuICBJRjoge3J1bGVzOiBbXCJpZiBlOkVYUFIgYjpCTE9DSyBlbGlmOkVMU0VfSUYqIGVsOkVMU0U/XCJdLCBob29rczogW3JlZmxlY3RdfSxcbiAgRUxTRV9FWFBSOiB7cnVsZXM6IFtcIlcgZWxzZSBXIGI6RVhQUlwiXSwgaG9va3M6IFtyZWZsZWN0XX0sXG4gIElGX0VYUFI6IHtydWxlczogW1wiZTpFWFBSIFcgaWYgdGVzdDpFWFBSIGVsOkVMU0VfRVhQUj9cIl0sIGhvb2tzOiBbcmVmbGVjdF19LFxuICBXSElMRToge3J1bGVzOiBbXCJ3aGlsZSBlOkVYUFIgYjpCTE9DS1wiXSwgaG9va3M6IFtyZWZsZWN0XX0sXG4gIE1BVEg6IHtydWxlczogW1wiZTE6RVhQUiBXIG9wOm1hdGggVyBlMjpFWFBSXCJdfSxcbiAgUEFUSDoge3J1bGVzOiBbXCJQQVRIIGRvdCBuYW1lXCIsIFwiUEFUSCBvcGVuX2JyYSBudW1iZXIgY2xvc2VfYnJhXCIsIFwibmFtZVwiXX0sXG4gIEFTU0lHTjoge3J1bGVzOiBbXG4gICAgXCJsZWZ0OkVYUFIgVyBvcDphc3NpZ24gVyByaWdodDpFWFBSXCIsXG4gICAgXCJsZWZ0OlNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUiBXIG9wOmFzc2lnbiBXIHJpZ2h0OlNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUlwiLFxuICAgIFwibGVmdDpTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFIgVyBvcDphc3NpZ24gVyByaWdodDpFWFBSXCJcbiAgXSwgaG9va3M6IFtyZWZsZWN0LCByZWZsZWN0LCByZWZsZWN0XX0sXG4gIFdfT1JfU0FNRURFTlQ6IHtydWxlczogW1wiV1wiLCBcInNhbWVkZW50XCJdLCB2ZXJib3NlOiBcInNhbWVkZW50IG9yIHdoaXRlc3BhY2VcIn0sXG4gIFdfU0FNRURFTlRfSU5ERU5UOiB7cnVsZXM6IFtcIldcIiwgXCJzYW1lZGVudFwiLCBcImluZGVudFwiXSwgdmVyYm9zZTogXCJpbmRlbnQgb3Igc2FtZWRlbnQgb3Igd2hpdGVzcGFjZVwifSxcbiAgQU5ZX1NQQUNFOiB7cnVsZXM6IFtcIldcIiwgXCJzYW1lZGVudFwiLCBcImluZGVudFwiLCBcImRlZGVudFwiXSwgdmVyYm9zZTogXCJhbnkgc3BhY2VcIn0sXG4gIEZVTkNfQ0FMTF9QQVJBTVM6IHtydWxlczogW1wiRVhQUiBjb21tYSBBTllfU1BBQ0UrIEZVTkNfQ0FMTF9QQVJBTVMgQU5ZX1NQQUNFKlwiLCBcIkVYUFIgQU5ZX1NQQUNFKlwiXX0sXG4gIEZVTkNfQ0FMTDoge3J1bGVzOiBbXG4gICAgXCJvcGVuX3BhciBGVU5DX0NBTExfUEFSQU1TPyBjbG9zZV9wYXJcIlxuICBdfSxcbiAgVFlQRToge3J1bGVzOiBbXCJuYW1lIGNvbG9uXCJdfSxcbiAgRk9SOiB7cnVsZXM6IFtcbiAgICBcImZvcl9sb29wIGs6bmFtZSBjb21tYSBXIHY6bmFtZSBXIGluIHQ6VFlQRT8gYTpuYW1lIGI6QkxPQ0tcIixcbiAgICBcImZvcl9sb29wIHY6bmFtZSBXIGluIHQ6VFlQRT8gYTpuYW1lIGI6QkxPQ0tcIl0sXG4gICAgaG9va3M6IFtyZWZsZWN0LCByZWZsZWN0XVxuICB9LFxuICBTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFI6IHtydWxlczogW1xuICAgIFwiZTE6RVhQUiBjb21tYSBXIGUyOlNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUlwiLFxuICAgIFwiZTE6RVhQUiBjb21tYSBXIGUyOkVYUFJcIlxuICBdLFxuICBob29rczogW1xuICAgIGZ1bmN0aW9uIChwKSB7IHJldHVybiBbcC5lMV0uY29uY2F0KHAuZTIuY2hpbGRyZW4pOyB9LCBmdW5jdGlvbiAocCkgeyByZXR1cm4gW3AuZTEsIHAuZTJdOyB9XG4gIF0gXG4gIH0sXG4gIENPTU1BX1NFUEFSQVRFRF9FWFBSOiB7cnVsZXM6IFtcbiAgICBcIkVYUFIgY29tbWEgQU5ZX1NQQUNFKyBDT01NQV9TRVBBUkFURURfRVhQUiBBTllfU1BBQ0UqXCIsXG4gICAgXCJFWFBSIEFOWV9TUEFDRSpcIlxuICBdfSxcbiAgQVJSQVk6IHtydWxlczogW1xuICAgIFwib3Blbl9icmEgQU5ZX1NQQUNFKiBjOkNPTU1BX1NFUEFSQVRFRF9FWFBSPyBBTllfU1BBQ0UqIGNsb3NlX2JyYVwiXG4gIF19LFxuICBNRU1CRVJTOiB7cnVsZXM6IFtcbiAgICBcIm5hbWUgY29sb24gVyBFWFBSIHNhbWVkZW50PyBjb21tYSBBTllfU1BBQ0UrIE1FTUJFUlMgQU5ZX1NQQUNFKlwiLFxuICAgIFwibmFtZSBjb2xvbiBXIEVYUFIgQU5ZX1NQQUNFKlwiXG4gIF19LFxuICBPQkpFQ1Q6IHtydWxlczogW1xuICAgIFwib3Blbl9jdXJseSBpbmRlbnQ/IE1FTUJFUlM/IGNsb3NlX2N1cmx5XCJcbiAgXX0sXG4gIFRBR19QQVJBTVM6IHtydWxlczogW1xuICAgIFwibGVmdDpUQUdfUEFSQU1TIFcgcmlnaHQ6VEFHX1BBUkFNU1wiLFxuICAgIFwibjpuYW1lIGFzc2lnbiBlOkVYUFJcIixcbiAgICBcIm46bmFtZVwiXG4gICAgXSxcbiAgICBob29rczogW3JlZmxlY3QsIHJlZmxlY3QsIHJlZmxlY3RdLFxuICAgIHZlcmJvc2U6IFwidGFnIHBhcmFtZXRlcnNcIlxuICB9LFxuICBUQUc6IHtydWxlczogW1xuICAgIFwidGFnOnRhZyBXPyBwYXJhbXM6VEFHX1BBUkFNUz8gZW5kOj4/IGJsb2NrOkJMT0NLP1wiXG4gIF0sXG4gIGhvb2tzOiBbcmVmbGVjdF1cbiAgfSxcbiAgRE9NX0FTU0lHTjoge3J1bGVzOiBbXG4gICAgXCJhc3NpZ24gRVhQUlwiXG4gIF19LFxuICBUUllfQ0FUQ0g6IHtydWxlczogW1xuICAgIFwidHJ5IGIxOkJMT0NLIHNhbWVkZW50PyBjYXRjaCBvcGVuX3BhciBlcnI6bmFtZT8gY2xvc2VfcGFyIGIyOkJMT0NLXCJcbiAgICBdLFxuICAgIGhvb2tzOiBbcmVmbGVjdF1cbiAgfSxcbiAgVEhST1c6IHtydWxlczogW1xuICAgIFwidGhyb3cgRVhQUlwiXG4gIF19LFxuICBSRVRVUk46IHtydWxlczogW1wicmV0IFcgU1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSXCIsIFwicmV0IFcgRVhQUlwiLCBcInJldFwiXX0sXG4gIFJJR0hUX0VYUFI6IHtydWxlczogW1xuICAgIFwibWF0aF9vcGVyYXRvcnNcIixcbiAgICBcIlcgYmluYXJ5X29wZXJhdG9ycyBXIEVYUFJcIixcbiAgICBcIlcgY29tcGFyaXNvbiBXIEVYUFJcIixcbiAgICBcIlcgPiBXIEVYUFJcIixcbiAgICBcImRvdCBFWFBSXCIsXG4gICAgXCJvcGVuX2JyYSBFWFBSIGNsb3NlX2JyYVwiLFxuICAgIFwiRlVOQ19DQUxMXCJcbiAgICBdLFxuICAgIHZlcmJvc2U6IFwiZXhwcmVzc2lvblwiXG4gIH0sXG4gIEVYUFI6IHtydWxlczogW1xuICAgIFwiSUZfRVhQUlwiLFxuICAgIFwiTUFUSFwiLFxuICAgIFwiT0JKRUNUXCIsXG4gICAgXCJGVU5DX0RFRlwiLFxuICAgIFwiRVhQUiBSSUdIVF9FWFBSXCIsXG4gICAgXCJuYW1lXCIsXG4gICAgXCJudW1iZXJcIixcbiAgICBcIkxBTUJEQVwiLFxuICAgIFwic3RyaW5nXCIsXG4gICAgXCJyZWdleHBcIixcbiAgICBcIm9wZW5fcGFyIEVYUFIgY2xvc2VfcGFyXCIsXG4gICAgXCJuZXcgRVhQUlwiLFxuICAgIFwibm90IEVYUFJcIixcbiAgICBcIkFSUkFZXCJcbiAgICBdLFxuICAgIHZlcmJvc2U6IFwiZXhwcmVzc2lvblwiXG4gIH1cbn07XG5mdW5jdGlvbiBzcGFjZXIobikge1xuICB2YXIgb3V0ID0gXCJcIjtcbiAgdmFyIGkgPSAwO1xuICB3aGlsZShpIDwgbil7XG4gICAgb3V0ICs9IFwiIFwiO1xuICAgIGkrKztcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuZnVuY3Rpb24gc3AobW9kKSB7XG4gIGlmKG1vZCkge1xuICAgIHJldHVybiBzcGFjZXIoMiAqIChkZXB0aCArIG1vZCkpO1xuICB9XG4gIHJldHVybiBzcGFjZXIoMiAqIGRlcHRoKTtcbn1cbnZhciBuYyA9IDE7Oy8vIGNoaWxkcmVuIG5hbWVcbmZ1bmN0aW9uIENOKCkge1xuICByZXR1cm4gJ19fYycgKyBuYztcbn1cbmZ1bmN0aW9uIHB1c2hDTigpIHtcbiAgbmMrKztcbiAgcmV0dXJuICdfX2MnICsgbmM7XG59XG5mdW5jdGlvbiBwb3BDTigpIHtcbiAgbmMtLTtcbiAgcmV0dXJuICdfX2MnICsgbmM7XG59XG52YXIgYmFja2VuZCA9IHtcbiAgZGVkZW50OiBmdW5jdGlvbiAobm9kZSkge1xuICAgIGRlcHRoID0gTWF0aC5tYXgoMCwgZGVwdGggLSAxKTtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgLFxuICBpbmRlbnQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgZGVwdGggPSBkZXB0aCArIDE7XG4gICAgcmV0dXJuICdcXG4nICsgc3AoKTtcbiAgfVxuICAsXG4gIHNhbWVkZW50OiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnXFxuJyArIHNwKCk7XG4gIH1cbiAgLFxuICBET01fQVNTSUdOOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBuYW1lID0gQ04oKTtcbiAgICByZXR1cm4gbmFtZSArICcucHVzaChTdHJpbmcoJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzFdKSArICcpKSc7XG4gIH1cbiAgLFxuICBUQUdfUEFSQU1TOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ubGVmdCkge1xuICAgICAgcmV0dXJuIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmxlZnQpICsgJywgJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnJpZ2h0KTtcbiAgICB9XG4gICAgaWYobm9kZS5jaGlsZHJlbi5lKSB7XG4gICAgICByZXR1cm4gbm9kZS5jaGlsZHJlbi5uLnZhbHVlICsgJzogJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbm9kZS5jaGlsZHJlbi5uLnZhbHVlICsgJzogdHJ1ZSc7XG4gICAgfVxuICB9XG4gICxcbiAgVEFHOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHIgPSAnJztcbiAgICB2YXIgcGFyYW1zID0gXCJ7XCI7XG4gICAgdmFyIG5hbWUgPSBub2RlLmNoaWxkcmVuLnRhZy52YWx1ZS5zdWJzdHJpbmcoMSk7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5wYXJhbXMpIHtcbiAgICAgIHBhcmFtcyArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMpO1xuICAgIH1cbiAgICBwYXJhbXMgKz0gJ30nO1xuICAgIHZhciBzdWIgPSAnW10nO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uYmxvY2spIHtcbiAgICAgIHN1YiA9IHB1c2hDTigpO1xuICAgICAgc3RyICs9ICcnICsgQ04oKSArICcgPSBbXSc7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYmxvY2spO1xuICAgICAgcG9wQ04oKTtcbiAgICB9XG4gICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyBDTigpICsgJy5wdXNoKGgoXCInICsgbmFtZSArICdcIiwgJyArIHBhcmFtcyArICcsICcgKyBzdWIgKyAnKSknO1xuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgLFxuICBDTEFTUzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgbmFtZSA9IG5vZGUuY2hpbGRyZW4ubmFtZS52YWx1ZTtcbiAgICB2YXIgZnVuY3MgPSBub2RlLmNoaWxkcmVuLm1ldGhvZHM7XG4gICAgdmFyIHBhcmVudCA9IG5vZGUuY2hpbGRyZW4ucGFyZW50O1xuICAgIHZhciBzdHIgPSAnJztcbiAgICB2YXIgY29uc3RydWN0b3IgPSBudWxsO1xuICAgIHZhciBfa2V5czIgPSBPYmplY3Qua2V5cyhmdW5jcyk7XG4gICAgZm9yKHZhciBfaW5kZXgyID0gMDsgX2luZGV4MiA8IF9rZXlzMi5sZW5ndGg7IF9pbmRleDIrKykge1xuICAgICAgdmFyIGZ1bmMgPSBmdW5jc1tfa2V5czJbX2luZGV4Ml1dO1xuICAgICAgdmFyIGZ1bmNfZGVmID0gZnVuYy5jaGlsZHJlbjtcbiAgICAgIHZhciBmdW5jX25hbWUgPSBmdW5jX2RlZi5jaGlsZHJlbi5mbi52YWx1ZTtcbiAgICAgIGlmKGZ1bmNfbmFtZSA9PT0gJ2NvbnN0cnVjdG9yJykge1xuICAgICAgICBjb25zdHJ1Y3RvciA9IGZ1bmNfZGVmO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyICs9ICdcXG4nICsgc3AoKSArIG5hbWUgKyAnLnByb3RvdHlwZS4nICsgZnVuY19uYW1lICsgJyA9ICcgKyBnZW5lcmF0ZUNvZGUoZnVuY19kZWYpO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBuc1tuYW1lXSA9IHRydWU7XG4gICAgbnMgPSBuZXdOcygpO1xuICAgIHZhciBwYXJhbXMgPSBjb25zdHJ1Y3RvciAmJiBjb25zdHJ1Y3Rvci5jaGlsZHJlbi5wYXJhbXM7XG4gICAgaWYocGFyYW1zKSB7XG4gICAgICBwYXJhbXMgPSBnZW5lcmF0ZUNvZGUocGFyYW1zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGFyYW1zID0gJyc7XG4gICAgfVxuICAgIHZhciBib2R5ID0gY29uc3RydWN0b3IgJiYgY29uc3RydWN0b3IuY2hpbGRyZW4uYmxvY2s7XG4gICAgdmFyIGNvbnNfc3RyID0gJycgKyBuYW1lICsgJyA9IGZ1bmN0aW9uICcgKyBuYW1lICsgJygnICsgcGFyYW1zICsgJykgeyc7XG4gICAgY29uc19zdHIgKz0gJ1xcbicgKyBzcCgxKSArICdpZighKHRoaXMgaW5zdGFuY2VvZiAnICsgbmFtZSArICcpKXsgcmV0dXJuIG5ldyAnICsgbmFtZSArICcoJyArIE9iamVjdC5rZXlzKG5zKS5qb2luKCcsJykgKyAnKX0nO1xuICAgIHZhciBfa2V5czMgPSBPYmplY3Qua2V5cyhucyk7XG4gICAgZm9yKHZhciBfaW5kZXgzID0gMDsgX2luZGV4MyA8IF9rZXlzMy5sZW5ndGg7IF9pbmRleDMrKykge1xuICAgICAgdmFyIGtleSA9IF9rZXlzM1tfaW5kZXgzXTtcbiAgICAgIHZhciB2YWx1ZSA9IG5zW19rZXlzM1tfaW5kZXgzXV07XG4gICAgICBpZih2YWx1ZSAhPT0gdHJ1ZSAmJiB2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnNfc3RyICs9ICdcXG4nICsgc3AoMSkgKyAnaWYoJyArIGtleSArICcgPT09IHVuZGVmaW5lZCkgeycgKyBrZXkgKyAnID0gJyArIGdlbmVyYXRlQ29kZSh2YWx1ZSkgKyAnfSc7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGJvZHkpIHtcbiAgICAgIGNvbnNfc3RyICs9IGdlbmVyYXRlQ29kZShib2R5KTtcbiAgICB9XG4gICAgY29uc19zdHIgKz0gc3AoKSArICdcXG59JztcbiAgICBpZihwYXJlbnQpIHtcbiAgICAgIGNvbnNfc3RyICs9ICdcXG4nICsgc3AoKSArICcnICsgbmFtZSArICcucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSgnICsgcGFyZW50LnZhbHVlICsgJy5wcm90b3R5cGUpJztcbiAgICAgIGNvbnNfc3RyICs9ICdcXG4nICsgc3AoKSArICcnICsgbmFtZSArICcucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gJyArIG5hbWUgKyAnJztcbiAgICB9XG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICByZXR1cm4gY29uc19zdHIgKyBzdHI7XG4gIH1cbiAgLFxuICBMQU1CREE6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIG5hbWUgPSBcIlwiO1xuICAgIHZhciBucyA9IG5ld05zKCk7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5mbikge1xuICAgICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICBuc1tuYW1lXSA9IHRydWU7XG4gICAgfVxuICAgIHZhciBzdHIgPSBcImZ1bmN0aW9uIFwiICsgbmFtZSArIFwiKFwiO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ucGFyYW1zKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucGFyYW1zLCBucyk7XG4gICAgfVxuICAgIHN0ciArPSAnKSB7JztcbiAgICB2YXIgX2tleXM0ID0gT2JqZWN0LmtleXMobnMpO1xuICAgIGZvcih2YXIgX2luZGV4NCA9IDA7IF9pbmRleDQgPCBfa2V5czQubGVuZ3RoOyBfaW5kZXg0KyspIHtcbiAgICAgIHZhciBrZXkgPSBfa2V5czRbX2luZGV4NF07XG4gICAgICB2YXIgdmFsdWUgPSBuc1tfa2V5czRbX2luZGV4NF1dO1xuICAgICAgaWYodmFsdWUgIT09IHRydWUgJiYgdmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICB2YXIgY29kZSA9IGdlbmVyYXRlQ29kZSh2YWx1ZSk7XG4gICAgICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgJ2lmKCcgKyBrZXkgKyAnID09PSB1bmRlZmluZWQpIHsnICsga2V5ICsgJyA9ICcgKyBjb2RlICsgJ30nO1xuICAgICAgfVxuICAgIH1cbiAgICBpZihub2RlLmNoaWxkcmVuLmJsb2NrKSB7XG4gICAgICBzdHIgKz0gJyByZXR1cm4gJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrLCBucyk7XG4gICAgfVxuICAgIG5hbWVzcGFjZXMucG9wKCk7XG4gICAgcmV0dXJuIHN0ciArIFwiOyB9XCI7XG4gIH1cbiAgLFxuICBGVU5DX0RFRjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgbmFtZSA9IFwiXCI7XG4gICAgdmFyIG5zID0gY3VycmVudE5zKCk7XG4gICAgdmFyIGlzX2RvbSA9IG5vZGUuY2hpbGRyZW4uZmQudmFsdWUgPT09ICdkb20nO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uZm4pIHtcbiAgICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuLmZuLnZhbHVlO1xuICAgICAgbnNbbmFtZV0gPSB0cnVlO1xuICAgIH1cbiAgICBucyA9IG5ld05zKCk7XG4gICAgdmFyIHN0ciA9IFwiZnVuY3Rpb24gXCIgKyBuYW1lICsgXCIoXCI7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5wYXJhbXMpIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMpO1xuICAgIH1cbiAgICBzdHIgKz0gJykgeyc7XG4gICAgdmFyIF9rZXlzNSA9IE9iamVjdC5rZXlzKG5zKTtcbiAgICBmb3IodmFyIF9pbmRleDUgPSAwOyBfaW5kZXg1IDwgX2tleXM1Lmxlbmd0aDsgX2luZGV4NSsrKSB7XG4gICAgICB2YXIga2V5ID0gX2tleXM1W19pbmRleDVdO1xuICAgICAgdmFyIHZhbHVlID0gbnNbX2tleXM1W19pbmRleDVdXTtcbiAgICAgIGlmKHZhbHVlICE9PSB0cnVlICYmIHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdmFyIGNvZGUgPSBnZW5lcmF0ZUNvZGUodmFsdWUpO1xuICAgICAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArICdpZignICsga2V5ICsgJyA9PT0gdW5kZWZpbmVkKSB7JyArIGtleSArICcgPSAnICsgY29kZSArICc7fSc7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGlzX2RvbSkge1xuICAgICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyAnJyArIENOKCkgKyAnID0gW107JztcbiAgICB9XG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrKTtcbiAgICB9XG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICBpZihpc19kb20pIHtcbiAgICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgJ3JldHVybiAnICsgQ04oKSArICc7JztcbiAgICB9XG4gICAgcmV0dXJuIHN0ciArICdcXG4nICsgc3AoKSArICd9JztcbiAgfVxuICAsXG4gIEZVTkNfREVGX1BBUkFNUzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyID0gXCJcIjtcbiAgICB2YXIgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBpZihub2RlLmNoaWxkcmVuWzBdLnR5cGUgPT09ICduYW1lJykge1xuICAgICAgbnNbbm9kZS5jaGlsZHJlblswXS52YWx1ZV0gPSB0cnVlO1xuICAgICAgaWYobm9kZS5jaGlsZHJlblsxXSAmJiBub2RlLmNoaWxkcmVuWzFdLnR5cGUgPT09ICdhc3NpZ24nKSB7XG4gICAgICAgIG5zW25vZGUuY2hpbGRyZW5bMF0udmFsdWVdID0gbm9kZS5jaGlsZHJlblsyXTtcbiAgICAgIH1cbiAgICB9Oy8vIFRPRE86IGZpeCB0aGlzXG4gICAgdmFyIGNoaWxkcmVuID0gbm9kZS5jaGlsZHJlbjtcbiAgICB2YXIgX2tleXM2ID0gT2JqZWN0LmtleXMoY2hpbGRyZW4pO1xuICAgIGZvcih2YXIgX2luZGV4NiA9IDA7IF9pbmRleDYgPCBfa2V5czYubGVuZ3RoOyBfaW5kZXg2KyspIHtcbiAgICAgIHZhciBuID0gY2hpbGRyZW5bX2tleXM2W19pbmRleDZdXTtcbiAgICAgIGlmKG4udHlwZSA9PT0gJ25hbWUnIHx8IG4udHlwZSA9PT0gJ0ZVTkNfREVGX1BBUkFNUycgfHwgbi50eXBlID09PSAnY29tbWEnIHx8IG4udHlwZSA9PT0gJ3dpbmRvdycpIHtcbiAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShuKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuICAsXG4gIEFTU0lHTjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgcHJlZml4ID0gXCJcIjtcbiAgICB2YXIgc3RyID0gXCJcIjtcbiAgICB2YXIgb3AgPSBub2RlLmNoaWxkcmVuLm9wLnZhbHVlO1xuICAgIHZhciBleHBsaWNpdF9nbG9iYWwgPSBvcCA9PT0gJzo9JztcbiAgICBpZihleHBsaWNpdF9nbG9iYWwpIHtcbiAgICAgIG9wID0gJz0nO1xuICAgIH1cbiAgICB2YXIgbnMgPSBjdXJyZW50TnMoKTtcbiAgICB2YXIgbGVmdCA9IG5vZGUuY2hpbGRyZW4ubGVmdDtcbiAgICB2YXIgcmlnaHRfY29kZSA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnJpZ2h0KTtcbiAgICBpZihsZWZ0LnR5cGUgPT09ICdTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFInKSB7XG4gICAgICB1bnBhY2tpbmcrKztcbiAgICAgIHZhciB1bnBhY2tfbmFtZSA9ICdfX3VucGFjaycgKyB1bnBhY2tpbmc7XG4gICAgICBzdHIgKz0gJ3ZhciAnICsgdW5wYWNrX25hbWUgKyBcIiA9IFwiICsgcmlnaHRfY29kZSArIFwiXFxuXCIgKyBzcCgpO1xuICAgICAgdmFyIGNoaWxkcmVuID0gbGVmdC5jaGlsZHJlbjtcbiAgICAgIHZhciBpID0gMDtcbiAgICAgIHZhciBfa2V5czcgPSBPYmplY3Qua2V5cyhjaGlsZHJlbik7XG4gICAgICBmb3IodmFyIF9pbmRleDcgPSAwOyBfaW5kZXg3IDwgX2tleXM3Lmxlbmd0aDsgX2luZGV4NysrKSB7XG4gICAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW19rZXlzN1tfaW5kZXg3XV07XG4gICAgICAgIHZhciBuID0gY2hpbGQuY2hpbGRyZW5bMF07XG4gICAgICAgIHByZWZpeCA9IFwiXCI7XG4gICAgICAgIGlmKG4udHlwZSA9PT0gJ25hbWUnKSB7XG4gICAgICAgICAgaWYoY3VycmVudE5zSGFzKG4udmFsdWUpID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIG5zW24udmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmKCFleHBsaWNpdF9nbG9iYWwpIHtcbiAgICAgICAgICAgICAgcHJlZml4ID0gJyc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHN0ciArPSBwcmVmaXggKyBnZW5lcmF0ZUNvZGUobikgKyAnICcgKyBvcCArICcgJyArIHVucGFja19uYW1lICsgJ1snICsgaSArICddO1xcbicgKyBzcCgpO1xuICAgICAgICBpKys7XG4gICAgICB9XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgICBpZihsZWZ0LmNoaWxkcmVuWzBdLnR5cGUgPT09ICduYW1lJykge1xuICAgICAgdmFyIGNoID0gbGVmdC5jaGlsZHJlblswXTtcbiAgICAgIGlmKCFjdXJyZW50TnNIYXMoY2gudmFsdWUpKSB7XG4gICAgICAgIGlmKCFleHBsaWNpdF9nbG9iYWwpIHtcbiAgICAgICAgICBwcmVmaXggPSAndmFyICc7XG4gICAgICAgIH1cbiAgICAgICAgbnNbY2gudmFsdWVdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHByZWZpeCArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmxlZnQpICsgJyAnICsgb3AgKyAnICcgKyByaWdodF9jb2RlO1xuICB9XG4gICxcbiAgU1RBVEVNRU5UOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBlID0gbm9kZS5jaGlsZHJlblswXS5jaGlsZHJlblswXTs7Ly8gVE9ETzogdGhpcyBzaG91bGQgYmUgcG9zc2libGVcbiAgICB2YXIgdCA9IG5vZGUuY2hpbGRyZW5bMF0udHlwZTtcbiAgICB2YXIgb3RoZXIgPSBlICYmIChlLnR5cGUgPT09ICdGVU5DX0RFRicgfHwgZS50eXBlID09PSAnTEFNQkRBJyB8fCBlLnR5cGUgPT09ICdDT01NRU5UJyk7XG4gICAgaWYodCA9PT0gJ0ZPUicgfHwgdCA9PT0gJ1RSWV9DQVRDSCcgfHwgdCA9PT0gJ1dISUxFJyB8fCB0ID09PSAnSUYnIHx8IHQgPT09ICdDT01NRU5UJyB8fCBvdGhlcikge1xuICAgICAgcmV0dXJuIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzBdKTtcbiAgICB9XG4gICAgcmV0dXJuIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzBdKSArICc7JztcbiAgfVxuICAsXG4gIElGOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHIgPSAnJztcbiAgICBzdHIgPSAnaWYoJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJykgeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgICB2YXIgZWxpZiA9IG5vZGUuY2hpbGRyZW4uZWxpZjtcbiAgICBpZihlbGlmKSB7XG4gICAgICBpZihBcnJheS5pc0FycmF5KGVsaWYpKSB7XG4gICAgICAgIHZhciBfa2V5czggPSBPYmplY3Qua2V5cyhlbGlmKTtcbiAgICAgICAgZm9yKHZhciBfaW5kZXg4ID0gMDsgX2luZGV4OCA8IF9rZXlzOC5sZW5ndGg7IF9pbmRleDgrKykge1xuICAgICAgICAgIHZhciB2YWx1ZSA9IGVsaWZbX2tleXM4W19pbmRleDhdXTtcbiAgICAgICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShlbGlmKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYobm9kZS5jaGlsZHJlbi5lbCkge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmVsKTtcbiAgICB9XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuICAsXG4gIElGX0VYUFI6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciA9ICcnO1xuICAgIHN0ciA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnRlc3QpICsgJyA/ICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcgOiAnO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uZWwpIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciArPSAndW5kZWZpbmVkJztcbiAgICB9XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuICAsXG4gIEVMU0VfRVhQUjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYik7XG4gIH1cbiAgLFxuICBXSElMRTogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJ3doaWxlKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcpeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgfVxuICAsXG4gIEZPUjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIga2V5SW5kZXhOYW1lID0gXCJfaW5kZXhcIiArIGZvckxvb3BDb3VudDtcbiAgICB2YXIga2V5QXJyYXlOYW1lID0gXCJfa2V5c1wiICsgZm9yTG9vcENvdW50O1xuICAgIGZvckxvb3BDb3VudCsrO1xuICAgIHZhciBpbmRleE5hbWUgPSBmYWxzZTtcbiAgICBpZihub2RlLmNoaWxkcmVuLmspIHtcbiAgICAgIGluZGV4TmFtZSA9IG5vZGUuY2hpbGRyZW4uay52YWx1ZTtcbiAgICB9XG4gICAgdmFyIHN0ciA9ICd2YXIgJyArIGtleUFycmF5TmFtZSArICcgPSBPYmplY3Qua2V5cygnICsgbm9kZS5jaGlsZHJlbi5hLnZhbHVlICsgJyk7XFxuJztcbiAgICBzdHIgKz0gc3AoKSArICdmb3IodmFyICcgKyBrZXlJbmRleE5hbWUgKyAnID0gMDsgJyArIGtleUluZGV4TmFtZSArICcgPCAnICsga2V5QXJyYXlOYW1lICsgJy5sZW5ndGg7ICcgKyBrZXlJbmRleE5hbWUgKyAnKyspIHtcXG4nO1xuICAgIGlmKGluZGV4TmFtZSkge1xuICAgICAgc3RyICs9IHNwKDEpICsgJ3ZhciAnICsgaW5kZXhOYW1lICsgJyA9ICcgKyBrZXlBcnJheU5hbWUgKyAnWycgKyBrZXlJbmRleE5hbWUgKyAnXTtcXG4nO1xuICAgIH1cbiAgICBzdHIgKz0gc3AoMSkgKyAndmFyICcgKyBub2RlLmNoaWxkcmVuLnYudmFsdWUgKyAnID0gJyArIG5vZGUuY2hpbGRyZW4uYS52YWx1ZSArICdbJyArIGtleUFycmF5TmFtZSArICdbJyArIGtleUluZGV4TmFtZSArICddXTsnO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgRUxTRV9JRjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyBlbHNlIGlmKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcpIHsnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYikgKyAnXFxuJyArIHNwKCkgKyAnfSc7XG4gIH1cbiAgLFxuICBFTFNFOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnIGVsc2UgeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgfVxuICAsXG4gIFRSWV9DQVRDSDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyID0gXCJ0cnkge1wiO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iMSk7XG4gICAgc3RyICs9ICdcXG4nICsgc3AoKSArIFwifSBjYXRjaChcIiArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmVycikgKyBcIikge1wiO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iMik7XG4gICAgcmV0dXJuIHN0ciArICdcXG4nICsgc3AoKSArIFwifVwiO1xuICB9XG4gICxcbiAgU1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBlbGVtZW50cyA9IFtdO1xuICAgIHZhciBjaGlsZHJlbiA9IG5vZGUuY2hpbGRyZW47XG4gICAgdmFyIF9rZXlzOSA9IE9iamVjdC5rZXlzKGNoaWxkcmVuKTtcbiAgICBmb3IodmFyIF9pbmRleDkgPSAwOyBfaW5kZXg5IDwgX2tleXM5Lmxlbmd0aDsgX2luZGV4OSsrKSB7XG4gICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltfa2V5czlbX2luZGV4OV1dO1xuICAgICAgZWxlbWVudHMucHVzaChnZW5lcmF0ZUNvZGUoY2hpbGQpKTtcbiAgICB9XG4gICAgcmV0dXJuICdbJyArIGVsZW1lbnRzLmpvaW4oXCIsIFwiKSArICddJztcbiAgfVxuICAsXG4gIHN0cmluZzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgdiA9IG5vZGUudmFsdWU7XG4gICAgdiA9IHYucmVwbGFjZSgvXFxuL2csIFwiXFxcXG5cIik7XG4gICAgdmFyIGFzdCA9IHN0ckdyYW0ucGFyc2Uodik7XG4gICAgaWYoIWFzdC5jb21wbGV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGFzdC5oaW50KTtcbiAgICB9XG4gICAgcmV0dXJuIGdlbmVyYXRlU3RyaW5nQ29kZShhc3QsIHYuY2hhckF0KDApKTtcbiAgfVxuICAsXG4gIGNvbW1lbnQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuIG5vZGUudmFsdWUucmVwbGFjZSgvXiMvZywgXCIvL1wiKTtcbiAgfVxuICAsXG4gIG5vdDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyEnO1xuICB9XG4gICxcbiAgY29tcGFyaXNvbjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICBpZihub2RlLnZhbHVlID09PSAnPT0nKSB7XG4gICAgICByZXR1cm4gJz09PSc7XG4gICAgfVxuICAgIGlmKG5vZGUudmFsdWUgPT09ICchPScpIHtcbiAgICAgIHJldHVybiAnIT09JztcbiAgICB9XG4gICAgcmV0dXJuIG5vZGUudmFsdWU7XG4gIH1cbn07XG5mdW5jdGlvbiBnZW5lcmF0ZUNvZGUobm9kZSkge1xuICBpZighbm9kZSkge1xuICAgIC8vIGRlYnVnZ2VyXG4gIH1cbiAgaWYoYmFja2VuZFtub2RlLnR5cGVdKSB7XG4gICAgcmV0dXJuIGJhY2tlbmRbbm9kZS50eXBlXShub2RlKTtcbiAgfVxuICBpZihub2RlLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgfVxuICB2YXIgc3RyID0gXCJcIjtcbiAgaWYoIW5vZGUuY2hpbGRyZW4pIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgdmFyIGNoaWxkcmVuID0gbm9kZS5jaGlsZHJlbjtcbiAgdmFyIF9rZXlzMTAgPSBPYmplY3Qua2V5cyhjaGlsZHJlbik7XG4gIGZvcih2YXIgX2luZGV4MTAgPSAwOyBfaW5kZXgxMCA8IF9rZXlzMTAubGVuZ3RoOyBfaW5kZXgxMCsrKSB7XG4gICAgdmFyIGNoaWxkID0gY2hpbGRyZW5bX2tleXMxMFtfaW5kZXgxMF1dO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoY2hpbGQpO1xuICB9XG4gIHJldHVybiBzdHI7XG59XG5mdW5jdGlvbiBnZW5lcmF0ZUV4cG9ydHMoa2V5cykge1xuICB2YXIgc3RyID0gJ1xcbm1vZHVsZS5leHBvcnRzID0geyc7XG4gIGtleXMgPSBrZXlzIHx8IE9iamVjdC5rZXlzKGN1cnJlbnROcygpKTtcbiAgdmFyIF9rZXlzMTEgPSBPYmplY3Qua2V5cyhrZXlzKTtcbiAgZm9yKHZhciBfaW5kZXgxMSA9IDA7IF9pbmRleDExIDwgX2tleXMxMS5sZW5ndGg7IF9pbmRleDExKyspIHtcbiAgICB2YXIga2V5ID0ga2V5c1tfa2V5czExW19pbmRleDExXV07XG4gICAgc3RyICs9ICdcXG4gICcgKyBrZXkgKyAnOiAnICsga2V5ICsgJywnO1xuICB9XG4gIHJldHVybiBzdHIgKyAnXFxufSc7XG59XG5mdW5jdGlvbiBnZW5lcmF0ZU1vZHVsZShpbnB1dCxvcHRzKSB7XG4gIHJlc2V0R2xvYmFsKCk7XG4gIHZhciBhc3QgPSBncmFtLnBhcnNlKGlucHV0ICsgXCJcXG5cIik7XG4gIGlmKCFhc3QuY29tcGxldGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYXN0LmhpbnQpO1xuICB9XG4gIHZhciBvYmogPSB7YXN0OiBhc3QsIGNvZGU6IGdlbmVyYXRlQ29kZShhc3QpLCBuczogY3VycmVudE5zKCl9O1xuICByZXR1cm4gb2JqO1xufVxudmFyIGdyYW0gPSBlcGVnanMuY29tcGlsZUdyYW1tYXIoZ3JhbW1hckRlZiwgdG9rZW5EZWYpO1xubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGdyYW1tYXI6IGdyYW0sXG4gIHN0ckdyYW1tYXI6IHN0ckdyYW0sXG4gIGdyYW1tYXJEZWY6IGdyYW1tYXJEZWYsXG4gIGVwZWdqczogZXBlZ2pzLFxuICB0b2tlbkRlZjogdG9rZW5EZWYsXG4gIGdlbmVyYXRlTW9kdWxlOiBnZW5lcmF0ZU1vZHVsZSxcbiAgZ2VuZXJhdGVDb2RlOiBnZW5lcmF0ZUNvZGUsXG4gIGdlbmVyYXRlRXhwb3J0czogZ2VuZXJhdGVFeHBvcnRzXG59O1xuIl19
