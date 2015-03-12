!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.cokescript=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
  CokeScript language by Batiste Bieler 2015
  Implemented using EPEG.JS
*/
"use strict";

var epegjs = require("epegjs");

var depth = 0;
var forLoopCount = 1;
var unpacking = 0;
var namespaces = [{}];
var levelStack = [0];

function currentNs() {
  return namespaces[namespaces.length -1];
}

function newNs() {
  namespaces.push({});
  return namespaces[namespaces.length -1];
}

function resetGlobal() {
  namespaces = [{}];
  forLoopCount = 1;
  levelStack = [0];
  depth = 0;
  unpacking = 0;
}

// token are matched in order of declaration
// TODO: add functions
var tokenDef = [
  {key:"string", func:stringDef},
  {key:"comment", func:commentDef},
  {key:"function_def", func: defDef, verbose:"function definition"},
  {key:"class", reg:/^class /},
  {key:"ret", reg:/^return/, verbose:"return"},
  {key:"if", reg:/^if /},
  {key:"while", reg:/^while /},
  {key:"try", reg:/^try/},
  {key:"catch", reg:/^catch/},
  {key:"throw", reg:/^throw /},
  {key:"new", reg:/^new /},
  {key:"tag", reg:/^<[a-zA-Z][0-9a-zA-Z]{0,29}/},
  {key:">", reg:/^>/},
  {key:"elseif", reg:/^elseif /},
  {key:"else", reg:/^else/},
  {key:"for_loop", reg:/^for /, verbose:"for loop"},
  {key:"in", reg:/^in /},
  {key:"name", reg:/^[a-zA-Z_$][0-9a-zA-Z_$]{0,29}/}, // 30 chars max
  {key:"regexp", func:regExpDef, verbose:"regular epression"},
  {key:"math_operators", reg:/^(\+\+|\-\-)/, verbose:"math operator"},
  {key:"binary_operators", reg:/^(\&\&|\|\||\&|\||<<|\>\>)/, verbose:"binary operator"},
  {key:"comparison", reg:/^(<=|>=|<|>|!=|==)/},
  {key:"assign", reg:/^(\+=|-=|=|:=)/},
  {key:"number", reg:/^[0-9]+\.?[0-9]*/}, // only positive for now
  {key:"comma", reg:/^\,/},
  {key:"dot", reg:/^\./},
  {key:"colon", reg:/^\:/, verbose:":"},
  {key:"open_par", reg:/^\(/, verbose:"("},
  {key:"close_par", reg:/^\)/, verbose:")"},
  {key:"open_bra", reg:/^\[/, verbose:"["},
  {key:"close_bra", reg:/^\]/, verbose:"]"},
  {key:"open_curly", reg:/^\{/, verbose:"{"},
  {key:"close_curly", reg:/^\}/, verbose:"}"},
  {key:"math", reg:/^[-|\+|\*|/|%]/},
  {key:"samedent", func:dent('samedent'), verbose:"same indentation"},
  {key:"dedent", func:dent('dedent')},
  {key:"indent", func:dent('indent')},
  //newline: /^(\r?\n|$)/,
  {key:"W", reg:/^[ ]/, verbose:"single whitespace"},
];

function startStr(input, stream) {
  var last = stream[stream.length-1];
  if(last && last.value === '\\') {
    return;
  }
  if(input.match(/^#{/)) {
    return '#{';
  }
}

var strInterpolationTokenDef = [
  {key:"start", func:startStr},
  {key:"end", reg:/^}/},
  {key:"name", reg:/^[a-zA-Z_$][0-9a-zA-Z_]{0,29}/},
  {key:"dot", reg:/^\./},
  {key:"char", reg:/^./},
];

var strInterpolationGrammarDef = {
  "START": {rules:["EL* EOF"]},
  "EL": {rules:["VAR", "char", "name", "start", "end", "dot"]},
  "VAR": {rules:["start NAME end"]},
  "NAME": {rules:["name dot NAME", "name"]},
};

var strGram = epegjs.compileGrammar(strInterpolationGrammarDef, strInterpolationTokenDef);

function generateStringCode(node) {
  if(node.type === 'VAR') {
    return '" + ' + generateStringCode(node.children[1]) + ' + "';
  }
  if(node.value !== undefined) {
    return node.value;
  }
  var str = "", i;
  if(!node.children) {
    return '';
  }
  for(i=0;i<node.children.length; i++) {
    str += generateStringCode(node.children[i]);
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
        if(dentType == 'dedent') {
          levelStack.pop();
          return '';
        }
        if(dentType == 'indent') {
          levelStack.push(indent);
        }
        return m[0];
      }
    }
  };
}

function stringDef(input) {
  if(input.charAt(0) === '"') {
    var i = 1;
    while(input.charAt(i)) {
      var ch = input.charAt(i);
      if(ch === '\\') {
        i++;
      } else if(ch === '"') {
        return input.slice(0, i+1);
      }
      i++;
    }
  }
}

function regExpDef(input) {
  if(input.charAt(0) === '/') {
    var i = 1;
    while(input.charAt(i)) {
      var ch = input.charAt(i);
      if(ch === '\\') {
        i++;
      } else if(ch === '/') {
        i++;
        // modifiers
        while("igm".indexOf(input.charAt(i)) !== -1) {
          i++;
        }
        return input.slice(0, i);
      }
      i++;
    }
  }
}

function defDef(input) {
  if(input.indexOf("def(") === 0) {
    return "def";
  }
  if(input.indexOf("def ") === 0) {
    return "def";
  }
  if(input.indexOf("def\n") === 0) {
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
    while(input.charAt(i)) {
      var ch = input.charAt(i);
      if(ch === '\n') {
        return input.slice(0, i);
      }
      i++;
    }
  }
}

function reflect(params) {
  return params;
}

var grammarDef = {
  "START": {rules:["LINE* EOF"]},
  "ELC": {rules:["W* comment"], verbose:"comment"},
  "LINE": {rules:["STATEMENT ELC? samedent+", "STATEMENT ELC? !dedent", 
    "ELC? samedent", "ELC !dedent"], verbose:"new line"},
  "BLOCK": {rules: ["indent LINE+ dedent"]},
  "STATEMENT": {rules:["ASSIGN", "EXPR", "IF", "WHILE", "FOR", "RETURN", 
    "CLASS", "TAG", "DOM_ASSIGN", "TRY_CATCH", "THROW"]},
  "CLASS_METHODS": {
      rules: ["samedent* f:FUNC_DEF samedent*"],
      hooks: [ function(p){ return p.f; }]
  },
  "CLASS": {
    rules: [
      "class n:name open_par p:name close_par indent m:CLASS_METHODS+ dedent",
      "class n:name indent m:CLASS_METHODS+ dedent"
    ],
    hooks: [
      function(p){ return {name:p.n, methods:p.m, parent:p.p}; },
      function(p){ return {name:p.n, methods:p.m}; }
    ]
  },
  "FUNC_DEF_PARAMS": {rules:[
      "p1:FUNC_DEF_PARAMS comma W p2:FUNC_DEF_PARAMS",
      "p1:name assign e:EXPR",
      "p1:name",
    ],
    verbose:"function parameters"
  },
  "LAMBDA": {rules:[
      "fd:function_def open_par params:FUNC_DEF_PARAMS? close_par W block:EXPR",
      "fd:function_def W fn:name open_par params:FUNC_DEF_PARAMS? close_par W block:EXPR",
      "fd:function_def W block:EXPR",
    ],
    hooks: [reflect, reflect, reflect]
  },
  "FUNC_DEF": {rules:[
      "fd:function_def open_par params:FUNC_DEF_PARAMS? close_par block:BLOCK",
      "fd:function_def W fn:name open_par params:FUNC_DEF_PARAMS? close_par block:BLOCK",
      "fd:function_def W fn:name block:BLOCK",
      "fd:function_def block:BLOCK",
    ],
    hooks: [reflect, reflect, reflect, reflect],
    verbose:"function definition"
  },
  "ELSE_IF": {rules:["samedent elseif e:EXPR b:BLOCK"], hooks:[reflect]},
  "ELSE": {rules:["samedent else b:BLOCK"], hooks:[reflect]},
  "IF": {rules:["if e:EXPR b:BLOCK elif:ELSE_IF* el:ELSE?"], hooks:[reflect]},
  "ELSE_EXPR": {rules:["W else W b:EXPR"], hooks:[reflect]},
  "IF_EXPR": {rules:["e:EXPR W if test:EXPR el:ELSE_EXPR?"], hooks:[reflect]},
  "WHILE": {rules:["while e:EXPR b:BLOCK"], hooks:[reflect]},
  "MATH": {rules:["e1:EXPR W op:math W e2:EXPR"]},
  "PATH": {rules:["PATH dot name", "PATH open_bra number close_bra", "name"]},
  "ASSIGN": {rules:[
    "left:STRICT_COMMA_SEPARATED_EXPR W op:assign W right:EXPR",
    "left:EXPR W op:assign W right:EXPR"
  ], hooks:[reflect, reflect]},
  "W_OR_SAMEDENT": {rules:["W", "samedent"], verbose: "samedent or whitespace"},
  "W_SAMEDENT_INDENT": {rules:["W", "samedent", "indent"], verbose: "indent or samedent or whitespace"},
  "ANY_SPACE": {rules:["W", "samedent", "indent", "dedent"], verbose: "any space"},
  // TODO: why ANY_SPACE* here?
  "FUNC_CALL_PARAMS": {rules:["EXPR comma ANY_SPACE+ FUNC_CALL_PARAMS ANY_SPACE*", "EXPR ANY_SPACE*"]},
  "FUNC_CALL": {rules:[
    "open_par FUNC_CALL_PARAMS? close_par",
    //"open_par indent FUNC_CALL_PARAMS? dedent samedent close_par",
    //"open_par indent FUNC_CALL_PARAMS? close_par dedent"
  ]},

  "TYPE": {rules:["name colon"]},

  "FOR": {rules:[
    "for_loop k:name comma W v:name W in t:TYPE? a:name b:BLOCK",
    "for_loop v:name W in t:TYPE? a:name b:BLOCK"],
    hooks: [reflect, reflect]
  },

  "STRICT_COMMA_SEPARATED_EXPR": {rules:[
    "e1:EXPR comma W e2:STRICT_COMMA_SEPARATED_EXPR",
    "e1:EXPR comma W e2:EXPR"
  ],
  hooks: [function(p) {
    // unroll recusrion
    return [p.e1].concat(p.e2.children);
  },
  function(p) {
    return [p.e1, p.e2];
  }] 
  },

  "COMMA_SEPARATED_EXPR": {rules:[
    "EXPR comma ANY_SPACE+ COMMA_SEPARATED_EXPR ANY_SPACE*",
    "EXPR ANY_SPACE*"
  ]},

  "ARRAY": {rules:[
    "open_bra ANY_SPACE* c:COMMA_SEPARATED_EXPR? ANY_SPACE* close_bra",
    //"open_bra indent c:COMMA_SEPARATED_EXPR? dedent samedent close_bra",
    //"open_bra indent c:COMMA_SEPARATED_EXPR? close_bra dedent",
  ]},

  "MEMBERS": {rules:[
    "name colon W EXPR samedent? comma ANY_SPACE+ MEMBERS ANY_SPACE*",
    "name colon W EXPR ANY_SPACE*"
  ]},

  "OBJECT": {rules:[
    "open_curly indent? MEMBERS? close_curly",
  ]},

  "TAG_PARAMS": {rules:[
      "left:TAG_PARAMS W right:TAG_PARAMS",
      "n:name assign e:EXPR",
      "n:name",
    ],
    hooks:[reflect, reflect, reflect],
    verbose:"tag parameters"
  },

  "TAG": {rules:[
    "tag:tag W? params:TAG_PARAMS? end:>? block:BLOCK?",
  ],
  hooks:[reflect]
  },

  "DOM_ASSIGN": {rules:[
    "assign EXPR",
  ]},

  "TRY_CATCH": {
    rules:[
      "try b1:BLOCK samedent? catch open_par err:name? close_par b2:BLOCK",
    ],
    hooks:[reflect],
  },

  "THROW": {rules:[
    "throw EXPR",
  ]},

  "RETURN": {rules:["ret W STRICT_COMMA_SEPARATED_EXPR", "ret W EXPR", "ret"]},
  "RIGHT_EXPR": {rules: [
    "math_operators",
    "W binary_operators W EXPR",
    "W comparison W EXPR",
    "W > W EXPR",
    "dot EXPR",
    "open_bra EXPR close_bra",
    "FUNC_CALL"
    ],
    verbose:"expression"
  },

  "EXPR": {rules: [
    "IF_EXPR",
    "MATH",
    "OBJECT",
    "FUNC_DEF",
    "EXPR RIGHT_EXPR",
    //"FUNC_CALL",
    "LAMBDA",
    "number",
    "regexp",
    "open_par EXPR close_par",
    "new EXPR",
    "string",
    "name",
    "PATH",
    "ARRAY"],
    verbose:"expression"
  },
};

function spacer(n) {
  var out = "";
  for(var i=0; i<n; i++) {
    out += " ";
  }
  return out;
}

function sp(mod) {
  if(mod) {
    return spacer(2 * (depth+mod));
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

  'dedent': function(node) {
    depth = Math.max(0, depth - 1);
    return '';
  },
  'indent': function(node) {
    depth = depth + 1;
    return '\n'+sp();
  },
  'samedent': function(node) {
    return '\n'+sp();
  },
  'DOM_ASSIGN': function(node) {
    var name = CN();
    return name+'.push(String(' + generateCode(node.children[1]) + '))';
  },
  'TAG_PARAMS': function(node) {
    if(node.children.left) {
      return generateCode(node.children.left) + ', ' + generateCode(node.children.right);
    }
    if(node.children.e) {
      return node.children.n.value + ':' + generateCode(node.children.e);
    } else {
      return node.children.n.value + ': true';
    }
  },
  'TAG': function(node) {
    var str = '', i, params = "{";
    var name = node.children.tag.value.substring(1);
    if(node.children.params) {
      params += generateCode(node.children.params);
    }
    params += '}';
    var sub = '[]';
    if(node.children.block) {
      sub = pushCN();
      str += 'var ' + CN() + ' = [];';
      str += generateCode(node.children.block);
      popCN();
    }
    str += '\n' + sp(1) + CN() + '.push(h("'+name+'", '+params+', '+sub+'))';
    return str;
  },
  'CLASS': function(node) {
    var name = node.children.name.value, i;
    var funcs = node.children.methods;
    var parent = node.children.parent;
    var str = '';
    var constructor = null;
    for(i=0;i<funcs.length; i++) {
      var func_def = funcs[i].children;
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
    var cons_str = 'var ' + name + ' = function ' + name + '('+ params + ') {';
    cons_str += '\n'+sp(1)+'if(!(this instanceof '+name+')){ return new '+name+'('+Object.keys(ns).join(',')+');}';
    for(var key in ns) {
      if(ns[key] !== true && ns[key] !== undefined) {
        cons_str += '\n'+sp(1)+'if('+key+' === undefined) {'+key+' = '+generateCode(ns[key])+'};';
      }
    }
    if(body) {
      cons_str += generateCode(body);
    }
    cons_str += sp() + '\n}';

    if(parent) {
      cons_str += '\n'+sp() + name + '.prototype = Object.create(' + parent.value + '.prototype);';
      cons_str += '\n'+sp() + name + '.prototype.constructor = '+name+'';
      //cons_str += '\n'+sp() + name + '.prototype.super = function(){' + parent.value + '.apply(this, arguments);}';
    }

    namespaces.pop();
    return cons_str + str;
  },
  'LAMBDA': function(node) {
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
    for(var key in ns) {
      if(ns[key] !== true && ns[key] !== undefined) {
        str += '\n'+sp(1)+'if('+key+' === undefined) {'+key+' = '+generateCode(ns[key])+'};';
      }
    }
    if(node.children.block) {
      str += ' return ' + generateCode(node.children.block, ns);
    }
    namespaces.pop();
    return str + "; }";
  },
  'FUNC_DEF': function(node) {
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
    for(var key in ns) {
      if(ns[key] !== true && ns[key] !== undefined) {
        str += '\n'+sp(1)+'if('+key+' === undefined) {'+key+' = '+generateCode(ns[key])+';}';
      }
    }
    if(is_dom) {
      str += '\n'+sp(1) + 'var ' + CN() + ' = [];';
    }

    if(node.children.block) {
      str += generateCode(node.children.block);
    }
    namespaces.pop();

    if(is_dom) {
      str += '\n'+sp(1) + 'return ' + CN() + ';';
    }
    return str + '\n'+sp()+'}';
  },
  'FUNC_DEF_PARAMS': function(node) {
    var str = "", i;
    var ns = currentNs();
    if(node.children[0].type === 'name') {
      ns[node.children[0].value] = true;
      if(node.children[1] && node.children[1].type === 'assign') {
        ns[node.children[0].value] = node.children[2];
      }
    }
    for(i=0;i<node.children.length; i++) {
      var n = node.children[i];
      if(n.type === 'name' || n.type === 'FUNC_DEF_PARAMS' || n.type === 'comma' || n.type === 'window') {
        str += generateCode(node.children[i]);
      }
    }
    return str;
  },
  'ASSIGN': function(node) {
    var prefix = "", str = "", i;
    var op = node.children.op.value;
    var explicit_global = op === ':=';
    if(op == ':=') {
      op = '=';
    }
    var ns = currentNs();
    var left = node.children.left;
    var right_code = generateCode(node.children.right);
    if(left.type === 'STRICT_COMMA_SEPARATED_EXPR') {
      unpacking++;
      var unpack_name = '__unpack' + unpacking;
      str += 'var ' + unpack_name + ' = ' + right_code + ';\n'+sp();
      for(i=0;i<left.children.length; i++) {
        var n = left.children[i].children[0];
        prefix = "";
        if(n.type === 'name') {
          if(ns[n.value] === undefined) {
            ns[n.value] = true;
            if(!explicit_global) {
              prefix = 'var ';
            }
          }
        }
        str += prefix + generateCode(n) + ' ' + op + ' ' + unpack_name +'['+i+'];\n'+sp();
      }
      return str;
    }
    if(left.children[0].type === 'name') {
      var ch = left.children[0];
      if(ns[ch.value] === undefined) {
        if(!explicit_global) {
          prefix = 'var ';
        }
        ns[ch.value] = true;
      }
    }
    return prefix + generateCode(node.children.left) + ' ' + op + ' ' + right_code;
  },
  'STATEMENT': function(node) {
    var e = node.children[0].children[0];
    if(node.children[0].type === 'FOR' || 
       node.children[0].type === 'TRY_CATCH' || 
       node.children[0].type === 'WHILE' || 
       e && (e.type === 'FUNC_DEF' || e.type === 'LAMBDA')) {
      return generateCode(node.children[0]);
    }
    return generateCode(node.children[0]) + ';';
  },
  'IF': function(node) {
    var str = '';
    str = 'if('+generateCode(node.children.e) + '){' + generateCode(node.children.b) + '\n'+sp()+'}';
    var elif = node.children.elif;
    if(elif) {
      if(Array.isArray(elif)) {
        for (var i = 0; i < elif.length; i++) {
          str += generateCode(elif[i]);
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
  'IF_EXPR': function(node) {
    var str = '';
    str = generateCode(node.children.test) + ' ? ' + generateCode(node.children.e) + ' : ';
    if(node.children.el) {
      str += generateCode(node.children.el);
    } else {
      str += 'undefined';
    }
    return str;
  },
  'ELSE_EXPR': function(node) {
    return generateCode(node.children.b);
  },
  'WHILE': function(node) {
    return 'while('+generateCode(node.children.e) + '){' + generateCode(node.children.b) + '\n'+sp()+'}';
  },
  'FOR': function(node) {
    var keyIndexName = "_index" + forLoopCount;
    var keyArrayName = "_keys" + forLoopCount;
    forLoopCount++;
    var indexName = false;
    if(node.children.k) {
      indexName = node.children.k.value;
    }
    var str = 'var '+keyArrayName+' = Object.keys('+node.children.a.value+');\n';
    str += sp() + 'for(var '+keyIndexName+' = 0; '+keyIndexName+' < '+keyArrayName+'.length; '+keyIndexName+'++ ) {\n';
    if(indexName) {
      str += sp(1) + 'var ' + indexName + ' = ' + keyArrayName +'[' + keyIndexName + '];\n';
    }
    str += sp(1) + 'var ' + node.children.v.value + ' = ' + node.children.a.value + '[' + keyArrayName +'[' + keyIndexName + ']];';
    str += generateCode(node.children.b) +'\n'+sp()+'}';
    return str;
  },
  'ELSE_IF': function(node) {
    return ' else if('+generateCode(node.children.e)+') {'+generateCode(node.children.b)+ '\n'+sp()+'}';
  },
  'ELSE': function(node) {
    return ' else {'+generateCode(node.children.b)+ '\n'+sp()+'}';
  },
  'TRY_CATCH': function(node) {
    var str = "try {";
    str += generateCode(node.children.b1);
    str += '\n'+sp()+"} catch("+generateCode(node.children.err)+") {";
    str += generateCode(node.children.b2);
    return str+'\n'+sp()+"}";
  },
  'RETURN': function(node) {
    if(!node.children[2]) {
      return 'return';
    }
    if(node.children[2].type == "STRICT_COMMA_SEPARATED_EXPR") {
      return 'return [' + generateCode(node.children[2]) + ']';
    }
    return 'return ' + generateCode(node.children[2]);
  },
  'STRICT_COMMA_SEPARATED_EXPR': function(node) {
    var elements = [];
    for (var i = 0; i < node.children.length; i++) {
      elements.push(generateCode(node.children[i]));
    }
    return elements.join(", ");
  },
  'string': function(node) {
    var v = node.value;
    v = v.replace(/\n/g, "\\n");
    var ast = strGram.parse(v);
    if(!ast.complete) {
      throw new Error(ast.hint);
    }
    return generateStringCode(ast);
  },
  'comment': function(node) {
    return node.value.replace(/^#/g, "//");
  },
  'comparison': function(node) {
    if(node.value == '==') {
      return '===';
    }
    if(node.value == '!=') {
      return '!==';
    }
    return node.value;
  }
};

function generateCode(node) {
  if(!node) {
    //debugger
  }
  if(backend[node.type]) {
    return backend[node.type](node);
  }
  if(node.value !== undefined) {
    return node.value;
  }
  var str = "", i;
  if(!node.children) {
    return '';
  }
  for(i=0;i<node.children.length; i++) {
    str += generateCode(node.children[i]);
  }
  return str;
}

function generateExports(keys) {
  var str = '\nmodule.exports = {';
  keys = keys || Object.keys(currentNs());
  for(var i=0; i < keys.length; i++) {
    str += '\n  ' + keys[i] + ': ' + keys[i] + ',';
  }
  return str + '\n}';
}

function generateModule(input, opts) {
  resetGlobal();
  var ast = gram.parse(input + "\n");
  if(!ast.complete) {
    throw new Error(ast.hint);
  }
  var obj = {ast:ast, code:generateCode(ast), ns:currentNs()};
  return obj;
}

var gram = epegjs.compileGrammar(grammarDef, tokenDef);

module.exports = {
  grammar: gram,
  strGrammar: strGram,
  grammarDef: grammarDef,
  epegjs:epegjs,
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

    // apply rule hooks
    if(hook && !result.hooked) {
      result.children = hook(createParams(result.children));
      result.hooked = true;
    }
    result.hooked = true;

    // it's very important to update the memoized value
    // this is actually growing the seed in the memoization
    memo.children = result.children;
    memo.sp = result.sp;
    memo.start = result.start;
    memo.hooked = result.hooked;
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
          var r = expand_rules[j];
          var hook = hooks && hooks[j];

          result = memoEval(grammar, r, stream, sp);

          if(result) {

            if(hook && !result.hooked) {
              result.children = hook(createParams(result.children));
            }
            result.hooked = true;

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
            children:result.children,
            sp:result.sp,
            name:rtoken.name,
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
    }
    // todo: use a property
    gram[key] = {rules: splitted_rules, hooks: line.hooks || [], verbose:line.verbose};
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb2tlc2NyaXB0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUQxeEJBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKlxuICBDb2tlU2NyaXB0IGxhbmd1YWdlIGJ5IEJhdGlzdGUgQmllbGVyIDIwMTVcbiAgSW1wbGVtZW50ZWQgdXNpbmcgRVBFRy5KU1xuKi9cblwidXNlIHN0cmljdFwiO1xuXG52YXIgZXBlZ2pzID0gcmVxdWlyZShcImVwZWdqc1wiKTtcblxudmFyIGRlcHRoID0gMDtcbnZhciBmb3JMb29wQ291bnQgPSAxO1xudmFyIHVucGFja2luZyA9IDA7XG52YXIgbmFtZXNwYWNlcyA9IFt7fV07XG52YXIgbGV2ZWxTdGFjayA9IFswXTtcblxuZnVuY3Rpb24gY3VycmVudE5zKCkge1xuICByZXR1cm4gbmFtZXNwYWNlc1tuYW1lc3BhY2VzLmxlbmd0aCAtMV07XG59XG5cbmZ1bmN0aW9uIG5ld05zKCkge1xuICBuYW1lc3BhY2VzLnB1c2goe30pO1xuICByZXR1cm4gbmFtZXNwYWNlc1tuYW1lc3BhY2VzLmxlbmd0aCAtMV07XG59XG5cbmZ1bmN0aW9uIHJlc2V0R2xvYmFsKCkge1xuICBuYW1lc3BhY2VzID0gW3t9XTtcbiAgZm9yTG9vcENvdW50ID0gMTtcbiAgbGV2ZWxTdGFjayA9IFswXTtcbiAgZGVwdGggPSAwO1xuICB1bnBhY2tpbmcgPSAwO1xufVxuXG4vLyB0b2tlbiBhcmUgbWF0Y2hlZCBpbiBvcmRlciBvZiBkZWNsYXJhdGlvblxuLy8gVE9ETzogYWRkIGZ1bmN0aW9uc1xudmFyIHRva2VuRGVmID0gW1xuICB7a2V5Olwic3RyaW5nXCIsIGZ1bmM6c3RyaW5nRGVmfSxcbiAge2tleTpcImNvbW1lbnRcIiwgZnVuYzpjb21tZW50RGVmfSxcbiAge2tleTpcImZ1bmN0aW9uX2RlZlwiLCBmdW5jOiBkZWZEZWYsIHZlcmJvc2U6XCJmdW5jdGlvbiBkZWZpbml0aW9uXCJ9LFxuICB7a2V5OlwiY2xhc3NcIiwgcmVnOi9eY2xhc3MgL30sXG4gIHtrZXk6XCJyZXRcIiwgcmVnOi9ecmV0dXJuLywgdmVyYm9zZTpcInJldHVyblwifSxcbiAge2tleTpcImlmXCIsIHJlZzovXmlmIC99LFxuICB7a2V5Olwid2hpbGVcIiwgcmVnOi9ed2hpbGUgL30sXG4gIHtrZXk6XCJ0cnlcIiwgcmVnOi9edHJ5L30sXG4gIHtrZXk6XCJjYXRjaFwiLCByZWc6L15jYXRjaC99LFxuICB7a2V5OlwidGhyb3dcIiwgcmVnOi9edGhyb3cgL30sXG4gIHtrZXk6XCJuZXdcIiwgcmVnOi9ebmV3IC99LFxuICB7a2V5OlwidGFnXCIsIHJlZzovXjxbYS16QS1aXVswLTlhLXpBLVpdezAsMjl9L30sXG4gIHtrZXk6XCI+XCIsIHJlZzovXj4vfSxcbiAge2tleTpcImVsc2VpZlwiLCByZWc6L15lbHNlaWYgL30sXG4gIHtrZXk6XCJlbHNlXCIsIHJlZzovXmVsc2UvfSxcbiAge2tleTpcImZvcl9sb29wXCIsIHJlZzovXmZvciAvLCB2ZXJib3NlOlwiZm9yIGxvb3BcIn0sXG4gIHtrZXk6XCJpblwiLCByZWc6L15pbiAvfSxcbiAge2tleTpcIm5hbWVcIiwgcmVnOi9eW2EtekEtWl8kXVswLTlhLXpBLVpfJF17MCwyOX0vfSwgLy8gMzAgY2hhcnMgbWF4XG4gIHtrZXk6XCJyZWdleHBcIiwgZnVuYzpyZWdFeHBEZWYsIHZlcmJvc2U6XCJyZWd1bGFyIGVwcmVzc2lvblwifSxcbiAge2tleTpcIm1hdGhfb3BlcmF0b3JzXCIsIHJlZzovXihcXCtcXCt8XFwtXFwtKS8sIHZlcmJvc2U6XCJtYXRoIG9wZXJhdG9yXCJ9LFxuICB7a2V5OlwiYmluYXJ5X29wZXJhdG9yc1wiLCByZWc6L14oXFwmXFwmfFxcfFxcfHxcXCZ8XFx8fDw8fFxcPlxcPikvLCB2ZXJib3NlOlwiYmluYXJ5IG9wZXJhdG9yXCJ9LFxuICB7a2V5OlwiY29tcGFyaXNvblwiLCByZWc6L14oPD18Pj18PHw+fCE9fD09KS99LFxuICB7a2V5OlwiYXNzaWduXCIsIHJlZzovXihcXCs9fC09fD18Oj0pL30sXG4gIHtrZXk6XCJudW1iZXJcIiwgcmVnOi9eWzAtOV0rXFwuP1swLTldKi99LCAvLyBvbmx5IHBvc2l0aXZlIGZvciBub3dcbiAge2tleTpcImNvbW1hXCIsIHJlZzovXlxcLC99LFxuICB7a2V5OlwiZG90XCIsIHJlZzovXlxcLi99LFxuICB7a2V5OlwiY29sb25cIiwgcmVnOi9eXFw6LywgdmVyYm9zZTpcIjpcIn0sXG4gIHtrZXk6XCJvcGVuX3BhclwiLCByZWc6L15cXCgvLCB2ZXJib3NlOlwiKFwifSxcbiAge2tleTpcImNsb3NlX3BhclwiLCByZWc6L15cXCkvLCB2ZXJib3NlOlwiKVwifSxcbiAge2tleTpcIm9wZW5fYnJhXCIsIHJlZzovXlxcWy8sIHZlcmJvc2U6XCJbXCJ9LFxuICB7a2V5OlwiY2xvc2VfYnJhXCIsIHJlZzovXlxcXS8sIHZlcmJvc2U6XCJdXCJ9LFxuICB7a2V5Olwib3Blbl9jdXJseVwiLCByZWc6L15cXHsvLCB2ZXJib3NlOlwie1wifSxcbiAge2tleTpcImNsb3NlX2N1cmx5XCIsIHJlZzovXlxcfS8sIHZlcmJvc2U6XCJ9XCJ9LFxuICB7a2V5OlwibWF0aFwiLCByZWc6L15bLXxcXCt8XFwqfC98JV0vfSxcbiAge2tleTpcInNhbWVkZW50XCIsIGZ1bmM6ZGVudCgnc2FtZWRlbnQnKSwgdmVyYm9zZTpcInNhbWUgaW5kZW50YXRpb25cIn0sXG4gIHtrZXk6XCJkZWRlbnRcIiwgZnVuYzpkZW50KCdkZWRlbnQnKX0sXG4gIHtrZXk6XCJpbmRlbnRcIiwgZnVuYzpkZW50KCdpbmRlbnQnKX0sXG4gIC8vbmV3bGluZTogL14oXFxyP1xcbnwkKS8sXG4gIHtrZXk6XCJXXCIsIHJlZzovXlsgXS8sIHZlcmJvc2U6XCJzaW5nbGUgd2hpdGVzcGFjZVwifSxcbl07XG5cbmZ1bmN0aW9uIHN0YXJ0U3RyKGlucHV0LCBzdHJlYW0pIHtcbiAgdmFyIGxhc3QgPSBzdHJlYW1bc3RyZWFtLmxlbmd0aC0xXTtcbiAgaWYobGFzdCAmJiBsYXN0LnZhbHVlID09PSAnXFxcXCcpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYoaW5wdXQubWF0Y2goL14jey8pKSB7XG4gICAgcmV0dXJuICcjeyc7XG4gIH1cbn1cblxudmFyIHN0ckludGVycG9sYXRpb25Ub2tlbkRlZiA9IFtcbiAge2tleTpcInN0YXJ0XCIsIGZ1bmM6c3RhcnRTdHJ9LFxuICB7a2V5OlwiZW5kXCIsIHJlZzovXn0vfSxcbiAge2tleTpcIm5hbWVcIiwgcmVnOi9eW2EtekEtWl8kXVswLTlhLXpBLVpfXXswLDI5fS99LFxuICB7a2V5OlwiZG90XCIsIHJlZzovXlxcLi99LFxuICB7a2V5OlwiY2hhclwiLCByZWc6L14uL30sXG5dO1xuXG52YXIgc3RySW50ZXJwb2xhdGlvbkdyYW1tYXJEZWYgPSB7XG4gIFwiU1RBUlRcIjoge3J1bGVzOltcIkVMKiBFT0ZcIl19LFxuICBcIkVMXCI6IHtydWxlczpbXCJWQVJcIiwgXCJjaGFyXCIsIFwibmFtZVwiLCBcInN0YXJ0XCIsIFwiZW5kXCIsIFwiZG90XCJdfSxcbiAgXCJWQVJcIjoge3J1bGVzOltcInN0YXJ0IE5BTUUgZW5kXCJdfSxcbiAgXCJOQU1FXCI6IHtydWxlczpbXCJuYW1lIGRvdCBOQU1FXCIsIFwibmFtZVwiXX0sXG59O1xuXG52YXIgc3RyR3JhbSA9IGVwZWdqcy5jb21waWxlR3JhbW1hcihzdHJJbnRlcnBvbGF0aW9uR3JhbW1hckRlZiwgc3RySW50ZXJwb2xhdGlvblRva2VuRGVmKTtcblxuZnVuY3Rpb24gZ2VuZXJhdGVTdHJpbmdDb2RlKG5vZGUpIHtcbiAgaWYobm9kZS50eXBlID09PSAnVkFSJykge1xuICAgIHJldHVybiAnXCIgKyAnICsgZ2VuZXJhdGVTdHJpbmdDb2RlKG5vZGUuY2hpbGRyZW5bMV0pICsgJyArIFwiJztcbiAgfVxuICBpZihub2RlLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgfVxuICB2YXIgc3RyID0gXCJcIiwgaTtcbiAgaWYoIW5vZGUuY2hpbGRyZW4pIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgZm9yKGk9MDtpPG5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICBzdHIgKz0gZ2VuZXJhdGVTdHJpbmdDb2RlKG5vZGUuY2hpbGRyZW5baV0pO1xuICB9XG4gIHJldHVybiBzdHI7XG59XG5cbmZ1bmN0aW9uIGN1cnJlbnRMZXZlbCgpIHtcbiAgcmV0dXJuIGxldmVsU3RhY2tbbGV2ZWxTdGFjay5sZW5ndGggLSAxXTtcbn1cblxuZnVuY3Rpb24gaW5kZW50VHlwZShsKSB7XG4gIGlmKGwgPiBjdXJyZW50TGV2ZWwoKSkge1xuICAgIHJldHVybiAnaW5kZW50JztcbiAgfVxuICBpZihsIDwgY3VycmVudExldmVsKCkpIHtcbiAgICByZXR1cm4gJ2RlZGVudCc7XG4gIH1cbiAgaWYobCA9PT0gY3VycmVudExldmVsKCkpIHtcbiAgICByZXR1cm4gJ3NhbWVkZW50JztcbiAgfVxufVxuXG5mdW5jdGlvbiBkZW50KGRlbnRUeXBlKSB7XG4gIHJldHVybiBmdW5jdGlvbiBfZGVudChpbnB1dCkge1xuICAgIC8vIGVtcHR5IGxpbmUgaXMgYSBzYW1lZGVudFxuICAgIHZhciBtID0gaW5wdXQubWF0Y2goL15cXG5bXFxzXSovKTtcbiAgICBpZihtKSB7XG4gICAgICB2YXIgbGluZXMgPSBtWzBdLnNwbGl0KFwiXFxuXCIpO1xuICAgICAgdmFyIGluZGVudCA9IGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdLmxlbmd0aDtcbiAgICAgIGlmKGluZGVudFR5cGUoaW5kZW50KSA9PT0gZGVudFR5cGUpIHtcbiAgICAgICAgaWYoZGVudFR5cGUgPT0gJ2RlZGVudCcpIHtcbiAgICAgICAgICBsZXZlbFN0YWNrLnBvcCgpO1xuICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfVxuICAgICAgICBpZihkZW50VHlwZSA9PSAnaW5kZW50Jykge1xuICAgICAgICAgIGxldmVsU3RhY2sucHVzaChpbmRlbnQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtWzBdO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gc3RyaW5nRGVmKGlucHV0KSB7XG4gIGlmKGlucHV0LmNoYXJBdCgwKSA9PT0gJ1wiJykge1xuICAgIHZhciBpID0gMTtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpIHtcbiAgICAgIHZhciBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxcXCcpIHtcbiAgICAgICAgaSsrO1xuICAgICAgfSBlbHNlIGlmKGNoID09PSAnXCInKSB7XG4gICAgICAgIHJldHVybiBpbnB1dC5zbGljZSgwLCBpKzEpO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiByZWdFeHBEZWYoaW5wdXQpIHtcbiAgaWYoaW5wdXQuY2hhckF0KDApID09PSAnLycpIHtcbiAgICB2YXIgaSA9IDE7XG4gICAgd2hpbGUoaW5wdXQuY2hhckF0KGkpKSB7XG4gICAgICB2YXIgY2ggPSBpbnB1dC5jaGFyQXQoaSk7XG4gICAgICBpZihjaCA9PT0gJ1xcXFwnKSB7XG4gICAgICAgIGkrKztcbiAgICAgIH0gZWxzZSBpZihjaCA9PT0gJy8nKSB7XG4gICAgICAgIGkrKztcbiAgICAgICAgLy8gbW9kaWZpZXJzXG4gICAgICAgIHdoaWxlKFwiaWdtXCIuaW5kZXhPZihpbnB1dC5jaGFyQXQoaSkpICE9PSAtMSkge1xuICAgICAgICAgIGkrKztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGRlZkRlZihpbnB1dCkge1xuICBpZihpbnB1dC5pbmRleE9mKFwiZGVmKFwiKSA9PT0gMCkge1xuICAgIHJldHVybiBcImRlZlwiO1xuICB9XG4gIGlmKGlucHV0LmluZGV4T2YoXCJkZWYgXCIpID09PSAwKSB7XG4gICAgcmV0dXJuIFwiZGVmXCI7XG4gIH1cbiAgaWYoaW5wdXQuaW5kZXhPZihcImRlZlxcblwiKSA9PT0gMCkge1xuICAgIHJldHVybiBcImRlZlwiO1xuICB9XG4gIGlmKGlucHV0LmluZGV4T2YoXCJkb20gXCIpID09PSAwKSB7XG4gICAgcmV0dXJuIFwiZG9tXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tbWVudERlZihpbnB1dCkge1xuICB2YXIgbSA9IGlucHV0Lm1hdGNoKC9eIy8pO1xuICBpZihtKSB7XG4gICAgdmFyIGkgPSBtWzBdLmxlbmd0aDtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpIHtcbiAgICAgIHZhciBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxuJykge1xuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHJlZmxlY3QocGFyYW1zKSB7XG4gIHJldHVybiBwYXJhbXM7XG59XG5cbnZhciBncmFtbWFyRGVmID0ge1xuICBcIlNUQVJUXCI6IHtydWxlczpbXCJMSU5FKiBFT0ZcIl19LFxuICBcIkVMQ1wiOiB7cnVsZXM6W1wiVyogY29tbWVudFwiXSwgdmVyYm9zZTpcImNvbW1lbnRcIn0sXG4gIFwiTElORVwiOiB7cnVsZXM6W1wiU1RBVEVNRU5UIEVMQz8gc2FtZWRlbnQrXCIsIFwiU1RBVEVNRU5UIEVMQz8gIWRlZGVudFwiLCBcbiAgICBcIkVMQz8gc2FtZWRlbnRcIiwgXCJFTEMgIWRlZGVudFwiXSwgdmVyYm9zZTpcIm5ldyBsaW5lXCJ9LFxuICBcIkJMT0NLXCI6IHtydWxlczogW1wiaW5kZW50IExJTkUrIGRlZGVudFwiXX0sXG4gIFwiU1RBVEVNRU5UXCI6IHtydWxlczpbXCJBU1NJR05cIiwgXCJFWFBSXCIsIFwiSUZcIiwgXCJXSElMRVwiLCBcIkZPUlwiLCBcIlJFVFVSTlwiLCBcbiAgICBcIkNMQVNTXCIsIFwiVEFHXCIsIFwiRE9NX0FTU0lHTlwiLCBcIlRSWV9DQVRDSFwiLCBcIlRIUk9XXCJdfSxcbiAgXCJDTEFTU19NRVRIT0RTXCI6IHtcbiAgICAgIHJ1bGVzOiBbXCJzYW1lZGVudCogZjpGVU5DX0RFRiBzYW1lZGVudCpcIl0sXG4gICAgICBob29rczogWyBmdW5jdGlvbihwKXsgcmV0dXJuIHAuZjsgfV1cbiAgfSxcbiAgXCJDTEFTU1wiOiB7XG4gICAgcnVsZXM6IFtcbiAgICAgIFwiY2xhc3MgbjpuYW1lIG9wZW5fcGFyIHA6bmFtZSBjbG9zZV9wYXIgaW5kZW50IG06Q0xBU1NfTUVUSE9EUysgZGVkZW50XCIsXG4gICAgICBcImNsYXNzIG46bmFtZSBpbmRlbnQgbTpDTEFTU19NRVRIT0RTKyBkZWRlbnRcIlxuICAgIF0sXG4gICAgaG9va3M6IFtcbiAgICAgIGZ1bmN0aW9uKHApeyByZXR1cm4ge25hbWU6cC5uLCBtZXRob2RzOnAubSwgcGFyZW50OnAucH07IH0sXG4gICAgICBmdW5jdGlvbihwKXsgcmV0dXJuIHtuYW1lOnAubiwgbWV0aG9kczpwLm19OyB9XG4gICAgXVxuICB9LFxuICBcIkZVTkNfREVGX1BBUkFNU1wiOiB7cnVsZXM6W1xuICAgICAgXCJwMTpGVU5DX0RFRl9QQVJBTVMgY29tbWEgVyBwMjpGVU5DX0RFRl9QQVJBTVNcIixcbiAgICAgIFwicDE6bmFtZSBhc3NpZ24gZTpFWFBSXCIsXG4gICAgICBcInAxOm5hbWVcIixcbiAgICBdLFxuICAgIHZlcmJvc2U6XCJmdW5jdGlvbiBwYXJhbWV0ZXJzXCJcbiAgfSxcbiAgXCJMQU1CREFcIjoge3J1bGVzOltcbiAgICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIG9wZW5fcGFyIHBhcmFtczpGVU5DX0RFRl9QQVJBTVM/IGNsb3NlX3BhciBXIGJsb2NrOkVYUFJcIixcbiAgICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBvcGVuX3BhciBwYXJhbXM6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgVyBibG9jazpFWFBSXCIsXG4gICAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGJsb2NrOkVYUFJcIixcbiAgICBdLFxuICAgIGhvb2tzOiBbcmVmbGVjdCwgcmVmbGVjdCwgcmVmbGVjdF1cbiAgfSxcbiAgXCJGVU5DX0RFRlwiOiB7cnVsZXM6W1xuICAgICAgXCJmZDpmdW5jdGlvbl9kZWYgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIGJsb2NrOkJMT0NLXCIsXG4gICAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGZuOm5hbWUgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIGJsb2NrOkJMT0NLXCIsXG4gICAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGZuOm5hbWUgYmxvY2s6QkxPQ0tcIixcbiAgICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIGJsb2NrOkJMT0NLXCIsXG4gICAgXSxcbiAgICBob29rczogW3JlZmxlY3QsIHJlZmxlY3QsIHJlZmxlY3QsIHJlZmxlY3RdLFxuICAgIHZlcmJvc2U6XCJmdW5jdGlvbiBkZWZpbml0aW9uXCJcbiAgfSxcbiAgXCJFTFNFX0lGXCI6IHtydWxlczpbXCJzYW1lZGVudCBlbHNlaWYgZTpFWFBSIGI6QkxPQ0tcIl0sIGhvb2tzOltyZWZsZWN0XX0sXG4gIFwiRUxTRVwiOiB7cnVsZXM6W1wic2FtZWRlbnQgZWxzZSBiOkJMT0NLXCJdLCBob29rczpbcmVmbGVjdF19LFxuICBcIklGXCI6IHtydWxlczpbXCJpZiBlOkVYUFIgYjpCTE9DSyBlbGlmOkVMU0VfSUYqIGVsOkVMU0U/XCJdLCBob29rczpbcmVmbGVjdF19LFxuICBcIkVMU0VfRVhQUlwiOiB7cnVsZXM6W1wiVyBlbHNlIFcgYjpFWFBSXCJdLCBob29rczpbcmVmbGVjdF19LFxuICBcIklGX0VYUFJcIjoge3J1bGVzOltcImU6RVhQUiBXIGlmIHRlc3Q6RVhQUiBlbDpFTFNFX0VYUFI/XCJdLCBob29rczpbcmVmbGVjdF19LFxuICBcIldISUxFXCI6IHtydWxlczpbXCJ3aGlsZSBlOkVYUFIgYjpCTE9DS1wiXSwgaG9va3M6W3JlZmxlY3RdfSxcbiAgXCJNQVRIXCI6IHtydWxlczpbXCJlMTpFWFBSIFcgb3A6bWF0aCBXIGUyOkVYUFJcIl19LFxuICBcIlBBVEhcIjoge3J1bGVzOltcIlBBVEggZG90IG5hbWVcIiwgXCJQQVRIIG9wZW5fYnJhIG51bWJlciBjbG9zZV9icmFcIiwgXCJuYW1lXCJdfSxcbiAgXCJBU1NJR05cIjoge3J1bGVzOltcbiAgICBcImxlZnQ6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSIFcgb3A6YXNzaWduIFcgcmlnaHQ6RVhQUlwiLFxuICAgIFwibGVmdDpFWFBSIFcgb3A6YXNzaWduIFcgcmlnaHQ6RVhQUlwiXG4gIF0sIGhvb2tzOltyZWZsZWN0LCByZWZsZWN0XX0sXG4gIFwiV19PUl9TQU1FREVOVFwiOiB7cnVsZXM6W1wiV1wiLCBcInNhbWVkZW50XCJdLCB2ZXJib3NlOiBcInNhbWVkZW50IG9yIHdoaXRlc3BhY2VcIn0sXG4gIFwiV19TQU1FREVOVF9JTkRFTlRcIjoge3J1bGVzOltcIldcIiwgXCJzYW1lZGVudFwiLCBcImluZGVudFwiXSwgdmVyYm9zZTogXCJpbmRlbnQgb3Igc2FtZWRlbnQgb3Igd2hpdGVzcGFjZVwifSxcbiAgXCJBTllfU1BBQ0VcIjoge3J1bGVzOltcIldcIiwgXCJzYW1lZGVudFwiLCBcImluZGVudFwiLCBcImRlZGVudFwiXSwgdmVyYm9zZTogXCJhbnkgc3BhY2VcIn0sXG4gIC8vIFRPRE86IHdoeSBBTllfU1BBQ0UqIGhlcmU/XG4gIFwiRlVOQ19DQUxMX1BBUkFNU1wiOiB7cnVsZXM6W1wiRVhQUiBjb21tYSBBTllfU1BBQ0UrIEZVTkNfQ0FMTF9QQVJBTVMgQU5ZX1NQQUNFKlwiLCBcIkVYUFIgQU5ZX1NQQUNFKlwiXX0sXG4gIFwiRlVOQ19DQUxMXCI6IHtydWxlczpbXG4gICAgXCJvcGVuX3BhciBGVU5DX0NBTExfUEFSQU1TPyBjbG9zZV9wYXJcIixcbiAgICAvL1wib3Blbl9wYXIgaW5kZW50IEZVTkNfQ0FMTF9QQVJBTVM/IGRlZGVudCBzYW1lZGVudCBjbG9zZV9wYXJcIixcbiAgICAvL1wib3Blbl9wYXIgaW5kZW50IEZVTkNfQ0FMTF9QQVJBTVM/IGNsb3NlX3BhciBkZWRlbnRcIlxuICBdfSxcblxuICBcIlRZUEVcIjoge3J1bGVzOltcIm5hbWUgY29sb25cIl19LFxuXG4gIFwiRk9SXCI6IHtydWxlczpbXG4gICAgXCJmb3JfbG9vcCBrOm5hbWUgY29tbWEgVyB2Om5hbWUgVyBpbiB0OlRZUEU/IGE6bmFtZSBiOkJMT0NLXCIsXG4gICAgXCJmb3JfbG9vcCB2Om5hbWUgVyBpbiB0OlRZUEU/IGE6bmFtZSBiOkJMT0NLXCJdLFxuICAgIGhvb2tzOiBbcmVmbGVjdCwgcmVmbGVjdF1cbiAgfSxcblxuICBcIlNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUlwiOiB7cnVsZXM6W1xuICAgIFwiZTE6RVhQUiBjb21tYSBXIGUyOlNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUlwiLFxuICAgIFwiZTE6RVhQUiBjb21tYSBXIGUyOkVYUFJcIlxuICBdLFxuICBob29rczogW2Z1bmN0aW9uKHApIHtcbiAgICAvLyB1bnJvbGwgcmVjdXNyaW9uXG4gICAgcmV0dXJuIFtwLmUxXS5jb25jYXQocC5lMi5jaGlsZHJlbik7XG4gIH0sXG4gIGZ1bmN0aW9uKHApIHtcbiAgICByZXR1cm4gW3AuZTEsIHAuZTJdO1xuICB9XSBcbiAgfSxcblxuICBcIkNPTU1BX1NFUEFSQVRFRF9FWFBSXCI6IHtydWxlczpbXG4gICAgXCJFWFBSIGNvbW1hIEFOWV9TUEFDRSsgQ09NTUFfU0VQQVJBVEVEX0VYUFIgQU5ZX1NQQUNFKlwiLFxuICAgIFwiRVhQUiBBTllfU1BBQ0UqXCJcbiAgXX0sXG5cbiAgXCJBUlJBWVwiOiB7cnVsZXM6W1xuICAgIFwib3Blbl9icmEgQU5ZX1NQQUNFKiBjOkNPTU1BX1NFUEFSQVRFRF9FWFBSPyBBTllfU1BBQ0UqIGNsb3NlX2JyYVwiLFxuICAgIC8vXCJvcGVuX2JyYSBpbmRlbnQgYzpDT01NQV9TRVBBUkFURURfRVhQUj8gZGVkZW50IHNhbWVkZW50IGNsb3NlX2JyYVwiLFxuICAgIC8vXCJvcGVuX2JyYSBpbmRlbnQgYzpDT01NQV9TRVBBUkFURURfRVhQUj8gY2xvc2VfYnJhIGRlZGVudFwiLFxuICBdfSxcblxuICBcIk1FTUJFUlNcIjoge3J1bGVzOltcbiAgICBcIm5hbWUgY29sb24gVyBFWFBSIHNhbWVkZW50PyBjb21tYSBBTllfU1BBQ0UrIE1FTUJFUlMgQU5ZX1NQQUNFKlwiLFxuICAgIFwibmFtZSBjb2xvbiBXIEVYUFIgQU5ZX1NQQUNFKlwiXG4gIF19LFxuXG4gIFwiT0JKRUNUXCI6IHtydWxlczpbXG4gICAgXCJvcGVuX2N1cmx5IGluZGVudD8gTUVNQkVSUz8gY2xvc2VfY3VybHlcIixcbiAgXX0sXG5cbiAgXCJUQUdfUEFSQU1TXCI6IHtydWxlczpbXG4gICAgICBcImxlZnQ6VEFHX1BBUkFNUyBXIHJpZ2h0OlRBR19QQVJBTVNcIixcbiAgICAgIFwibjpuYW1lIGFzc2lnbiBlOkVYUFJcIixcbiAgICAgIFwibjpuYW1lXCIsXG4gICAgXSxcbiAgICBob29rczpbcmVmbGVjdCwgcmVmbGVjdCwgcmVmbGVjdF0sXG4gICAgdmVyYm9zZTpcInRhZyBwYXJhbWV0ZXJzXCJcbiAgfSxcblxuICBcIlRBR1wiOiB7cnVsZXM6W1xuICAgIFwidGFnOnRhZyBXPyBwYXJhbXM6VEFHX1BBUkFNUz8gZW5kOj4/IGJsb2NrOkJMT0NLP1wiLFxuICBdLFxuICBob29rczpbcmVmbGVjdF1cbiAgfSxcblxuICBcIkRPTV9BU1NJR05cIjoge3J1bGVzOltcbiAgICBcImFzc2lnbiBFWFBSXCIsXG4gIF19LFxuXG4gIFwiVFJZX0NBVENIXCI6IHtcbiAgICBydWxlczpbXG4gICAgICBcInRyeSBiMTpCTE9DSyBzYW1lZGVudD8gY2F0Y2ggb3Blbl9wYXIgZXJyOm5hbWU/IGNsb3NlX3BhciBiMjpCTE9DS1wiLFxuICAgIF0sXG4gICAgaG9va3M6W3JlZmxlY3RdLFxuICB9LFxuXG4gIFwiVEhST1dcIjoge3J1bGVzOltcbiAgICBcInRocm93IEVYUFJcIixcbiAgXX0sXG5cbiAgXCJSRVRVUk5cIjoge3J1bGVzOltcInJldCBXIFNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUlwiLCBcInJldCBXIEVYUFJcIiwgXCJyZXRcIl19LFxuICBcIlJJR0hUX0VYUFJcIjoge3J1bGVzOiBbXG4gICAgXCJtYXRoX29wZXJhdG9yc1wiLFxuICAgIFwiVyBiaW5hcnlfb3BlcmF0b3JzIFcgRVhQUlwiLFxuICAgIFwiVyBjb21wYXJpc29uIFcgRVhQUlwiLFxuICAgIFwiVyA+IFcgRVhQUlwiLFxuICAgIFwiZG90IEVYUFJcIixcbiAgICBcIm9wZW5fYnJhIEVYUFIgY2xvc2VfYnJhXCIsXG4gICAgXCJGVU5DX0NBTExcIlxuICAgIF0sXG4gICAgdmVyYm9zZTpcImV4cHJlc3Npb25cIlxuICB9LFxuXG4gIFwiRVhQUlwiOiB7cnVsZXM6IFtcbiAgICBcIklGX0VYUFJcIixcbiAgICBcIk1BVEhcIixcbiAgICBcIk9CSkVDVFwiLFxuICAgIFwiRlVOQ19ERUZcIixcbiAgICBcIkVYUFIgUklHSFRfRVhQUlwiLFxuICAgIC8vXCJGVU5DX0NBTExcIixcbiAgICBcIkxBTUJEQVwiLFxuICAgIFwibnVtYmVyXCIsXG4gICAgXCJyZWdleHBcIixcbiAgICBcIm9wZW5fcGFyIEVYUFIgY2xvc2VfcGFyXCIsXG4gICAgXCJuZXcgRVhQUlwiLFxuICAgIFwic3RyaW5nXCIsXG4gICAgXCJuYW1lXCIsXG4gICAgXCJQQVRIXCIsXG4gICAgXCJBUlJBWVwiXSxcbiAgICB2ZXJib3NlOlwiZXhwcmVzc2lvblwiXG4gIH0sXG59O1xuXG5mdW5jdGlvbiBzcGFjZXIobikge1xuICB2YXIgb3V0ID0gXCJcIjtcbiAgZm9yKHZhciBpPTA7IGk8bjsgaSsrKSB7XG4gICAgb3V0ICs9IFwiIFwiO1xuICB9XG4gIHJldHVybiBvdXQ7XG59XG5cbmZ1bmN0aW9uIHNwKG1vZCkge1xuICBpZihtb2QpIHtcbiAgICByZXR1cm4gc3BhY2VyKDIgKiAoZGVwdGgrbW9kKSk7XG4gIH1cbiAgcmV0dXJuIHNwYWNlcigyICogZGVwdGgpO1xufVxuXG52YXIgbmMgPSAxO1xuLy8gY2hpbGRyZW4gbmFtZVxuZnVuY3Rpb24gQ04oKSB7XG4gIHJldHVybiAnX19jJyArIG5jO1xufVxuZnVuY3Rpb24gcHVzaENOKCkge1xuICBuYysrO1xuICByZXR1cm4gJ19fYycgKyBuYztcbn1cbmZ1bmN0aW9uIHBvcENOKCkge1xuICBuYy0tO1xuICByZXR1cm4gJ19fYycgKyBuYztcbn1cblxudmFyIGJhY2tlbmQgPSB7XG5cbiAgJ2RlZGVudCc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBkZXB0aCA9IE1hdGgubWF4KDAsIGRlcHRoIC0gMSk7XG4gICAgcmV0dXJuICcnO1xuICB9LFxuICAnaW5kZW50JzogZnVuY3Rpb24obm9kZSkge1xuICAgIGRlcHRoID0gZGVwdGggKyAxO1xuICAgIHJldHVybiAnXFxuJytzcCgpO1xuICB9LFxuICAnc2FtZWRlbnQnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgcmV0dXJuICdcXG4nK3NwKCk7XG4gIH0sXG4gICdET01fQVNTSUdOJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBuYW1lID0gQ04oKTtcbiAgICByZXR1cm4gbmFtZSsnLnB1c2goU3RyaW5nKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblsxXSkgKyAnKSknO1xuICB9LFxuICAnVEFHX1BBUkFNUyc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBpZihub2RlLmNoaWxkcmVuLmxlZnQpIHtcbiAgICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5sZWZ0KSArICcsICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5yaWdodCk7XG4gICAgfVxuICAgIGlmKG5vZGUuY2hpbGRyZW4uZSkge1xuICAgICAgcmV0dXJuIG5vZGUuY2hpbGRyZW4ubi52YWx1ZSArICc6JyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbm9kZS5jaGlsZHJlbi5uLnZhbHVlICsgJzogdHJ1ZSc7XG4gICAgfVxuICB9LFxuICAnVEFHJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBzdHIgPSAnJywgaSwgcGFyYW1zID0gXCJ7XCI7XG4gICAgdmFyIG5hbWUgPSBub2RlLmNoaWxkcmVuLnRhZy52YWx1ZS5zdWJzdHJpbmcoMSk7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5wYXJhbXMpIHtcbiAgICAgIHBhcmFtcyArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMpO1xuICAgIH1cbiAgICBwYXJhbXMgKz0gJ30nO1xuICAgIHZhciBzdWIgPSAnW10nO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uYmxvY2spIHtcbiAgICAgIHN1YiA9IHB1c2hDTigpO1xuICAgICAgc3RyICs9ICd2YXIgJyArIENOKCkgKyAnID0gW107JztcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5ibG9jayk7XG4gICAgICBwb3BDTigpO1xuICAgIH1cbiAgICBzdHIgKz0gJ1xcbicgKyBzcCgxKSArIENOKCkgKyAnLnB1c2goaChcIicrbmFtZSsnXCIsICcrcGFyYW1zKycsICcrc3ViKycpKSc7XG4gICAgcmV0dXJuIHN0cjtcbiAgfSxcbiAgJ0NMQVNTJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBuYW1lID0gbm9kZS5jaGlsZHJlbi5uYW1lLnZhbHVlLCBpO1xuICAgIHZhciBmdW5jcyA9IG5vZGUuY2hpbGRyZW4ubWV0aG9kcztcbiAgICB2YXIgcGFyZW50ID0gbm9kZS5jaGlsZHJlbi5wYXJlbnQ7XG4gICAgdmFyIHN0ciA9ICcnO1xuICAgIHZhciBjb25zdHJ1Y3RvciA9IG51bGw7XG4gICAgZm9yKGk9MDtpPGZ1bmNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgZnVuY19kZWYgPSBmdW5jc1tpXS5jaGlsZHJlbjtcbiAgICAgIHZhciBmdW5jX25hbWUgPSBmdW5jX2RlZi5jaGlsZHJlbi5mbi52YWx1ZTtcbiAgICAgIGlmKGZ1bmNfbmFtZSA9PT0gJ2NvbnN0cnVjdG9yJykge1xuICAgICAgICBjb25zdHJ1Y3RvciA9IGZ1bmNfZGVmO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyICs9ICdcXG4nICsgc3AoKSArIG5hbWUgKyAnLnByb3RvdHlwZS4nICsgZnVuY19uYW1lICsgJyA9ICcgKyBnZW5lcmF0ZUNvZGUoZnVuY19kZWYpO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgbnMgPSBjdXJyZW50TnMoKTtcbiAgICBuc1tuYW1lXSA9IHRydWU7XG4gICAgbnMgPSBuZXdOcygpO1xuXG4gICAgdmFyIHBhcmFtcyA9IGNvbnN0cnVjdG9yICYmIGNvbnN0cnVjdG9yLmNoaWxkcmVuLnBhcmFtcztcbiAgICBpZihwYXJhbXMpIHtcbiAgICAgIHBhcmFtcyA9IGdlbmVyYXRlQ29kZShwYXJhbXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJhbXMgPSAnJztcbiAgICB9XG4gICAgdmFyIGJvZHkgPSBjb25zdHJ1Y3RvciAmJiBjb25zdHJ1Y3Rvci5jaGlsZHJlbi5ibG9jaztcbiAgICB2YXIgY29uc19zdHIgPSAndmFyICcgKyBuYW1lICsgJyA9IGZ1bmN0aW9uICcgKyBuYW1lICsgJygnKyBwYXJhbXMgKyAnKSB7JztcbiAgICBjb25zX3N0ciArPSAnXFxuJytzcCgxKSsnaWYoISh0aGlzIGluc3RhbmNlb2YgJytuYW1lKycpKXsgcmV0dXJuIG5ldyAnK25hbWUrJygnK09iamVjdC5rZXlzKG5zKS5qb2luKCcsJykrJyk7fSc7XG4gICAgZm9yKHZhciBrZXkgaW4gbnMpIHtcbiAgICAgIGlmKG5zW2tleV0gIT09IHRydWUgJiYgbnNba2V5XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnNfc3RyICs9ICdcXG4nK3NwKDEpKydpZignK2tleSsnID09PSB1bmRlZmluZWQpIHsnK2tleSsnID0gJytnZW5lcmF0ZUNvZGUobnNba2V5XSkrJ307JztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYoYm9keSkge1xuICAgICAgY29uc19zdHIgKz0gZ2VuZXJhdGVDb2RlKGJvZHkpO1xuICAgIH1cbiAgICBjb25zX3N0ciArPSBzcCgpICsgJ1xcbn0nO1xuXG4gICAgaWYocGFyZW50KSB7XG4gICAgICBjb25zX3N0ciArPSAnXFxuJytzcCgpICsgbmFtZSArICcucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZSgnICsgcGFyZW50LnZhbHVlICsgJy5wcm90b3R5cGUpOyc7XG4gICAgICBjb25zX3N0ciArPSAnXFxuJytzcCgpICsgbmFtZSArICcucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gJytuYW1lKycnO1xuICAgICAgLy9jb25zX3N0ciArPSAnXFxuJytzcCgpICsgbmFtZSArICcucHJvdG90eXBlLnN1cGVyID0gZnVuY3Rpb24oKXsnICsgcGFyZW50LnZhbHVlICsgJy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO30nO1xuICAgIH1cblxuICAgIG5hbWVzcGFjZXMucG9wKCk7XG4gICAgcmV0dXJuIGNvbnNfc3RyICsgc3RyO1xuICB9LFxuICAnTEFNQkRBJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBuYW1lID0gXCJcIjtcbiAgICB2YXIgbnMgPSBuZXdOcygpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uZm4pIHtcbiAgICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuLmZuLnZhbHVlO1xuICAgICAgbnNbbmFtZV0gPSB0cnVlO1xuICAgIH1cbiAgICB2YXIgc3RyID0gXCJmdW5jdGlvbiBcIiArIG5hbWUgKyBcIihcIjtcbiAgICBpZihub2RlLmNoaWxkcmVuLnBhcmFtcykge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnBhcmFtcywgbnMpO1xuICAgIH1cbiAgICBzdHIgKz0gJykgeyc7XG4gICAgZm9yKHZhciBrZXkgaW4gbnMpIHtcbiAgICAgIGlmKG5zW2tleV0gIT09IHRydWUgJiYgbnNba2V5XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHN0ciArPSAnXFxuJytzcCgxKSsnaWYoJytrZXkrJyA9PT0gdW5kZWZpbmVkKSB7JytrZXkrJyA9ICcrZ2VuZXJhdGVDb2RlKG5zW2tleV0pKyd9Oyc7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKG5vZGUuY2hpbGRyZW4uYmxvY2spIHtcbiAgICAgIHN0ciArPSAnIHJldHVybiAnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYmxvY2ssIG5zKTtcbiAgICB9XG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICByZXR1cm4gc3RyICsgXCI7IH1cIjtcbiAgfSxcbiAgJ0ZVTkNfREVGJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBuYW1lID0gXCJcIjtcbiAgICB2YXIgbnMgPSBjdXJyZW50TnMoKTtcbiAgICB2YXIgaXNfZG9tID0gbm9kZS5jaGlsZHJlbi5mZC52YWx1ZSA9PT0gJ2RvbSc7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5mbikge1xuICAgICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICBuc1tuYW1lXSA9IHRydWU7XG4gICAgfVxuICAgIG5zID0gbmV3TnMoKTtcbiAgICB2YXIgc3RyID0gXCJmdW5jdGlvbiBcIiArIG5hbWUgKyBcIihcIjtcbiAgICBpZihub2RlLmNoaWxkcmVuLnBhcmFtcykge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnBhcmFtcyk7XG4gICAgfVxuICAgIHN0ciArPSAnKSB7JztcbiAgICBmb3IodmFyIGtleSBpbiBucykge1xuICAgICAgaWYobnNba2V5XSAhPT0gdHJ1ZSAmJiBuc1trZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc3RyICs9ICdcXG4nK3NwKDEpKydpZignK2tleSsnID09PSB1bmRlZmluZWQpIHsnK2tleSsnID0gJytnZW5lcmF0ZUNvZGUobnNba2V5XSkrJzt9JztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYoaXNfZG9tKSB7XG4gICAgICBzdHIgKz0gJ1xcbicrc3AoMSkgKyAndmFyICcgKyBDTigpICsgJyA9IFtdOyc7XG4gICAgfVxuXG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrKTtcbiAgICB9XG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcblxuICAgIGlmKGlzX2RvbSkge1xuICAgICAgc3RyICs9ICdcXG4nK3NwKDEpICsgJ3JldHVybiAnICsgQ04oKSArICc7JztcbiAgICB9XG4gICAgcmV0dXJuIHN0ciArICdcXG4nK3NwKCkrJ30nO1xuICB9LFxuICAnRlVOQ19ERUZfUEFSQU1TJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBzdHIgPSBcIlwiLCBpO1xuICAgIHZhciBucyA9IGN1cnJlbnROcygpO1xuICAgIGlmKG5vZGUuY2hpbGRyZW5bMF0udHlwZSA9PT0gJ25hbWUnKSB7XG4gICAgICBuc1tub2RlLmNoaWxkcmVuWzBdLnZhbHVlXSA9IHRydWU7XG4gICAgICBpZihub2RlLmNoaWxkcmVuWzFdICYmIG5vZGUuY2hpbGRyZW5bMV0udHlwZSA9PT0gJ2Fzc2lnbicpIHtcbiAgICAgICAgbnNbbm9kZS5jaGlsZHJlblswXS52YWx1ZV0gPSBub2RlLmNoaWxkcmVuWzJdO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IoaT0wO2k8bm9kZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIG4gPSBub2RlLmNoaWxkcmVuW2ldO1xuICAgICAgaWYobi50eXBlID09PSAnbmFtZScgfHwgbi50eXBlID09PSAnRlVOQ19ERUZfUEFSQU1TJyB8fCBuLnR5cGUgPT09ICdjb21tYScgfHwgbi50eXBlID09PSAnd2luZG93Jykge1xuICAgICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5baV0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc3RyO1xuICB9LFxuICAnQVNTSUdOJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBwcmVmaXggPSBcIlwiLCBzdHIgPSBcIlwiLCBpO1xuICAgIHZhciBvcCA9IG5vZGUuY2hpbGRyZW4ub3AudmFsdWU7XG4gICAgdmFyIGV4cGxpY2l0X2dsb2JhbCA9IG9wID09PSAnOj0nO1xuICAgIGlmKG9wID09ICc6PScpIHtcbiAgICAgIG9wID0gJz0nO1xuICAgIH1cbiAgICB2YXIgbnMgPSBjdXJyZW50TnMoKTtcbiAgICB2YXIgbGVmdCA9IG5vZGUuY2hpbGRyZW4ubGVmdDtcbiAgICB2YXIgcmlnaHRfY29kZSA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnJpZ2h0KTtcbiAgICBpZihsZWZ0LnR5cGUgPT09ICdTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFInKSB7XG4gICAgICB1bnBhY2tpbmcrKztcbiAgICAgIHZhciB1bnBhY2tfbmFtZSA9ICdfX3VucGFjaycgKyB1bnBhY2tpbmc7XG4gICAgICBzdHIgKz0gJ3ZhciAnICsgdW5wYWNrX25hbWUgKyAnID0gJyArIHJpZ2h0X2NvZGUgKyAnO1xcbicrc3AoKTtcbiAgICAgIGZvcihpPTA7aTxsZWZ0LmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBuID0gbGVmdC5jaGlsZHJlbltpXS5jaGlsZHJlblswXTtcbiAgICAgICAgcHJlZml4ID0gXCJcIjtcbiAgICAgICAgaWYobi50eXBlID09PSAnbmFtZScpIHtcbiAgICAgICAgICBpZihuc1tuLnZhbHVlXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBuc1tuLnZhbHVlXSA9IHRydWU7XG4gICAgICAgICAgICBpZighZXhwbGljaXRfZ2xvYmFsKSB7XG4gICAgICAgICAgICAgIHByZWZpeCA9ICd2YXIgJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgc3RyICs9IHByZWZpeCArIGdlbmVyYXRlQ29kZShuKSArICcgJyArIG9wICsgJyAnICsgdW5wYWNrX25hbWUgKydbJytpKyddO1xcbicrc3AoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICAgIGlmKGxlZnQuY2hpbGRyZW5bMF0udHlwZSA9PT0gJ25hbWUnKSB7XG4gICAgICB2YXIgY2ggPSBsZWZ0LmNoaWxkcmVuWzBdO1xuICAgICAgaWYobnNbY2gudmFsdWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYoIWV4cGxpY2l0X2dsb2JhbCkge1xuICAgICAgICAgIHByZWZpeCA9ICd2YXIgJztcbiAgICAgICAgfVxuICAgICAgICBuc1tjaC52YWx1ZV0gPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcHJlZml4ICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ubGVmdCkgKyAnICcgKyBvcCArICcgJyArIHJpZ2h0X2NvZGU7XG4gIH0sXG4gICdTVEFURU1FTlQnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIGUgPSBub2RlLmNoaWxkcmVuWzBdLmNoaWxkcmVuWzBdO1xuICAgIGlmKG5vZGUuY2hpbGRyZW5bMF0udHlwZSA9PT0gJ0ZPUicgfHwgXG4gICAgICAgbm9kZS5jaGlsZHJlblswXS50eXBlID09PSAnVFJZX0NBVENIJyB8fCBcbiAgICAgICBub2RlLmNoaWxkcmVuWzBdLnR5cGUgPT09ICdXSElMRScgfHwgXG4gICAgICAgZSAmJiAoZS50eXBlID09PSAnRlVOQ19ERUYnIHx8IGUudHlwZSA9PT0gJ0xBTUJEQScpKSB7XG4gICAgICByZXR1cm4gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bMF0pO1xuICAgIH1cbiAgICByZXR1cm4gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5bMF0pICsgJzsnO1xuICB9LFxuICAnSUYnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHN0ciA9ICcnO1xuICAgIHN0ciA9ICdpZignK2dlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJyl7JyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicrc3AoKSsnfSc7XG4gICAgdmFyIGVsaWYgPSBub2RlLmNoaWxkcmVuLmVsaWY7XG4gICAgaWYoZWxpZikge1xuICAgICAgaWYoQXJyYXkuaXNBcnJheShlbGlmKSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVsaWYubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKGVsaWZbaV0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKGVsaWYpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZihub2RlLmNoaWxkcmVuLmVsKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZWwpO1xuICAgIH1cbiAgICByZXR1cm4gc3RyO1xuICB9LFxuICAnSUZfRVhQUic6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgc3RyID0gJyc7XG4gICAgc3RyID0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4udGVzdCkgKyAnID8gJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJyA6ICc7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5lbCkge1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmVsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyICs9ICd1bmRlZmluZWQnO1xuICAgIH1cbiAgICByZXR1cm4gc3RyO1xuICB9LFxuICAnRUxTRV9FWFBSJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKTtcbiAgfSxcbiAgJ1dISUxFJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHJldHVybiAnd2hpbGUoJytnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcpeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nK3NwKCkrJ30nO1xuICB9LFxuICAnRk9SJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBrZXlJbmRleE5hbWUgPSBcIl9pbmRleFwiICsgZm9yTG9vcENvdW50O1xuICAgIHZhciBrZXlBcnJheU5hbWUgPSBcIl9rZXlzXCIgKyBmb3JMb29wQ291bnQ7XG4gICAgZm9yTG9vcENvdW50Kys7XG4gICAgdmFyIGluZGV4TmFtZSA9IGZhbHNlO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4uaykge1xuICAgICAgaW5kZXhOYW1lID0gbm9kZS5jaGlsZHJlbi5rLnZhbHVlO1xuICAgIH1cbiAgICB2YXIgc3RyID0gJ3ZhciAnK2tleUFycmF5TmFtZSsnID0gT2JqZWN0LmtleXMoJytub2RlLmNoaWxkcmVuLmEudmFsdWUrJyk7XFxuJztcbiAgICBzdHIgKz0gc3AoKSArICdmb3IodmFyICcra2V5SW5kZXhOYW1lKycgPSAwOyAnK2tleUluZGV4TmFtZSsnIDwgJytrZXlBcnJheU5hbWUrJy5sZW5ndGg7ICcra2V5SW5kZXhOYW1lKycrKyApIHtcXG4nO1xuICAgIGlmKGluZGV4TmFtZSkge1xuICAgICAgc3RyICs9IHNwKDEpICsgJ3ZhciAnICsgaW5kZXhOYW1lICsgJyA9ICcgKyBrZXlBcnJheU5hbWUgKydbJyArIGtleUluZGV4TmFtZSArICddO1xcbic7XG4gICAgfVxuICAgIHN0ciArPSBzcCgxKSArICd2YXIgJyArIG5vZGUuY2hpbGRyZW4udi52YWx1ZSArICcgPSAnICsgbm9kZS5jaGlsZHJlbi5hLnZhbHVlICsgJ1snICsga2V5QXJyYXlOYW1lICsnWycgKyBrZXlJbmRleE5hbWUgKyAnXV07JztcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYikgKydcXG4nK3NwKCkrJ30nO1xuICAgIHJldHVybiBzdHI7XG4gIH0sXG4gICdFTFNFX0lGJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHJldHVybiAnIGVsc2UgaWYoJytnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSsnKSB7JytnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSsgJ1xcbicrc3AoKSsnfSc7XG4gIH0sXG4gICdFTFNFJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHJldHVybiAnIGVsc2UgeycrZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYikrICdcXG4nK3NwKCkrJ30nO1xuICB9LFxuICAnVFJZX0NBVENIJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBzdHIgPSBcInRyeSB7XCI7XG4gICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIxKTtcbiAgICBzdHIgKz0gJ1xcbicrc3AoKStcIn0gY2F0Y2goXCIrZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZXJyKStcIikge1wiO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iMik7XG4gICAgcmV0dXJuIHN0cisnXFxuJytzcCgpK1wifVwiO1xuICB9LFxuICAnUkVUVVJOJzogZnVuY3Rpb24obm9kZSkge1xuICAgIGlmKCFub2RlLmNoaWxkcmVuWzJdKSB7XG4gICAgICByZXR1cm4gJ3JldHVybic7XG4gICAgfVxuICAgIGlmKG5vZGUuY2hpbGRyZW5bMl0udHlwZSA9PSBcIlNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUlwiKSB7XG4gICAgICByZXR1cm4gJ3JldHVybiBbJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzJdKSArICddJztcbiAgICB9XG4gICAgcmV0dXJuICdyZXR1cm4gJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzJdKTtcbiAgfSxcbiAgJ1NUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUic6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgZWxlbWVudHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGVsZW1lbnRzLnB1c2goZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5baV0pKTtcbiAgICB9XG4gICAgcmV0dXJuIGVsZW1lbnRzLmpvaW4oXCIsIFwiKTtcbiAgfSxcbiAgJ3N0cmluZyc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgdiA9IG5vZGUudmFsdWU7XG4gICAgdiA9IHYucmVwbGFjZSgvXFxuL2csIFwiXFxcXG5cIik7XG4gICAgdmFyIGFzdCA9IHN0ckdyYW0ucGFyc2Uodik7XG4gICAgaWYoIWFzdC5jb21wbGV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGFzdC5oaW50KTtcbiAgICB9XG4gICAgcmV0dXJuIGdlbmVyYXRlU3RyaW5nQ29kZShhc3QpO1xuICB9LFxuICAnY29tbWVudCc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZS5yZXBsYWNlKC9eIy9nLCBcIi8vXCIpO1xuICB9LFxuICAnY29tcGFyaXNvbic6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBpZihub2RlLnZhbHVlID09ICc9PScpIHtcbiAgICAgIHJldHVybiAnPT09JztcbiAgICB9XG4gICAgaWYobm9kZS52YWx1ZSA9PSAnIT0nKSB7XG4gICAgICByZXR1cm4gJyE9PSc7XG4gICAgfVxuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9XG59O1xuXG5mdW5jdGlvbiBnZW5lcmF0ZUNvZGUobm9kZSkge1xuICBpZighbm9kZSkge1xuICAgIC8vZGVidWdnZXJcbiAgfVxuICBpZihiYWNrZW5kW25vZGUudHlwZV0pIHtcbiAgICByZXR1cm4gYmFja2VuZFtub2RlLnR5cGVdKG5vZGUpO1xuICB9XG4gIGlmKG5vZGUudmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9XG4gIHZhciBzdHIgPSBcIlwiLCBpO1xuICBpZighbm9kZS5jaGlsZHJlbikge1xuICAgIHJldHVybiAnJztcbiAgfVxuICBmb3IoaT0wO2k8bm9kZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbltpXSk7XG4gIH1cbiAgcmV0dXJuIHN0cjtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVFeHBvcnRzKGtleXMpIHtcbiAgdmFyIHN0ciA9ICdcXG5tb2R1bGUuZXhwb3J0cyA9IHsnO1xuICBrZXlzID0ga2V5cyB8fCBPYmplY3Qua2V5cyhjdXJyZW50TnMoKSk7XG4gIGZvcih2YXIgaT0wOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgIHN0ciArPSAnXFxuICAnICsga2V5c1tpXSArICc6ICcgKyBrZXlzW2ldICsgJywnO1xuICB9XG4gIHJldHVybiBzdHIgKyAnXFxufSc7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlTW9kdWxlKGlucHV0LCBvcHRzKSB7XG4gIHJlc2V0R2xvYmFsKCk7XG4gIHZhciBhc3QgPSBncmFtLnBhcnNlKGlucHV0ICsgXCJcXG5cIik7XG4gIGlmKCFhc3QuY29tcGxldGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYXN0LmhpbnQpO1xuICB9XG4gIHZhciBvYmogPSB7YXN0OmFzdCwgY29kZTpnZW5lcmF0ZUNvZGUoYXN0KSwgbnM6Y3VycmVudE5zKCl9O1xuICByZXR1cm4gb2JqO1xufVxuXG52YXIgZ3JhbSA9IGVwZWdqcy5jb21waWxlR3JhbW1hcihncmFtbWFyRGVmLCB0b2tlbkRlZik7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBncmFtbWFyOiBncmFtLFxuICBzdHJHcmFtbWFyOiBzdHJHcmFtLFxuICBncmFtbWFyRGVmOiBncmFtbWFyRGVmLFxuICBlcGVnanM6ZXBlZ2pzLFxuICB0b2tlbkRlZjogdG9rZW5EZWYsXG4gIGdlbmVyYXRlTW9kdWxlOiBnZW5lcmF0ZU1vZHVsZSxcbiAgZ2VuZXJhdGVDb2RlOiBnZW5lcmF0ZUNvZGUsXG4gIGdlbmVyYXRlRXhwb3J0czogZ2VuZXJhdGVFeHBvcnRzXG59O1xuXG4iXX0=
