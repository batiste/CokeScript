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
}

// token are matched in order of declaration;
// TODO: add functions

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
    var l = node.value.split('\n').length - 1;
    var i = 0;
    var str = '';
    while(i < l){
      str += '\n' + sp();
      i++;
    }
    return str;
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
    }

    // TODO: fix this
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
    var str = '';
    var children = node.children;

    var _keys8 = Object.keys(children);
    for(var _index8 = 0; _index8 < _keys8.length; _index8++) {
      var child = children[_keys8[_index8]];
      var e = child.children && child.children[0];
      // TODO: this should be possible
      var t = child.type;
      str += generateCode(child);
      var other = e && (e.type === 'FUNC_DEF' || e.type === 'LAMBDA');
      if(t === 'FOR' || t === 'TRY_CATCH' || t === 'WHILE' || t === 'IF' || t === 'STATEMENT' || t === 'samedent' || other) {
        
      } else {
        str += ';';
      }
    }

    return str;
  }
  ,
  IF: function (node) {
    var str = '';
    str = 'if(' + generateCode(node.children.e) + ') {' + generateCode(node.children.b) + '\n' + sp() + '}';
    var elif = node.children.elif;
    if(elif) {
      if(Array.isArray(elif)) {
        var _keys9 = Object.keys(elif);
        for(var _index9 = 0; _index9 < _keys9.length; _index9++) {
          var value = elif[_keys9[_index9]];
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
    var arrayName = node.children.a.value;
    var varName = node.children.v.value;
    forLoopCount++;
    var indexName = false;
    if(node.children.k) {
      indexName = node.children.k.value;
    }
    
    var str = 'var ' + keyArrayName + ' = Object.keys(' + arrayName + ');\n';
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
    var _keys10 = Object.keys(children);
    for(var _index10 = 0; _index10 < _keys10.length; _index10++) {
      var child = children[_keys10[_index10]];
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
  var _keys11 = Object.keys(children);
  for(var _index11 = 0; _index11 < _keys11.length; _index11++) {
    var child = children[_keys11[_index11]];
    str += generateCode(child);
  }
  
  return str;
}


function generateExports(keys) {
  var str = '\nmodule.exports = {';
  keys = keys || Object.keys(currentNs());
  var _keys12 = Object.keys(keys);
  for(var _index12 = 0; _index12 < _keys12.length; _index12++) {
    var key = keys[_keys12[_index12]];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb2tlc2NyaXB0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBRHY0QkE7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb2tlU2NyaXB0IGxhbmd1YWdlIGJ5IEJhdGlzdGUgQmllbGVyIDIwMTVcbi8vIEltcGxlbWVudGVkIHVzaW5nIEVQRUcuSlNcblxudmFyIGVwZWdqcyA9IHJlcXVpcmUoXCJlcGVnanNcIik7XG5cbnZhciBkZXB0aCA9IDA7XG52YXIgZm9yTG9vcENvdW50ID0gMTtcbnZhciB1bnBhY2tpbmcgPSAwO1xudmFyIG5hbWVzcGFjZXMgPSBbe31dO1xudmFyIGxldmVsU3RhY2sgPSBbMF07XG5cbmZ1bmN0aW9uIGN1cnJlbnROcygpIHtcbiAgcmV0dXJuIG5hbWVzcGFjZXNbbmFtZXNwYWNlcy5sZW5ndGggLSAxXTtcbn1cblxuZnVuY3Rpb24gY3VycmVudE5zSGFzKHApIHtcbiAgcmV0dXJuIG5hbWVzcGFjZXNbbmFtZXNwYWNlcy5sZW5ndGggLSAxXS5oYXNPd25Qcm9wZXJ0eShwKTtcbn1cblxuZnVuY3Rpb24gbmV3TnMoKSB7XG4gIG5hbWVzcGFjZXMucHVzaCh7fSk7XG4gIHJldHVybiBuYW1lc3BhY2VzW25hbWVzcGFjZXMubGVuZ3RoIC0gMV07XG59XG5cbmZ1bmN0aW9uIHJlc2V0R2xvYmFsKCkge1xuICBuYW1lc3BhY2VzID0gW3t9XTtcbiAgZm9yTG9vcENvdW50ID0gMTtcbiAgbGV2ZWxTdGFjayA9IFswXTtcbiAgZGVwdGggPSAwO1xuICB1bnBhY2tpbmcgPSAwO1xufVxuXG4vLyB0b2tlbiBhcmUgbWF0Y2hlZCBpbiBvcmRlciBvZiBkZWNsYXJhdGlvbjtcbi8vIFRPRE86IGFkZCBmdW5jdGlvbnNcblxudmFyIHRva2VuRGVmID0gW1xuICB7a2V5OiBcInN0cmluZ1wiLCBmdW5jOiBzdHJpbmdEZWZ9LFxuICB7a2V5OiBcImNvbW1lbnRcIiwgZnVuYzogY29tbWVudERlZn0sXG4gIHtrZXk6IFwiZnVuY3Rpb25fZGVmXCIsIGZ1bmM6IGRlZkRlZiwgdmVyYm9zZTogXCJkZWYgZGVmaW5pdGlvblwifSxcbiAge2tleTogXCJjbGFzc1wiLCByZWc6IC9eY2xhc3MgL30sXG4gIHtrZXk6IFwicmV0XCIsIHJlZzogL15yZXR1cm4vLCB2ZXJib3NlOiBcInJldHVyblwifSxcbiAge2tleTogXCJpZlwiLCByZWc6IC9eaWYgL30sXG4gIHtrZXk6IFwid2hpbGVcIiwgcmVnOiAvXndoaWxlIC99LFxuICB7a2V5OiBcInRyeVwiLCByZWc6IC9edHJ5L30sXG4gIHtrZXk6IFwiY2F0Y2hcIiwgcmVnOiAvXmNhdGNoL30sXG4gIHtrZXk6IFwidGhyb3dcIiwgcmVnOiAvXnRocm93IC99LFxuICB7a2V5OiBcInBhenpcIiwgcmVnOiAvXnBhc3MvfSxcbiAge2tleTogXCJuZXdcIiwgcmVnOiAvXm5ldyAvfSxcbiAge2tleTogXCJ0YWdcIiwgcmVnOiAvXjxbYS16QS1aXVswLTlhLXpBLVpdezAsMjl9L30sXG4gIHtrZXk6IFwiPlwiLCByZWc6IC9ePi99LFxuICB7a2V5OiBcImVsc2VpZlwiLCByZWc6IC9eZWxzZWlmIC99LFxuICB7a2V5OiBcImVsc2VcIiwgcmVnOiAvXmVsc2UvfSxcbiAge2tleTogXCJmb3JfbG9vcFwiLCByZWc6IC9eZm9yIC8sIHZlcmJvc2U6IFwiZm9yIGxvb3BcIn0sXG4gIHtrZXk6IFwiaW5cIiwgcmVnOiAvXmluIC99LFxuICB7a2V5OiBcIm5vdFwiLCByZWc6IC9ebm90IC8sIHZlcmJvc2U6IFwibm90XCJ9LFxuICB7a2V5OiBcIm5hbWVcIiwgcmVnOiAvXlthLXpBLVpfJF1bMC05YS16QS1aXyRdezAsMjl9L30sXG4gIHtrZXk6IFwicmVnZXhwXCIsIGZ1bmM6IHJlZ0V4cERlZiwgdmVyYm9zZTogXCJyZWd1bGFyIGVwcmVzc2lvblwifSxcbiAge2tleTogXCJtYXRoX29wZXJhdG9yc1wiLCByZWc6IC9eKFxcK1xcK3xcXC1cXC0pLywgdmVyYm9zZTogXCJtYXRoIG9wZXJhdG9yXCJ9LFxuICB7a2V5OiBcImJpbmFyeV9vcGVyYXRvcnNcIiwgcmVnOiAvXihcXCZcXCZ8XFx8XFx8fFxcJnxcXHx8PDx8XFw+XFw+KS8sIHZlcmJvc2U6IFwiYmluYXJ5IG9wZXJhdG9yXCJ9LFxuICB7a2V5OiBcImNvbXBhcmlzb25cIiwgcmVnOiAvXig8PXw+PXw8fD58IT18PT0pL30sXG4gIHtrZXk6IFwiYXNzaWduXCIsIHJlZzogL14oXFwrPXwtPXw9fDo9KS99LFxuICB7a2V5OiBcIm51bWJlclwiLCByZWc6IC9eWy1dP1swLTldK1xcLj9bMC05XSovfSxcbiAge2tleTogXCJjb21tYVwiLCByZWc6IC9eXFwsL30sXG4gIHtrZXk6IFwiZG90XCIsIHJlZzogL15cXC4vfSxcbiAge2tleTogXCJjb2xvblwiLCByZWc6IC9eXFw6LywgdmVyYm9zZTogXCI6XCJ9LFxuICB7a2V5OiBcIm9wZW5fcGFyXCIsIHJlZzogL15cXCgvLCB2ZXJib3NlOiBcIihcIn0sXG4gIHtrZXk6IFwiY2xvc2VfcGFyXCIsIHJlZzogL15cXCkvLCB2ZXJib3NlOiBcIilcIn0sXG4gIHtrZXk6IFwib3Blbl9icmFcIiwgcmVnOiAvXlxcWy8sIHZlcmJvc2U6IFwiW1wifSxcbiAge2tleTogXCJjbG9zZV9icmFcIiwgcmVnOiAvXlxcXS8sIHZlcmJvc2U6IFwiXVwifSxcbiAge2tleTogXCJvcGVuX2N1cmx5XCIsIHJlZzogL15cXHsvLCB2ZXJib3NlOiBcIntcIn0sXG4gIHtrZXk6IFwiY2xvc2VfY3VybHlcIiwgcmVnOiAvXlxcfS8sIHZlcmJvc2U6IFwifVwifSxcbiAge2tleTogXCJtYXRoXCIsIHJlZzogL15bLXxcXCt8XFwqfFxcL3wlXS99LFxuICB7a2V5OiBcInNhbWVkZW50XCIsIGZ1bmM6IGRlbnQoXCJzYW1lZGVudFwiKSwgdmVyYm9zZTogXCJzYW1lIGluZGVudGF0aW9uXCJ9LFxuICB7a2V5OiBcImRlZGVudFwiLCBmdW5jOiBkZW50KFwiZGVkZW50XCIpfSxcbiAge2tleTogXCJpbmRlbnRcIiwgZnVuYzogZGVudChcImluZGVudFwiKX0sXG4gIHtrZXk6IFwiV1wiLCByZWc6IC9eWyBdLywgdmVyYm9zZTogXCJzaW5nbGUgd2hpdGVzcGFjZVwifVxuXTtcblxuZnVuY3Rpb24gc3RhcnRTdHIoaW5wdXQsc3RyZWFtKSB7XG4gIHZhciBsYXN0ID0gc3RyZWFtW3N0cmVhbS5sZW5ndGggLSAxXTtcbiAgaWYobGFzdCAmJiBsYXN0LnZhbHVlID09PSBcIlxcXFxcIikge1xuICAgIHJldHVybjtcbiAgfVxuICBpZihpbnB1dC5tYXRjaCgvXiN7LykpIHtcbiAgICByZXR1cm4gXCIje1wiO1xuICB9XG59XG5cbnZhciBzdHJJbnRlcnBvbGF0aW9uVG9rZW5EZWYgPSBbXG4gIHtrZXk6IFwic3RhcnRcIiwgZnVuYzogc3RhcnRTdHJ9LFxuICB7a2V5OiBcImVuZFwiLCByZWc6IC9efS99LFxuICB7a2V5OiBcIm5hbWVcIiwgcmVnOiAvXlthLXpBLVpfJF1bMC05YS16QS1aX117MCwyOX0vfSxcbiAge2tleTogXCJkb3RcIiwgcmVnOiAvXlxcLi99LFxuICB7a2V5OiBcImNoYXJcIiwgcmVnOiAvXi4vfVxuXTtcblxudmFyIHN0ckludGVycG9sYXRpb25HcmFtbWFyRGVmID0ge1xuICBTVEFSVDoge3J1bGVzOiBbXCJFTCogRU9GXCJdfSxcbiAgRUw6IHtydWxlczogW1wiVkFSXCIsIFwiY2hhclwiLCBcIm5hbWVcIiwgXCJzdGFydFwiLCBcImVuZFwiLCBcImRvdFwiXX0sXG4gIFZBUjoge3J1bGVzOiBbXCJzdGFydCBOQU1FIGVuZFwiXX0sXG4gIE5BTUU6IHtydWxlczogW1wibmFtZSBkb3QgTkFNRVwiLCBcIm5hbWVcIl19XG59O1xuXG52YXIgc3RyR3JhbSA9IGVwZWdqcy5jb21waWxlR3JhbW1hcihzdHJJbnRlcnBvbGF0aW9uR3JhbW1hckRlZiwgc3RySW50ZXJwb2xhdGlvblRva2VuRGVmKTtcblxuZnVuY3Rpb24gZ2VuZXJhdGVTdHJpbmdDb2RlKG5vZGUsYykge1xuICBpZihub2RlLnR5cGUgPT09ICdWQVInKSB7XG4gICAgcmV0dXJuIGMgKyAnICsgJyArIGdlbmVyYXRlU3RyaW5nQ29kZShub2RlLmNoaWxkcmVuWzFdLCBjKSArICcgKyAnICsgYztcbiAgfVxuICBcbiAgaWYobm9kZS52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG5vZGUudmFsdWU7XG4gIH1cbiAgXG4gIHZhciBzdHIgPSAnJztcbiAgaWYoIW5vZGUuY2hpbGRyZW4pIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cblxuICB2YXIgY2hpbGRyZW4gPSBub2RlLmNoaWxkcmVuO1xuICB2YXIgX2tleXMxID0gT2JqZWN0LmtleXMoY2hpbGRyZW4pO1xuICBmb3IodmFyIF9pbmRleDEgPSAwOyBfaW5kZXgxIDwgX2tleXMxLmxlbmd0aDsgX2luZGV4MSsrKSB7XG4gICAgdmFyIGNoaWxkID0gY2hpbGRyZW5bX2tleXMxW19pbmRleDFdXTtcbiAgICBzdHIgKz0gZ2VuZXJhdGVTdHJpbmdDb2RlKGNoaWxkLCBjKTtcbiAgfVxuICByZXR1cm4gc3RyO1xufVxuXG5mdW5jdGlvbiBjdXJyZW50TGV2ZWwoKSB7XG4gIHJldHVybiBsZXZlbFN0YWNrW2xldmVsU3RhY2subGVuZ3RoIC0gMV07XG59XG5cbmZ1bmN0aW9uIGluZGVudFR5cGUobCkge1xuICBpZihsID4gY3VycmVudExldmVsKCkpIHtcbiAgICByZXR1cm4gJ2luZGVudCc7XG4gIH1cblxuICBpZihsIDwgY3VycmVudExldmVsKCkpIHtcbiAgICByZXR1cm4gJ2RlZGVudCc7XG4gIH1cblxuICBpZihsID09PSBjdXJyZW50TGV2ZWwoKSkge1xuICAgIHJldHVybiAnc2FtZWRlbnQnO1xuICB9XG59XG5cbmZ1bmN0aW9uIGRlbnQoZGVudFR5cGUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIF9kZW50KGlucHV0KSB7XG4gICAgLy8gZW1wdHkgbGluZSBpcyBhIHNhbWVkZW50XG4gICAgdmFyIG0gPSBpbnB1dC5tYXRjaCgvXlxcbltcXHNdKi8pO1xuICAgIGlmKG0pIHtcbiAgICAgIHZhciBsaW5lcyA9IG1bMF0uc3BsaXQoXCJcXG5cIik7XG4gICAgICB2YXIgaW5kZW50ID0gbGluZXNbbGluZXMubGVuZ3RoIC0gMV0ubGVuZ3RoO1xuICAgICAgaWYoaW5kZW50VHlwZShpbmRlbnQpID09PSBkZW50VHlwZSkge1xuICAgICAgICBpZihkZW50VHlwZSA9PT0gJ2RlZGVudCcpIHtcbiAgICAgICAgICBsZXZlbFN0YWNrLnBvcCgpO1xuICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYoZGVudFR5cGUgPT09ICdpbmRlbnQnKSB7XG4gICAgICAgICAgbGV2ZWxTdGFjay5wdXNoKGluZGVudCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiBtWzBdO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cbiAgICBcbmZ1bmN0aW9uIHN0cmluZ0RlZihpbnB1dCkge1xuICB2YXIgZmlyc3QgPSBpbnB1dC5jaGFyQXQoMCk7XG4gIGlmKGZpcnN0ID09PSAnXCInIHx8IGZpcnN0ID09PSBcIidcIikge1xuICAgIHZhciBpID0gMTtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpe1xuICAgICAgdmFyIGNoID0gaW5wdXQuY2hhckF0KGkpO1xuICAgICAgaWYoY2ggPT09ICdcXFxcJykge1xuICAgICAgICBpKys7XG4gICAgICB9IGVsc2UgaWYoY2ggPT09IGZpcnN0KSB7XG4gICAgICAgIHJldHVybiBpbnB1dC5zbGljZSgwLCBpICsgMSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHJlZ0V4cERlZihpbnB1dCkge1xuICBpZihpbnB1dC5jaGFyQXQoMCkgPT09ICcvJykge1xuICAgIHZhciBpID0gMTtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpe1xuICAgICAgdmFyIGNoID0gaW5wdXQuY2hhckF0KGkpO1xuICAgICAgaWYoY2ggPT09ICdcXFxcJykge1xuICAgICAgICBpKys7XG4gICAgICB9IGVsc2UgaWYoY2ggPT09ICcvJykge1xuICAgICAgICBpKys7XG4gICAgICAgIC8vIG1vZGlmaWVyc1xuICAgICAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkgJiYgXCJpZ21cIi5pbmRleE9mKGlucHV0LmNoYXJBdChpKSkgIT09IC0xKXtcbiAgICAgICAgICBpKys7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGlucHV0LnNsaWNlKDAsIGkpO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBkZWZEZWYoaW5wdXQpIHtcbiAgaWYoaW5wdXQubWF0Y2goL15kZWZbXFwofCB8XFxuXS8pKSB7XG4gICAgcmV0dXJuIFwiZGVmXCI7XG4gIH1cbiAgXG4gIGlmKGlucHV0LmluZGV4T2YoXCJkb20gXCIpID09PSAwKSB7XG4gICAgcmV0dXJuIFwiZG9tXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tbWVudERlZihpbnB1dCkge1xuICB2YXIgbSA9IGlucHV0Lm1hdGNoKC9eIy8pO1xuICBpZihtKSB7XG4gICAgdmFyIGkgPSBtWzBdLmxlbmd0aDtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpe1xuICAgICAgdmFyIGNoID0gaW5wdXQuY2hhckF0KGkpO1xuICAgICAgaWYoY2ggPT09ICdcXG4nKSB7XG4gICAgICAgIHJldHVybiBpbnB1dC5zbGljZSgwLCBpKTtcbiAgICAgIH1cbiAgICAgIGkrKztcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVmbGVjdChwYXJhbXMpIHsgcmV0dXJuIHBhcmFtczsgfVxuXG52YXIgZ3JhbW1hckRlZiA9IHtcbiAgU1RBUlQ6IHtydWxlczogW1wiTElORSogRU9GXCJdfSxcbiAgRUxDOiB7cnVsZXM6IFtcIlcqIGNvbW1lbnRcIl0sIHZlcmJvc2U6IFwiY29tbWVudFwifSxcbiAgTElORToge3J1bGVzOiBbXCJTVEFURU1FTlQgRUxDPyBzYW1lZGVudCtcIiwgXCJTVEFURU1FTlQgRUxDPyAhZGVkZW50XCIsIFxuICAgIFwiRUxDPyBzYW1lZGVudFwiLCBcIkVMQyAhZGVkZW50XCJdLCB2ZXJib3NlOiBcIm5ldyBsaW5lXCJ9LFxuICBCTE9DSzoge3J1bGVzOiBbXCJpbmRlbnQgcGF6eiBkZWRlbnRcIiwgXCJpbmRlbnQgTElORSsgZGVkZW50XCJdfSxcbiAgU1RBVEVNRU5UOiB7cnVsZXM6IFtcIkFTU0lHTlwiLCBcIkVYUFJcIiwgXCJJRlwiLCBcIldISUxFXCIsIFwiRk9SXCIsIFwiUkVUVVJOXCIsIFxuICAgIFwiQ0xBU1NcIiwgXCJUQUdcIiwgXCJET01fQVNTSUdOXCIsIFwiVFJZX0NBVENIXCIsIFwiVEhST1dcIl19LFxuICBDTEFTU19NRVRIT0RTOiB7XG4gICAgcnVsZXM6IFtcInNhbWVkZW50KiBmOkZVTkNfREVGIHNhbWVkZW50KlwiXSxcbiAgICAgIGhvb2tzOiBbZnVuY3Rpb24gKHApIHsgcmV0dXJuIHAuZjsgfV1cbiAgfSxcbiAgQ0xBU1M6IHtcbiAgICBydWxlczogW1xuICAgICAgXCJjbGFzcyBuOm5hbWUgb3Blbl9wYXIgcDpuYW1lIGNsb3NlX3BhciBpbmRlbnQgbTpDTEFTU19NRVRIT0RTKyBkZWRlbnRcIixcbiAgICAgIFwiY2xhc3MgbjpuYW1lIGluZGVudCBtOkNMQVNTX01FVEhPRFMrIGRlZGVudFwiXG4gICAgXSxcbiAgICBob29rczogW1xuICAgICAgZnVuY3Rpb24gKHApIHsgcmV0dXJuIHtuYW1lOiBwLm4sIG1ldGhvZHM6IHAubSwgcGFyZW50OiBwLnB9OyB9LFxuICAgICAgZnVuY3Rpb24gKHApIHsgcmV0dXJuIHtuYW1lOiBwLm4sIG1ldGhvZHM6IHAubX07IH1cbiAgICBdXG4gIH0sXG4gIEZVTkNfREVGX1BBUkFNUzoge3J1bGVzOiBbXG4gICAgXCJwMTpGVU5DX0RFRl9QQVJBTVMgY29tbWEgVyBwMjpGVU5DX0RFRl9QQVJBTVNcIixcbiAgICAgIFwicDE6bmFtZSBhc3NpZ24gZTpFWFBSXCIsXG4gICAgICBcInAxOm5hbWVcIlxuICAgIF0sXG4gICAgdmVyYm9zZTogXCJkZWYgcGFyYW1ldGVyc1wiXG4gIH0sXG4gIExBTUJEQToge3J1bGVzOiBbXG4gICAgXCJmZDpmdW5jdGlvbl9kZWYgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIFcgYmxvY2s6RVhQUlwiLFxuICAgICAgXCJmZDpmdW5jdGlvbl9kZWYgVyBmbjpuYW1lIG9wZW5fcGFyIHBhcmFtczpGVU5DX0RFRl9QQVJBTVM/IGNsb3NlX3BhciBXIGJsb2NrOkVYUFJcIixcbiAgICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgYmxvY2s6RVhQUlwiXG4gICAgXSxcbiAgICBob29rczogW3JlZmxlY3QsIHJlZmxlY3QsIHJlZmxlY3RdXG4gIH0sXG4gIEZVTkNfREVGOiB7cnVsZXM6IFtcbiAgICBcImZkOmZ1bmN0aW9uX2RlZiBvcGVuX3BhciBwYXJhbXM6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgYmxvY2s6QkxPQ0tcIixcbiAgICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBvcGVuX3BhciBwYXJhbXM6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgYmxvY2s6QkxPQ0tcIixcbiAgICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBibG9jazpCTE9DS1wiLFxuICAgICAgXCJmZDpmdW5jdGlvbl9kZWYgYmxvY2s6QkxPQ0tcIlxuICAgIF0sXG4gICAgaG9va3M6IFtyZWZsZWN0LCByZWZsZWN0LCByZWZsZWN0LCByZWZsZWN0XSxcbiAgICB2ZXJib3NlOiBcImRlZiBkZWZpbml0aW9uXCJcbiAgfSxcbiAgRUxTRV9JRjoge3J1bGVzOiBbXCJzYW1lZGVudCBlbHNlaWYgZTpFWFBSIGI6QkxPQ0tcIl0sIGhvb2tzOiBbcmVmbGVjdF19LFxuICBFTFNFOiB7cnVsZXM6IFtcInNhbWVkZW50IGVsc2UgYjpCTE9DS1wiXSwgaG9va3M6IFtyZWZsZWN0XX0sXG4gIElGOiB7cnVsZXM6IFtcImlmIGU6RVhQUiBiOkJMT0NLIGVsaWY6RUxTRV9JRiogZWw6RUxTRT9cIl0sIGhvb2tzOiBbcmVmbGVjdF19LFxuICBFTFNFX0VYUFI6IHtydWxlczogW1wiVyBlbHNlIFcgYjpFWFBSXCJdLCBob29rczogW3JlZmxlY3RdfSxcbiAgSUZfRVhQUjoge3J1bGVzOiBbXCJlOkVYUFIgVyBpZiB0ZXN0OkVYUFIgZWw6RUxTRV9FWFBSP1wiXSwgaG9va3M6IFtyZWZsZWN0XX0sXG4gIFdISUxFOiB7cnVsZXM6IFtcIndoaWxlIGU6RVhQUiBiOkJMT0NLXCJdLCBob29rczogW3JlZmxlY3RdfSxcbiAgTUFUSDoge3J1bGVzOiBbXCJlMTpFWFBSIFcgb3A6bWF0aCBXIGUyOkVYUFJcIl19LFxuICBQQVRIOiB7cnVsZXM6IFtcIlBBVEggZG90IG5hbWVcIiwgXCJQQVRIIG9wZW5fYnJhIG51bWJlciBjbG9zZV9icmFcIiwgXCJuYW1lXCJdfSxcbiAgQVNTSUdOOiB7cnVsZXM6IFtcbiAgICBcImxlZnQ6RVhQUiBXIG9wOmFzc2lnbiBXIHJpZ2h0OkVYUFJcIixcbiAgICBcImxlZnQ6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSIFcgb3A6YXNzaWduIFcgcmlnaHQ6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSXCIsXG4gICAgXCJsZWZ0OlNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUiBXIG9wOmFzc2lnbiBXIHJpZ2h0OkVYUFJcIlxuICBdLCBob29rczogW3JlZmxlY3QsIHJlZmxlY3QsIHJlZmxlY3RdfSxcbiAgV19PUl9TQU1FREVOVDoge3J1bGVzOiBbXCJXXCIsIFwic2FtZWRlbnRcIl0sIHZlcmJvc2U6IFwic2FtZWRlbnQgb3Igd2hpdGVzcGFjZVwifSxcbiAgV19TQU1FREVOVF9JTkRFTlQ6IHtydWxlczogW1wiV1wiLCBcInNhbWVkZW50XCIsIFwiaW5kZW50XCJdLCB2ZXJib3NlOiBcImluZGVudCBvciBzYW1lZGVudCBvciB3aGl0ZXNwYWNlXCJ9LFxuICBBTllfU1BBQ0U6IHtydWxlczogW1wiV1wiLCBcInNhbWVkZW50XCIsIFwiaW5kZW50XCIsIFwiZGVkZW50XCJdLCB2ZXJib3NlOiBcImFueSBzcGFjZVwifSxcbiAgRlVOQ19DQUxMX1BBUkFNUzoge3J1bGVzOiBbXCJFWFBSIGNvbW1hIEFOWV9TUEFDRSsgRlVOQ19DQUxMX1BBUkFNUyBBTllfU1BBQ0UqXCIsIFwiRVhQUiBBTllfU1BBQ0UqXCJdfSxcbiAgRlVOQ19DQUxMOiB7cnVsZXM6IFtcbiAgICBcIm9wZW5fcGFyIEZVTkNfQ0FMTF9QQVJBTVM/IGNsb3NlX3BhclwiXG4gIF19LFxuXG4gIFRZUEU6IHtydWxlczogW1wibmFtZSBjb2xvblwiXX0sXG5cbiAgRk9SOiB7cnVsZXM6IFtcbiAgICBcImZvcl9sb29wIGs6bmFtZSBjb21tYSBXIHY6bmFtZSBXIGluIHQ6VFlQRT8gYTpuYW1lIGI6QkxPQ0tcIixcbiAgICBcImZvcl9sb29wIHY6bmFtZSBXIGluIHQ6VFlQRT8gYTpuYW1lIGI6QkxPQ0tcIl0sXG4gICAgaG9va3M6IFtyZWZsZWN0LCByZWZsZWN0XVxuICB9LFxuXG4gIFNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUjoge3J1bGVzOiBbXG4gICAgXCJlMTpFWFBSIGNvbW1hIFcgZTI6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSXCIsXG4gICAgXCJlMTpFWFBSIGNvbW1hIFcgZTI6RVhQUlwiXG4gIF0sXG4gIGhvb2tzOiBbXG4gICAgZnVuY3Rpb24gKHApIHsgcmV0dXJuIFtwLmUxXS5jb25jYXQocC5lMi5jaGlsZHJlbik7IH0sIGZ1bmN0aW9uIChwKSB7IHJldHVybiBbcC5lMSwgcC5lMl07IH1cbiAgXSBcbiAgfSxcblxuICBDT01NQV9TRVBBUkFURURfRVhQUjoge3J1bGVzOiBbXG4gICAgXCJFWFBSIGNvbW1hIEFOWV9TUEFDRSsgQ09NTUFfU0VQQVJBVEVEX0VYUFIgQU5ZX1NQQUNFKlwiLFxuICAgIFwiRVhQUiBBTllfU1BBQ0UqXCJcbiAgXX0sXG5cbiAgQVJSQVk6IHtydWxlczogW1xuICAgIFwib3Blbl9icmEgQU5ZX1NQQUNFKiBjOkNPTU1BX1NFUEFSQVRFRF9FWFBSPyBBTllfU1BBQ0UqIGNsb3NlX2JyYVwiXG4gIF19LFxuXG4gIE1FTUJFUlM6IHtydWxlczogW1xuICAgIFwibmFtZSBjb2xvbiBXIEVYUFIgc2FtZWRlbnQ/IGNvbW1hIEFOWV9TUEFDRSsgTUVNQkVSUyBBTllfU1BBQ0UqXCIsXG4gICAgXCJuYW1lIGNvbG9uIFcgRVhQUiBBTllfU1BBQ0UqXCJcbiAgXX0sXG5cbiAgT0JKRUNUOiB7cnVsZXM6IFtcbiAgICBcIm9wZW5fY3VybHkgaW5kZW50PyBNRU1CRVJTPyBjbG9zZV9jdXJseVwiXG4gIF19LFxuXG4gIFRBR19QQVJBTVM6IHtydWxlczogW1xuICAgIFwibGVmdDpUQUdfUEFSQU1TIFcgcmlnaHQ6VEFHX1BBUkFNU1wiLFxuICAgICAgXCJuOm5hbWUgYXNzaWduIGU6RVhQUlwiLFxuICAgICAgXCJuOm5hbWVcIlxuICAgIF0sXG4gICAgaG9va3M6IFtyZWZsZWN0LCByZWZsZWN0LCByZWZsZWN0XSxcbiAgICB2ZXJib3NlOiBcInRhZyBwYXJhbWV0ZXJzXCJcbiAgfSxcblxuICBUQUc6IHtydWxlczogW1xuICAgIFwidGFnOnRhZyBXPyBwYXJhbXM6VEFHX1BBUkFNUz8gZW5kOj4/IGJsb2NrOkJMT0NLP1wiXG4gIF0sXG4gIGhvb2tzOiBbcmVmbGVjdF1cbiAgfSxcblxuICBET01fQVNTSUdOOiB7cnVsZXM6IFtcbiAgICBcImFzc2lnbiBFWFBSXCJcbiAgXX0sXG5cbiAgVFJZX0NBVENIOiB7cnVsZXM6IFtcbiAgICBcInRyeSBiMTpCTE9DSyBzYW1lZGVudD8gY2F0Y2ggb3Blbl9wYXIgZXJyOm5hbWU/IGNsb3NlX3BhciBiMjpCTE9DS1wiXG4gICAgXSxcbiAgICBob29rczogW3JlZmxlY3RdXG4gIH0sXG5cbiAgVEhST1c6IHtydWxlczogW1xuICAgIFwidGhyb3cgRVhQUlwiXG4gIF19LFxuXG4gIFJFVFVSTjoge3J1bGVzOiBbXCJyZXQgVyBTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFJcIiwgXCJyZXQgVyBFWFBSXCIsIFwicmV0XCJdfSxcbiAgUklHSFRfRVhQUjoge3J1bGVzOiBbXG4gICAgXCJtYXRoX29wZXJhdG9yc1wiLFxuICAgIFwiVyBiaW5hcnlfb3BlcmF0b3JzIFcgRVhQUlwiLFxuICAgIFwiVyBjb21wYXJpc29uIFcgRVhQUlwiLFxuICAgIFwiVyA+IFcgRVhQUlwiLFxuICAgIFwiZG90IEVYUFJcIixcbiAgICBcIm9wZW5fYnJhIEVYUFIgY2xvc2VfYnJhXCIsXG4gICAgXCJGVU5DX0NBTExcIlxuICAgIF0sXG4gICAgdmVyYm9zZTogXCJleHByZXNzaW9uXCJcbiAgfSxcblxuICBFWFBSOiB7cnVsZXM6IFtcbiAgICBcIklGX0VYUFJcIixcbiAgICBcIk1BVEhcIixcbiAgICBcIk9CSkVDVFwiLFxuICAgIFwiRlVOQ19ERUZcIixcbiAgICBcIkVYUFIgUklHSFRfRVhQUlwiLFxuICAgIFwibmFtZVwiLFxuICAgIFwibnVtYmVyXCIsXG4gICAgXCJMQU1CREFcIixcbiAgICBcInN0cmluZ1wiLFxuICAgIFwicmVnZXhwXCIsXG4gICAgXCJvcGVuX3BhciBFWFBSIGNsb3NlX3BhclwiLFxuICAgIFwibmV3IEVYUFJcIixcbiAgICBcIm5vdCBFWFBSXCIsXG4gICAgXCJBUlJBWVwiXG4gICAgXSxcbiAgICB2ZXJib3NlOiBcImV4cHJlc3Npb25cIlxuICB9XG59O1xuXG5mdW5jdGlvbiBzcGFjZXIobikge1xuICB2YXIgb3V0ID0gXCJcIjtcbiAgdmFyIGkgPSAwO1xuICB3aGlsZShpIDwgbil7XG4gICAgb3V0ICs9IFwiIFwiO1xuICAgIGkrKztcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiBzcChtb2QpIHtcbiAgaWYobW9kKSB7XG4gICAgcmV0dXJuIHNwYWNlcigyICogKGRlcHRoICsgbW9kKSk7XG4gIH1cbiAgcmV0dXJuIHNwYWNlcigyICogZGVwdGgpO1xufVxuXG52YXIgbmMgPSAxO1xuLy8gY2hpbGRyZW4gbmFtZVxuZnVuY3Rpb24gQ04oKSB7XG4gIHJldHVybiAnX19jJyArIG5jO1xufVxuXG5mdW5jdGlvbiBwdXNoQ04oKSB7XG4gIG5jKys7XG4gIHJldHVybiAnX19jJyArIG5jO1xufVxuXG5mdW5jdGlvbiBwb3BDTigpIHtcbiAgbmMtLTtcbiAgcmV0dXJuICdfX2MnICsgbmM7XG59XG5cbnZhciBiYWNrZW5kID0ge1xuICBkZWRlbnQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgZGVwdGggPSBNYXRoLm1heCgwLCBkZXB0aCAtIDEpO1xuICAgIHJldHVybiAnJztcbiAgfVxuICAsXG4gIGluZGVudDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICBkZXB0aCA9IGRlcHRoICsgMTtcbiAgICByZXR1cm4gJ1xcbicgKyBzcCgpO1xuICB9XG4gICxcbiAgc2FtZWRlbnQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIGwgPSBub2RlLnZhbHVlLnNwbGl0KCdcXG4nKS5sZW5ndGggLSAxO1xuICAgIHZhciBpID0gMDtcbiAgICB2YXIgc3RyID0gJyc7XG4gICAgd2hpbGUoaSA8IGwpe1xuICAgICAgc3RyICs9ICdcXG4nICsgc3AoKTtcbiAgICAgIGkrKztcbiAgICB9XG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuICAsXG4gIERPTV9BU1NJR046IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIG5hbWUgPSBDTigpO1xuICAgIHJldHVybiBuYW1lICsgJy5wdXNoKFN0cmluZygnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bMV0pICsgJykpJztcbiAgfVxuICAsXG4gIFRBR19QQVJBTVM6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5sZWZ0KSB7XG4gICAgICByZXR1cm4gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ubGVmdCkgKyAnLCAnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucmlnaHQpO1xuICAgIH1cbiAgICBcbiAgICBpZihub2RlLmNoaWxkcmVuLmUpIHtcbiAgICAgIHJldHVybiBub2RlLmNoaWxkcmVuLm4udmFsdWUgKyAnOiAnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBub2RlLmNoaWxkcmVuLm4udmFsdWUgKyAnOiB0cnVlJztcbiAgICB9XG4gIH1cbiAgLFxuICBUQUc6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciA9ICcnO1xuICAgIHZhciBwYXJhbXMgPSBcIntcIjtcbiAgICB2YXIgbmFtZSA9IG5vZGUuY2hpbGRyZW4udGFnLnZhbHVlLnN1YnN0cmluZygxKTtcbiAgICBpZihub2RlLmNoaWxkcmVuLnBhcmFtcykge1xuICAgICAgcGFyYW1zICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnBhcmFtcyk7XG4gICAgfVxuXG4gICAgcGFyYW1zICs9ICd9JztcbiAgICB2YXIgc3ViID0gJ1tdJztcbiAgICBpZihub2RlLmNoaWxkcmVuLmJsb2NrKSB7XG4gICAgICBzdWIgPSBwdXNoQ04oKTtcbiAgICAgIHN0ciArPSAnJyArIENOKCkgKyAnID0gW10nO1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrKTtcbiAgICAgIHBvcENOKCk7XG4gICAgfVxuICAgIFxuICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgQ04oKSArICcucHVzaChoKFwiJyArIG5hbWUgKyAnXCIsICcgKyBwYXJhbXMgKyAnLCAnICsgc3ViICsgJykpJztcbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgQ0xBU1M6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIG5hbWUgPSBub2RlLmNoaWxkcmVuLm5hbWUudmFsdWU7XG4gICAgdmFyIGZ1bmNzID0gbm9kZS5jaGlsZHJlbi5tZXRob2RzO1xuICAgIHZhciBwYXJlbnQgPSBub2RlLmNoaWxkcmVuLnBhcmVudDtcbiAgICB2YXIgc3RyID0gJyc7XG4gICAgdmFyIGNvbnN0cnVjdG9yID0gbnVsbDtcbiAgICB2YXIgX2tleXMyID0gT2JqZWN0LmtleXMoZnVuY3MpO1xuICAgIGZvcih2YXIgX2luZGV4MiA9IDA7IF9pbmRleDIgPCBfa2V5czIubGVuZ3RoOyBfaW5kZXgyKyspIHtcbiAgICAgIHZhciBmdW5jID0gZnVuY3NbX2tleXMyW19pbmRleDJdXTtcbiAgICAgIHZhciBmdW5jX2RlZiA9IGZ1bmMuY2hpbGRyZW47XG4gICAgICB2YXIgZnVuY19uYW1lID0gZnVuY19kZWYuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICBpZihmdW5jX25hbWUgPT09ICdjb25zdHJ1Y3RvcicpIHtcbiAgICAgICAgY29uc3RydWN0b3IgPSBmdW5jX2RlZjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSAnXFxuJyArIHNwKCkgKyBuYW1lICsgJy5wcm90b3R5cGUuJyArIGZ1bmNfbmFtZSArICcgPSAnICsgZ2VuZXJhdGVDb2RlKGZ1bmNfZGVmKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBuc1tuYW1lXSA9IHRydWU7XG4gICAgbnMgPSBuZXdOcygpO1xuXG4gICAgdmFyIHBhcmFtcyA9IGNvbnN0cnVjdG9yICYmIGNvbnN0cnVjdG9yLmNoaWxkcmVuLnBhcmFtcztcbiAgICBpZihwYXJhbXMpIHtcbiAgICAgIHBhcmFtcyA9IGdlbmVyYXRlQ29kZShwYXJhbXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJhbXMgPSAnJztcbiAgICB9XG4gICAgXG4gICAgdmFyIGJvZHkgPSBjb25zdHJ1Y3RvciAmJiBjb25zdHJ1Y3Rvci5jaGlsZHJlbi5ibG9jaztcbiAgICB2YXIgY29uc19zdHIgPSAnJyArIG5hbWUgKyAnID0gZnVuY3Rpb24gJyArIG5hbWUgKyAnKCcgKyBwYXJhbXMgKyAnKSB7JztcbiAgICBjb25zX3N0ciArPSAnXFxuJyArIHNwKDEpICsgJ2lmKCEodGhpcyBpbnN0YW5jZW9mICcgKyBuYW1lICsgJykpeyByZXR1cm4gbmV3ICcgKyBuYW1lICsgJygnICsgT2JqZWN0LmtleXMobnMpLmpvaW4oJywnKSArICcpfSc7XG4gICAgdmFyIF9rZXlzMyA9IE9iamVjdC5rZXlzKG5zKTtcbiAgICBmb3IodmFyIF9pbmRleDMgPSAwOyBfaW5kZXgzIDwgX2tleXMzLmxlbmd0aDsgX2luZGV4MysrKSB7XG4gICAgICB2YXIga2V5ID0gX2tleXMzW19pbmRleDNdO1xuICAgICAgdmFyIHZhbHVlID0gbnNbX2tleXMzW19pbmRleDNdXTtcbiAgICAgIGlmKHZhbHVlICE9PSB0cnVlICYmIHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc19zdHIgKz0gJ1xcbicgKyBzcCgxKSArICdpZignICsga2V5ICsgJyA9PT0gdW5kZWZpbmVkKSB7JyArIGtleSArICcgPSAnICsgZ2VuZXJhdGVDb2RlKHZhbHVlKSArICd9JztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYoYm9keSkge1xuICAgICAgY29uc19zdHIgKz0gZ2VuZXJhdGVDb2RlKGJvZHkpO1xuICAgIH1cbiAgICBjb25zX3N0ciArPSBzcCgpICsgJ1xcbn0nO1xuXG4gICAgaWYocGFyZW50KSB7XG4gICAgICBjb25zX3N0ciArPSAnXFxuJyArIHNwKCkgKyAnJyArIG5hbWUgKyAnLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoJyArIHBhcmVudC52YWx1ZSArICcucHJvdG90eXBlKSc7XG4gICAgICBjb25zX3N0ciArPSAnXFxuJyArIHNwKCkgKyAnJyArIG5hbWUgKyAnLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9ICcgKyBuYW1lICsgJyc7XG4gICAgfVxuXG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICByZXR1cm4gY29uc19zdHIgKyBzdHI7XG4gIH1cbiAgLFxuICBMQU1CREE6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIG5hbWUgPSBcIlwiO1xuICAgIHZhciBucyA9IG5ld05zKCk7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5mbikge1xuICAgICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICBuc1tuYW1lXSA9IHRydWU7XG4gICAgfVxuICAgIFxuICAgIHZhciBzdHIgPSBcImZ1bmN0aW9uIFwiICsgbmFtZSArIFwiKFwiO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ucGFyYW1zKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucGFyYW1zLCBucyk7XG4gICAgfVxuICAgIFxuICAgIHN0ciArPSAnKSB7JztcbiAgICB2YXIgX2tleXM0ID0gT2JqZWN0LmtleXMobnMpO1xuICAgIGZvcih2YXIgX2luZGV4NCA9IDA7IF9pbmRleDQgPCBfa2V5czQubGVuZ3RoOyBfaW5kZXg0KyspIHtcbiAgICAgIHZhciBrZXkgPSBfa2V5czRbX2luZGV4NF07XG4gICAgICB2YXIgdmFsdWUgPSBuc1tfa2V5czRbX2luZGV4NF1dO1xuICAgICAgaWYodmFsdWUgIT09IHRydWUgJiYgdmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICB2YXIgY29kZSA9IGdlbmVyYXRlQ29kZSh2YWx1ZSk7XG4gICAgICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgJ2lmKCcgKyBrZXkgKyAnID09PSB1bmRlZmluZWQpIHsnICsga2V5ICsgJyA9ICcgKyBjb2RlICsgJ30nO1xuICAgICAgfVxuICAgIH1cbiAgICAgIFxuICAgIGlmKG5vZGUuY2hpbGRyZW4uYmxvY2spIHtcbiAgICAgIHN0ciArPSAnIHJldHVybiAnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYmxvY2ssIG5zKTtcbiAgICB9XG4gICAgXG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICByZXR1cm4gc3RyICsgXCI7IH1cIjtcbiAgfVxuICAsXG4gIEZVTkNfREVGOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBuYW1lID0gXCJcIjtcbiAgICB2YXIgbnMgPSBjdXJyZW50TnMoKTtcbiAgICB2YXIgaXNfZG9tID0gbm9kZS5jaGlsZHJlbi5mZC52YWx1ZSA9PT0gJ2RvbSc7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5mbikge1xuICAgICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICBuc1tuYW1lXSA9IHRydWU7XG4gICAgfVxuICAgIFxuICAgIG5zID0gbmV3TnMoKTtcbiAgICB2YXIgc3RyID0gXCJmdW5jdGlvbiBcIiArIG5hbWUgKyBcIihcIjtcbiAgICBpZihub2RlLmNoaWxkcmVuLnBhcmFtcykge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnBhcmFtcyk7XG4gICAgfVxuXG4gICAgc3RyICs9ICcpIHsnO1xuICAgIHZhciBfa2V5czUgPSBPYmplY3Qua2V5cyhucyk7XG4gICAgZm9yKHZhciBfaW5kZXg1ID0gMDsgX2luZGV4NSA8IF9rZXlzNS5sZW5ndGg7IF9pbmRleDUrKykge1xuICAgICAgdmFyIGtleSA9IF9rZXlzNVtfaW5kZXg1XTtcbiAgICAgIHZhciB2YWx1ZSA9IG5zW19rZXlzNVtfaW5kZXg1XV07XG4gICAgICBpZih2YWx1ZSAhPT0gdHJ1ZSAmJiB2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHZhciBjb2RlID0gZ2VuZXJhdGVDb2RlKHZhbHVlKTtcbiAgICAgICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyAnaWYoJyArIGtleSArICcgPT09IHVuZGVmaW5lZCkgeycgKyBrZXkgKyAnID0gJyArIGNvZGUgKyAnO30nO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZihpc19kb20pIHtcbiAgICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgJycgKyBDTigpICsgJyA9IFtdOyc7XG4gICAgfVxuXG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrKTtcbiAgICB9XG4gICAgXG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcblxuICAgIGlmKGlzX2RvbSkge1xuICAgICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyAncmV0dXJuICcgKyBDTigpICsgJzsnO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc3RyICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICB9XG4gICxcbiAgRlVOQ19ERUZfUEFSQU1TOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBzdHIgPSBcIlwiO1xuICAgIHZhciBucyA9IGN1cnJlbnROcygpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW5bMF0udHlwZSA9PT0gJ25hbWUnKSB7XG4gICAgICBuc1tub2RlLmNoaWxkcmVuWzBdLnZhbHVlXSA9IHRydWU7XG4gICAgICBpZihub2RlLmNoaWxkcmVuWzFdICYmIG5vZGUuY2hpbGRyZW5bMV0udHlwZSA9PT0gJ2Fzc2lnbicpIHtcbiAgICAgICAgbnNbbm9kZS5jaGlsZHJlblswXS52YWx1ZV0gPSBub2RlLmNoaWxkcmVuWzJdO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFRPRE86IGZpeCB0aGlzXG4gICAgdmFyIGNoaWxkcmVuID0gbm9kZS5jaGlsZHJlbjtcbiAgICB2YXIgX2tleXM2ID0gT2JqZWN0LmtleXMoY2hpbGRyZW4pO1xuICAgIGZvcih2YXIgX2luZGV4NiA9IDA7IF9pbmRleDYgPCBfa2V5czYubGVuZ3RoOyBfaW5kZXg2KyspIHtcbiAgICAgIHZhciBuID0gY2hpbGRyZW5bX2tleXM2W19pbmRleDZdXTtcbiAgICAgIGlmKG4udHlwZSA9PT0gJ25hbWUnIHx8IG4udHlwZSA9PT0gJ0ZVTkNfREVGX1BBUkFNUycgfHwgbi50eXBlID09PSAnY29tbWEnIHx8IG4udHlwZSA9PT0gJ3dpbmRvdycpIHtcbiAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShuKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgQVNTSUdOOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBwcmVmaXggPSBcIlwiO1xuICAgIHZhciBzdHIgPSBcIlwiO1xuICAgIHZhciBvcCA9IG5vZGUuY2hpbGRyZW4ub3AudmFsdWU7XG4gICAgdmFyIGV4cGxpY2l0X2dsb2JhbCA9IG9wID09PSAnOj0nO1xuICAgIGlmKGV4cGxpY2l0X2dsb2JhbCkge1xuICAgICAgb3AgPSAnPSc7XG4gICAgfVxuICAgIFxuICAgIHZhciBucyA9IGN1cnJlbnROcygpO1xuICAgIHZhciBsZWZ0ID0gbm9kZS5jaGlsZHJlbi5sZWZ0O1xuICAgIHZhciByaWdodF9jb2RlID0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucmlnaHQpO1xuICAgIGlmKGxlZnQudHlwZSA9PT0gJ1NUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUicpIHtcbiAgICAgIHVucGFja2luZysrO1xuICAgICAgdmFyIHVucGFja19uYW1lID0gJ19fdW5wYWNrJyArIHVucGFja2luZztcbiAgICAgIHN0ciArPSAndmFyICcgKyB1bnBhY2tfbmFtZSArIFwiID0gXCIgKyByaWdodF9jb2RlICsgXCJcXG5cIiArIHNwKCk7XG4gICAgICB2YXIgY2hpbGRyZW4gPSBsZWZ0LmNoaWxkcmVuO1xuICAgICAgdmFyIGkgPSAwO1xuICAgICAgdmFyIF9rZXlzNyA9IE9iamVjdC5rZXlzKGNoaWxkcmVuKTtcbiAgICAgIGZvcih2YXIgX2luZGV4NyA9IDA7IF9pbmRleDcgPCBfa2V5czcubGVuZ3RoOyBfaW5kZXg3KyspIHtcbiAgICAgICAgdmFyIGNoaWxkID0gY2hpbGRyZW5bX2tleXM3W19pbmRleDddXTtcbiAgICAgICAgdmFyIG4gPSBjaGlsZC5jaGlsZHJlblswXTtcbiAgICAgICAgcHJlZml4ID0gXCJcIjtcbiAgICAgICAgaWYobi50eXBlID09PSAnbmFtZScpIHtcbiAgICAgICAgICBpZihjdXJyZW50TnNIYXMobi52YWx1ZSkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbnNbbi52YWx1ZV0gPSB0cnVlO1xuICAgICAgICAgICAgaWYoIWV4cGxpY2l0X2dsb2JhbCkge1xuICAgICAgICAgICAgICBwcmVmaXggPSAnJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICBzdHIgKz0gcHJlZml4ICsgZ2VuZXJhdGVDb2RlKG4pICsgJyAnICsgb3AgKyAnICcgKyB1bnBhY2tfbmFtZSArICdbJyArIGkgKyAnXTtcXG4nICsgc3AoKTtcbiAgICAgICAgaSsrO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG4gICAgaWYobGVmdC5jaGlsZHJlblswXS50eXBlID09PSAnbmFtZScpIHtcbiAgICAgIHZhciBjaCA9IGxlZnQuY2hpbGRyZW5bMF07XG4gICAgICBpZighY3VycmVudE5zSGFzKGNoLnZhbHVlKSkge1xuICAgICAgICBpZighZXhwbGljaXRfZ2xvYmFsKSB7XG4gICAgICAgICAgcHJlZml4ID0gJ3ZhciAnO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBuc1tjaC52YWx1ZV0gPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcHJlZml4ICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ubGVmdCkgKyAnICcgKyBvcCArICcgJyArIHJpZ2h0X2NvZGU7XG4gIH1cbiAgLFxuICBTVEFURU1FTlQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciA9ICcnO1xuICAgIHZhciBjaGlsZHJlbiA9IG5vZGUuY2hpbGRyZW47XG5cbiAgICB2YXIgX2tleXM4ID0gT2JqZWN0LmtleXMoY2hpbGRyZW4pO1xuICAgIGZvcih2YXIgX2luZGV4OCA9IDA7IF9pbmRleDggPCBfa2V5czgubGVuZ3RoOyBfaW5kZXg4KyspIHtcbiAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW19rZXlzOFtfaW5kZXg4XV07XG4gICAgICB2YXIgZSA9IGNoaWxkLmNoaWxkcmVuICYmIGNoaWxkLmNoaWxkcmVuWzBdO1xuICAgICAgLy8gVE9ETzogdGhpcyBzaG91bGQgYmUgcG9zc2libGVcbiAgICAgIHZhciB0ID0gY2hpbGQudHlwZTtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoY2hpbGQpO1xuICAgICAgdmFyIG90aGVyID0gZSAmJiAoZS50eXBlID09PSAnRlVOQ19ERUYnIHx8IGUudHlwZSA9PT0gJ0xBTUJEQScpO1xuICAgICAgaWYodCA9PT0gJ0ZPUicgfHwgdCA9PT0gJ1RSWV9DQVRDSCcgfHwgdCA9PT0gJ1dISUxFJyB8fCB0ID09PSAnSUYnIHx8IHQgPT09ICdTVEFURU1FTlQnIHx8IHQgPT09ICdzYW1lZGVudCcgfHwgb3RoZXIpIHtcbiAgICAgICAgXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgKz0gJzsnO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgLFxuICBJRjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyID0gJyc7XG4gICAgc3RyID0gJ2lmKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcpIHsnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYikgKyAnXFxuJyArIHNwKCkgKyAnfSc7XG4gICAgdmFyIGVsaWYgPSBub2RlLmNoaWxkcmVuLmVsaWY7XG4gICAgaWYoZWxpZikge1xuICAgICAgaWYoQXJyYXkuaXNBcnJheShlbGlmKSkge1xuICAgICAgICB2YXIgX2tleXM5ID0gT2JqZWN0LmtleXMoZWxpZik7XG4gICAgICAgIGZvcih2YXIgX2luZGV4OSA9IDA7IF9pbmRleDkgPCBfa2V5czkubGVuZ3RoOyBfaW5kZXg5KyspIHtcbiAgICAgICAgICB2YXIgdmFsdWUgPSBlbGlmW19rZXlzOVtfaW5kZXg5XV07XG4gICAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZSh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoZWxpZik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYobm9kZS5jaGlsZHJlbi5lbCkge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmVsKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuICAsXG4gIElGX0VYUFI6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHN0ciA9ICcnO1xuICAgIHN0ciA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnRlc3QpICsgJyA/ICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcgOiAnO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uZWwpIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciArPSAndW5kZWZpbmVkJztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHN0cjtcbiAgfVxuICAsXG4gIEVMU0VfRVhQUjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYik7XG4gIH1cbiAgLFxuICBXSElMRTogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJ3doaWxlKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcpeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgfVxuICAsXG4gIEZPUjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIga2V5SW5kZXhOYW1lID0gXCJfaW5kZXhcIiArIGZvckxvb3BDb3VudDtcbiAgICB2YXIga2V5QXJyYXlOYW1lID0gXCJfa2V5c1wiICsgZm9yTG9vcENvdW50O1xuICAgIHZhciBhcnJheU5hbWUgPSBub2RlLmNoaWxkcmVuLmEudmFsdWU7XG4gICAgdmFyIHZhck5hbWUgPSBub2RlLmNoaWxkcmVuLnYudmFsdWU7XG4gICAgZm9yTG9vcENvdW50Kys7XG4gICAgdmFyIGluZGV4TmFtZSA9IGZhbHNlO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uaykge1xuICAgICAgaW5kZXhOYW1lID0gbm9kZS5jaGlsZHJlbi5rLnZhbHVlO1xuICAgIH1cbiAgICBcbiAgICB2YXIgc3RyID0gJ3ZhciAnICsga2V5QXJyYXlOYW1lICsgJyA9IE9iamVjdC5rZXlzKCcgKyBhcnJheU5hbWUgKyAnKTtcXG4nO1xuICAgIHN0ciArPSBzcCgpICsgJ2Zvcih2YXIgJyArIGtleUluZGV4TmFtZSArICcgPSAwOyAnICsga2V5SW5kZXhOYW1lICsgJyA8ICcgKyBrZXlBcnJheU5hbWUgKyAnLmxlbmd0aDsgJyArIGtleUluZGV4TmFtZSArICcrKykge1xcbic7XG4gICAgaWYoaW5kZXhOYW1lKSB7XG4gICAgICBzdHIgKz0gc3AoMSkgKyAndmFyICcgKyBpbmRleE5hbWUgKyAnID0gJyArIGtleUFycmF5TmFtZSArICdbJyArIGtleUluZGV4TmFtZSArICddO1xcbic7XG4gICAgfVxuICAgIFxuICAgIHN0ciArPSBzcCgxKSArICd2YXIgJyArIHZhck5hbWUgKyAnID0gJyArIGFycmF5TmFtZSArICdbJyArIGtleUFycmF5TmFtZSArICdbJyArIGtleUluZGV4TmFtZSArICddXTsnO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgICByZXR1cm4gc3RyO1xuICB9XG4gICxcbiAgRUxTRV9JRjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyBlbHNlIGlmKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcpIHsnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYikgKyAnXFxuJyArIHNwKCkgKyAnfSc7XG4gIH1cbiAgLFxuICBFTFNFOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnIGVsc2UgeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgfVxuICAsXG4gIFRSWV9DQVRDSDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgc3RyID0gXCJ0cnkge1wiO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iMSk7XG4gICAgc3RyICs9ICdcXG4nICsgc3AoKSArIFwifSBjYXRjaChcIiArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmVycikgKyBcIikge1wiO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iMik7XG4gICAgcmV0dXJuIHN0ciArICdcXG4nICsgc3AoKSArIFwifVwiO1xuICB9XG4gICxcbiAgU1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSOiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHZhciBlbGVtZW50cyA9IFtdO1xuICAgIHZhciBjaGlsZHJlbiA9IG5vZGUuY2hpbGRyZW47XG4gICAgdmFyIF9rZXlzMTAgPSBPYmplY3Qua2V5cyhjaGlsZHJlbik7XG4gICAgZm9yKHZhciBfaW5kZXgxMCA9IDA7IF9pbmRleDEwIDwgX2tleXMxMC5sZW5ndGg7IF9pbmRleDEwKyspIHtcbiAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW19rZXlzMTBbX2luZGV4MTBdXTtcbiAgICAgIGVsZW1lbnRzLnB1c2goZ2VuZXJhdGVDb2RlKGNoaWxkKSk7XG4gICAgfVxuICAgIHJldHVybiAnWycgKyBlbGVtZW50cy5qb2luKFwiLCBcIikgKyAnXSc7XG4gIH1cbiAgLFxuICBzdHJpbmc6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgdmFyIHYgPSBub2RlLnZhbHVlO1xuICAgIHYgPSB2LnJlcGxhY2UoL1xcbi9nLCBcIlxcXFxuXCIpO1xuICAgIHZhciBhc3QgPSBzdHJHcmFtLnBhcnNlKHYpO1xuICAgIGlmKCFhc3QuY29tcGxldGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihhc3QuaGludCk7XG4gICAgfVxuICAgIHJldHVybiBnZW5lcmF0ZVN0cmluZ0NvZGUoYXN0LCB2LmNoYXJBdCgwKSk7XG4gIH1cbiAgLFxuICBjb21tZW50OiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiBub2RlLnZhbHVlLnJlcGxhY2UoL14jL2csIFwiLy9cIik7XG4gIH1cbiAgLFxuICBwYXp6OiBmdW5jdGlvbiAobm9kZSkge1xuICAgIHJldHVybiAnJztcbiAgfVxuICAsXG4gIG5vdDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gJyEnO1xuICB9XG4gICxcbiAgY29tcGFyaXNvbjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICBpZihub2RlLnZhbHVlID09PSAnPT0nKSB7XG4gICAgICByZXR1cm4gJz09PSc7XG4gICAgfVxuICAgIFxuICAgIGlmKG5vZGUudmFsdWUgPT09ICchPScpIHtcbiAgICAgIHJldHVybiAnIT09JztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG5vZGUudmFsdWU7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIGdlbmVyYXRlQ29kZShub2RlKSB7XG4gIGlmKCFub2RlKSB7XG4gICAgLy8gZGVidWdnZXJcbiAgfVxuICBpZihiYWNrZW5kW25vZGUudHlwZV0pIHtcbiAgICByZXR1cm4gYmFja2VuZFtub2RlLnR5cGVdKG5vZGUpO1xuICB9XG4gIFxuICBpZihub2RlLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgfVxuICBcbiAgdmFyIHN0ciA9IFwiXCI7XG4gIGlmKCFub2RlLmNoaWxkcmVuKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG4gIFxuICB2YXIgY2hpbGRyZW4gPSBub2RlLmNoaWxkcmVuO1xuICB2YXIgX2tleXMxMSA9IE9iamVjdC5rZXlzKGNoaWxkcmVuKTtcbiAgZm9yKHZhciBfaW5kZXgxMSA9IDA7IF9pbmRleDExIDwgX2tleXMxMS5sZW5ndGg7IF9pbmRleDExKyspIHtcbiAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltfa2V5czExW19pbmRleDExXV07XG4gICAgc3RyICs9IGdlbmVyYXRlQ29kZShjaGlsZCk7XG4gIH1cbiAgXG4gIHJldHVybiBzdHI7XG59XG5cblxuZnVuY3Rpb24gZ2VuZXJhdGVFeHBvcnRzKGtleXMpIHtcbiAgdmFyIHN0ciA9ICdcXG5tb2R1bGUuZXhwb3J0cyA9IHsnO1xuICBrZXlzID0ga2V5cyB8fCBPYmplY3Qua2V5cyhjdXJyZW50TnMoKSk7XG4gIHZhciBfa2V5czEyID0gT2JqZWN0LmtleXMoa2V5cyk7XG4gIGZvcih2YXIgX2luZGV4MTIgPSAwOyBfaW5kZXgxMiA8IF9rZXlzMTIubGVuZ3RoOyBfaW5kZXgxMisrKSB7XG4gICAgdmFyIGtleSA9IGtleXNbX2tleXMxMltfaW5kZXgxMl1dO1xuICAgIHN0ciArPSAnXFxuICAnICsga2V5ICsgJzogJyArIGtleSArICcsJztcbiAgfVxuICByZXR1cm4gc3RyICsgJ1xcbn0nO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZU1vZHVsZShpbnB1dCxvcHRzKSB7XG4gIHJlc2V0R2xvYmFsKCk7XG4gIHZhciBhc3QgPSBncmFtLnBhcnNlKGlucHV0ICsgXCJcXG5cIik7XG4gIGlmKCFhc3QuY29tcGxldGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYXN0LmhpbnQpO1xuICB9XG4gIFxuICB2YXIgb2JqID0ge2FzdDogYXN0LCBjb2RlOiBnZW5lcmF0ZUNvZGUoYXN0KSwgbnM6IGN1cnJlbnROcygpfTtcbiAgcmV0dXJuIG9iajtcbn1cblxudmFyIGdyYW0gPSBlcGVnanMuY29tcGlsZUdyYW1tYXIoZ3JhbW1hckRlZiwgdG9rZW5EZWYpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZ3JhbW1hcjogZ3JhbSxcbiAgc3RyR3JhbW1hcjogc3RyR3JhbSxcbiAgZ3JhbW1hckRlZjogZ3JhbW1hckRlZixcbiAgZXBlZ2pzOiBlcGVnanMsXG4gIHRva2VuRGVmOiB0b2tlbkRlZixcbiAgZ2VuZXJhdGVNb2R1bGU6IGdlbmVyYXRlTW9kdWxlLFxuICBnZW5lcmF0ZUNvZGU6IGdlbmVyYXRlQ29kZSxcbiAgZ2VuZXJhdGVFeHBvcnRzOiBnZW5lcmF0ZUV4cG9ydHNcbn07XG5cblxuIl19
