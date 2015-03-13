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
    "left:STRICT_COMMA_SEPARATED_EXPR W op:assign W right:STRICT_COMMA_SEPARATED_EXPR",
    "left:STRICT_COMMA_SEPARATED_EXPR W op:assign W right:EXPR",
    "left:EXPR W op:assign W right:EXPR",
  ], hooks:[reflect, reflect, reflect]},
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
  //'RETURN': function(node) {
  //  if(!node.children[2]) {
  //    return 'return';
  //  }
  //  return 'return ' + generateCode(node.children[2]);
  //},
  'STRICT_COMMA_SEPARATED_EXPR': function(node) {
    var elements = [];
    for (var i = 0; i < node.children.length; i++) {
      elements.push(generateCode(node.children[i]));
    }
    return '[' + elements.join(", ") + ']';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb2tlc2NyaXB0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBRHh4QkE7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKlxuICBDb2tlU2NyaXB0IGxhbmd1YWdlIGJ5IEJhdGlzdGUgQmllbGVyIDIwMTVcbiAgSW1wbGVtZW50ZWQgdXNpbmcgRVBFRy5KU1xuKi9cblwidXNlIHN0cmljdFwiO1xuXG52YXIgZXBlZ2pzID0gcmVxdWlyZShcImVwZWdqc1wiKTtcblxudmFyIGRlcHRoID0gMDtcbnZhciBmb3JMb29wQ291bnQgPSAxO1xudmFyIHVucGFja2luZyA9IDA7XG52YXIgbmFtZXNwYWNlcyA9IFt7fV07XG52YXIgbGV2ZWxTdGFjayA9IFswXTtcblxuZnVuY3Rpb24gY3VycmVudE5zKCkge1xuICByZXR1cm4gbmFtZXNwYWNlc1tuYW1lc3BhY2VzLmxlbmd0aCAtMV07XG59XG5cbmZ1bmN0aW9uIG5ld05zKCkge1xuICBuYW1lc3BhY2VzLnB1c2goe30pO1xuICByZXR1cm4gbmFtZXNwYWNlc1tuYW1lc3BhY2VzLmxlbmd0aCAtMV07XG59XG5cbmZ1bmN0aW9uIHJlc2V0R2xvYmFsKCkge1xuICBuYW1lc3BhY2VzID0gW3t9XTtcbiAgZm9yTG9vcENvdW50ID0gMTtcbiAgbGV2ZWxTdGFjayA9IFswXTtcbiAgZGVwdGggPSAwO1xuICB1bnBhY2tpbmcgPSAwO1xufVxuXG4vLyB0b2tlbiBhcmUgbWF0Y2hlZCBpbiBvcmRlciBvZiBkZWNsYXJhdGlvblxuLy8gVE9ETzogYWRkIGZ1bmN0aW9uc1xudmFyIHRva2VuRGVmID0gW1xuICB7a2V5Olwic3RyaW5nXCIsIGZ1bmM6c3RyaW5nRGVmfSxcbiAge2tleTpcImNvbW1lbnRcIiwgZnVuYzpjb21tZW50RGVmfSxcbiAge2tleTpcImZ1bmN0aW9uX2RlZlwiLCBmdW5jOiBkZWZEZWYsIHZlcmJvc2U6XCJmdW5jdGlvbiBkZWZpbml0aW9uXCJ9LFxuICB7a2V5OlwiY2xhc3NcIiwgcmVnOi9eY2xhc3MgL30sXG4gIHtrZXk6XCJyZXRcIiwgcmVnOi9ecmV0dXJuLywgdmVyYm9zZTpcInJldHVyblwifSxcbiAge2tleTpcImlmXCIsIHJlZzovXmlmIC99LFxuICB7a2V5Olwid2hpbGVcIiwgcmVnOi9ed2hpbGUgL30sXG4gIHtrZXk6XCJ0cnlcIiwgcmVnOi9edHJ5L30sXG4gIHtrZXk6XCJjYXRjaFwiLCByZWc6L15jYXRjaC99LFxuICB7a2V5OlwidGhyb3dcIiwgcmVnOi9edGhyb3cgL30sXG4gIHtrZXk6XCJuZXdcIiwgcmVnOi9ebmV3IC99LFxuICB7a2V5OlwidGFnXCIsIHJlZzovXjxbYS16QS1aXVswLTlhLXpBLVpdezAsMjl9L30sXG4gIHtrZXk6XCI+XCIsIHJlZzovXj4vfSxcbiAge2tleTpcImVsc2VpZlwiLCByZWc6L15lbHNlaWYgL30sXG4gIHtrZXk6XCJlbHNlXCIsIHJlZzovXmVsc2UvfSxcbiAge2tleTpcImZvcl9sb29wXCIsIHJlZzovXmZvciAvLCB2ZXJib3NlOlwiZm9yIGxvb3BcIn0sXG4gIHtrZXk6XCJpblwiLCByZWc6L15pbiAvfSxcbiAge2tleTpcIm5hbWVcIiwgcmVnOi9eW2EtekEtWl8kXVswLTlhLXpBLVpfJF17MCwyOX0vfSwgLy8gMzAgY2hhcnMgbWF4XG4gIHtrZXk6XCJyZWdleHBcIiwgZnVuYzpyZWdFeHBEZWYsIHZlcmJvc2U6XCJyZWd1bGFyIGVwcmVzc2lvblwifSxcbiAge2tleTpcIm1hdGhfb3BlcmF0b3JzXCIsIHJlZzovXihcXCtcXCt8XFwtXFwtKS8sIHZlcmJvc2U6XCJtYXRoIG9wZXJhdG9yXCJ9LFxuICB7a2V5OlwiYmluYXJ5X29wZXJhdG9yc1wiLCByZWc6L14oXFwmXFwmfFxcfFxcfHxcXCZ8XFx8fDw8fFxcPlxcPikvLCB2ZXJib3NlOlwiYmluYXJ5IG9wZXJhdG9yXCJ9LFxuICB7a2V5OlwiY29tcGFyaXNvblwiLCByZWc6L14oPD18Pj18PHw+fCE9fD09KS99LFxuICB7a2V5OlwiYXNzaWduXCIsIHJlZzovXihcXCs9fC09fD18Oj0pL30sXG4gIHtrZXk6XCJudW1iZXJcIiwgcmVnOi9eWzAtOV0rXFwuP1swLTldKi99LCAvLyBvbmx5IHBvc2l0aXZlIGZvciBub3dcbiAge2tleTpcImNvbW1hXCIsIHJlZzovXlxcLC99LFxuICB7a2V5OlwiZG90XCIsIHJlZzovXlxcLi99LFxuICB7a2V5OlwiY29sb25cIiwgcmVnOi9eXFw6LywgdmVyYm9zZTpcIjpcIn0sXG4gIHtrZXk6XCJvcGVuX3BhclwiLCByZWc6L15cXCgvLCB2ZXJib3NlOlwiKFwifSxcbiAge2tleTpcImNsb3NlX3BhclwiLCByZWc6L15cXCkvLCB2ZXJib3NlOlwiKVwifSxcbiAge2tleTpcIm9wZW5fYnJhXCIsIHJlZzovXlxcWy8sIHZlcmJvc2U6XCJbXCJ9LFxuICB7a2V5OlwiY2xvc2VfYnJhXCIsIHJlZzovXlxcXS8sIHZlcmJvc2U6XCJdXCJ9LFxuICB7a2V5Olwib3Blbl9jdXJseVwiLCByZWc6L15cXHsvLCB2ZXJib3NlOlwie1wifSxcbiAge2tleTpcImNsb3NlX2N1cmx5XCIsIHJlZzovXlxcfS8sIHZlcmJvc2U6XCJ9XCJ9LFxuICB7a2V5OlwibWF0aFwiLCByZWc6L15bLXxcXCt8XFwqfC98JV0vfSxcbiAge2tleTpcInNhbWVkZW50XCIsIGZ1bmM6ZGVudCgnc2FtZWRlbnQnKSwgdmVyYm9zZTpcInNhbWUgaW5kZW50YXRpb25cIn0sXG4gIHtrZXk6XCJkZWRlbnRcIiwgZnVuYzpkZW50KCdkZWRlbnQnKX0sXG4gIHtrZXk6XCJpbmRlbnRcIiwgZnVuYzpkZW50KCdpbmRlbnQnKX0sXG4gIC8vbmV3bGluZTogL14oXFxyP1xcbnwkKS8sXG4gIHtrZXk6XCJXXCIsIHJlZzovXlsgXS8sIHZlcmJvc2U6XCJzaW5nbGUgd2hpdGVzcGFjZVwifSxcbl07XG5cbmZ1bmN0aW9uIHN0YXJ0U3RyKGlucHV0LCBzdHJlYW0pIHtcbiAgdmFyIGxhc3QgPSBzdHJlYW1bc3RyZWFtLmxlbmd0aC0xXTtcbiAgaWYobGFzdCAmJiBsYXN0LnZhbHVlID09PSAnXFxcXCcpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYoaW5wdXQubWF0Y2goL14jey8pKSB7XG4gICAgcmV0dXJuICcjeyc7XG4gIH1cbn1cblxudmFyIHN0ckludGVycG9sYXRpb25Ub2tlbkRlZiA9IFtcbiAge2tleTpcInN0YXJ0XCIsIGZ1bmM6c3RhcnRTdHJ9LFxuICB7a2V5OlwiZW5kXCIsIHJlZzovXn0vfSxcbiAge2tleTpcIm5hbWVcIiwgcmVnOi9eW2EtekEtWl8kXVswLTlhLXpBLVpfXXswLDI5fS99LFxuICB7a2V5OlwiZG90XCIsIHJlZzovXlxcLi99LFxuICB7a2V5OlwiY2hhclwiLCByZWc6L14uL30sXG5dO1xuXG52YXIgc3RySW50ZXJwb2xhdGlvbkdyYW1tYXJEZWYgPSB7XG4gIFwiU1RBUlRcIjoge3J1bGVzOltcIkVMKiBFT0ZcIl19LFxuICBcIkVMXCI6IHtydWxlczpbXCJWQVJcIiwgXCJjaGFyXCIsIFwibmFtZVwiLCBcInN0YXJ0XCIsIFwiZW5kXCIsIFwiZG90XCJdfSxcbiAgXCJWQVJcIjoge3J1bGVzOltcInN0YXJ0IE5BTUUgZW5kXCJdfSxcbiAgXCJOQU1FXCI6IHtydWxlczpbXCJuYW1lIGRvdCBOQU1FXCIsIFwibmFtZVwiXX0sXG59O1xuXG52YXIgc3RyR3JhbSA9IGVwZWdqcy5jb21waWxlR3JhbW1hcihzdHJJbnRlcnBvbGF0aW9uR3JhbW1hckRlZiwgc3RySW50ZXJwb2xhdGlvblRva2VuRGVmKTtcblxuZnVuY3Rpb24gZ2VuZXJhdGVTdHJpbmdDb2RlKG5vZGUpIHtcbiAgaWYobm9kZS50eXBlID09PSAnVkFSJykge1xuICAgIHJldHVybiAnXCIgKyAnICsgZ2VuZXJhdGVTdHJpbmdDb2RlKG5vZGUuY2hpbGRyZW5bMV0pICsgJyArIFwiJztcbiAgfVxuICBpZihub2RlLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgfVxuICB2YXIgc3RyID0gXCJcIiwgaTtcbiAgaWYoIW5vZGUuY2hpbGRyZW4pIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgZm9yKGk9MDtpPG5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICBzdHIgKz0gZ2VuZXJhdGVTdHJpbmdDb2RlKG5vZGUuY2hpbGRyZW5baV0pO1xuICB9XG4gIHJldHVybiBzdHI7XG59XG5cbmZ1bmN0aW9uIGN1cnJlbnRMZXZlbCgpIHtcbiAgcmV0dXJuIGxldmVsU3RhY2tbbGV2ZWxTdGFjay5sZW5ndGggLSAxXTtcbn1cblxuZnVuY3Rpb24gaW5kZW50VHlwZShsKSB7XG4gIGlmKGwgPiBjdXJyZW50TGV2ZWwoKSkge1xuICAgIHJldHVybiAnaW5kZW50JztcbiAgfVxuICBpZihsIDwgY3VycmVudExldmVsKCkpIHtcbiAgICByZXR1cm4gJ2RlZGVudCc7XG4gIH1cbiAgaWYobCA9PT0gY3VycmVudExldmVsKCkpIHtcbiAgICByZXR1cm4gJ3NhbWVkZW50JztcbiAgfVxufVxuXG5mdW5jdGlvbiBkZW50KGRlbnRUeXBlKSB7XG4gIHJldHVybiBmdW5jdGlvbiBfZGVudChpbnB1dCkge1xuICAgIC8vIGVtcHR5IGxpbmUgaXMgYSBzYW1lZGVudFxuICAgIHZhciBtID0gaW5wdXQubWF0Y2goL15cXG5bXFxzXSovKTtcbiAgICBpZihtKSB7XG4gICAgICB2YXIgbGluZXMgPSBtWzBdLnNwbGl0KFwiXFxuXCIpO1xuICAgICAgdmFyIGluZGVudCA9IGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdLmxlbmd0aDtcbiAgICAgIGlmKGluZGVudFR5cGUoaW5kZW50KSA9PT0gZGVudFR5cGUpIHtcbiAgICAgICAgaWYoZGVudFR5cGUgPT0gJ2RlZGVudCcpIHtcbiAgICAgICAgICBsZXZlbFN0YWNrLnBvcCgpO1xuICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfVxuICAgICAgICBpZihkZW50VHlwZSA9PSAnaW5kZW50Jykge1xuICAgICAgICAgIGxldmVsU3RhY2sucHVzaChpbmRlbnQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtWzBdO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gc3RyaW5nRGVmKGlucHV0KSB7XG4gIGlmKGlucHV0LmNoYXJBdCgwKSA9PT0gJ1wiJykge1xuICAgIHZhciBpID0gMTtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpIHtcbiAgICAgIHZhciBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxcXCcpIHtcbiAgICAgICAgaSsrO1xuICAgICAgfSBlbHNlIGlmKGNoID09PSAnXCInKSB7XG4gICAgICAgIHJldHVybiBpbnB1dC5zbGljZSgwLCBpKzEpO1xuICAgICAgfVxuICAgICAgaSsrO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiByZWdFeHBEZWYoaW5wdXQpIHtcbiAgaWYoaW5wdXQuY2hhckF0KDApID09PSAnLycpIHtcbiAgICB2YXIgaSA9IDE7XG4gICAgd2hpbGUoaW5wdXQuY2hhckF0KGkpKSB7XG4gICAgICB2YXIgY2ggPSBpbnB1dC5jaGFyQXQoaSk7XG4gICAgICBpZihjaCA9PT0gJ1xcXFwnKSB7XG4gICAgICAgIGkrKztcbiAgICAgIH0gZWxzZSBpZihjaCA9PT0gJy8nKSB7XG4gICAgICAgIGkrKztcbiAgICAgICAgLy8gbW9kaWZpZXJzXG4gICAgICAgIHdoaWxlKFwiaWdtXCIuaW5kZXhPZihpbnB1dC5jaGFyQXQoaSkpICE9PSAtMSkge1xuICAgICAgICAgIGkrKztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGRlZkRlZihpbnB1dCkge1xuICBpZihpbnB1dC5pbmRleE9mKFwiZGVmKFwiKSA9PT0gMCkge1xuICAgIHJldHVybiBcImRlZlwiO1xuICB9XG4gIGlmKGlucHV0LmluZGV4T2YoXCJkZWYgXCIpID09PSAwKSB7XG4gICAgcmV0dXJuIFwiZGVmXCI7XG4gIH1cbiAgaWYoaW5wdXQuaW5kZXhPZihcImRlZlxcblwiKSA9PT0gMCkge1xuICAgIHJldHVybiBcImRlZlwiO1xuICB9XG4gIGlmKGlucHV0LmluZGV4T2YoXCJkb20gXCIpID09PSAwKSB7XG4gICAgcmV0dXJuIFwiZG9tXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tbWVudERlZihpbnB1dCkge1xuICB2YXIgbSA9IGlucHV0Lm1hdGNoKC9eIy8pO1xuICBpZihtKSB7XG4gICAgdmFyIGkgPSBtWzBdLmxlbmd0aDtcbiAgICB3aGlsZShpbnB1dC5jaGFyQXQoaSkpIHtcbiAgICAgIHZhciBjaCA9IGlucHV0LmNoYXJBdChpKTtcbiAgICAgIGlmKGNoID09PSAnXFxuJykge1xuICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSk7XG4gICAgICB9XG4gICAgICBpKys7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHJlZmxlY3QocGFyYW1zKSB7XG4gIHJldHVybiBwYXJhbXM7XG59XG5cbnZhciBncmFtbWFyRGVmID0ge1xuICBcIlNUQVJUXCI6IHtydWxlczpbXCJMSU5FKiBFT0ZcIl19LFxuICBcIkVMQ1wiOiB7cnVsZXM6W1wiVyogY29tbWVudFwiXSwgdmVyYm9zZTpcImNvbW1lbnRcIn0sXG4gIFwiTElORVwiOiB7cnVsZXM6W1wiU1RBVEVNRU5UIEVMQz8gc2FtZWRlbnQrXCIsIFwiU1RBVEVNRU5UIEVMQz8gIWRlZGVudFwiLCBcbiAgICBcIkVMQz8gc2FtZWRlbnRcIiwgXCJFTEMgIWRlZGVudFwiXSwgdmVyYm9zZTpcIm5ldyBsaW5lXCJ9LFxuICBcIkJMT0NLXCI6IHtydWxlczogW1wiaW5kZW50IExJTkUrIGRlZGVudFwiXX0sXG4gIFwiU1RBVEVNRU5UXCI6IHtydWxlczpbXCJBU1NJR05cIiwgXCJFWFBSXCIsIFwiSUZcIiwgXCJXSElMRVwiLCBcIkZPUlwiLCBcIlJFVFVSTlwiLCBcbiAgICBcIkNMQVNTXCIsIFwiVEFHXCIsIFwiRE9NX0FTU0lHTlwiLCBcIlRSWV9DQVRDSFwiLCBcIlRIUk9XXCJdfSxcbiAgXCJDTEFTU19NRVRIT0RTXCI6IHtcbiAgICAgIHJ1bGVzOiBbXCJzYW1lZGVudCogZjpGVU5DX0RFRiBzYW1lZGVudCpcIl0sXG4gICAgICBob29rczogWyBmdW5jdGlvbihwKXsgcmV0dXJuIHAuZjsgfV1cbiAgfSxcbiAgXCJDTEFTU1wiOiB7XG4gICAgcnVsZXM6IFtcbiAgICAgIFwiY2xhc3MgbjpuYW1lIG9wZW5fcGFyIHA6bmFtZSBjbG9zZV9wYXIgaW5kZW50IG06Q0xBU1NfTUVUSE9EUysgZGVkZW50XCIsXG4gICAgICBcImNsYXNzIG46bmFtZSBpbmRlbnQgbTpDTEFTU19NRVRIT0RTKyBkZWRlbnRcIlxuICAgIF0sXG4gICAgaG9va3M6IFtcbiAgICAgIGZ1bmN0aW9uKHApeyByZXR1cm4ge25hbWU6cC5uLCBtZXRob2RzOnAubSwgcGFyZW50OnAucH07IH0sXG4gICAgICBmdW5jdGlvbihwKXsgcmV0dXJuIHtuYW1lOnAubiwgbWV0aG9kczpwLm19OyB9XG4gICAgXVxuICB9LFxuICBcIkZVTkNfREVGX1BBUkFNU1wiOiB7cnVsZXM6W1xuICAgICAgXCJwMTpGVU5DX0RFRl9QQVJBTVMgY29tbWEgVyBwMjpGVU5DX0RFRl9QQVJBTVNcIixcbiAgICAgIFwicDE6bmFtZSBhc3NpZ24gZTpFWFBSXCIsXG4gICAgICBcInAxOm5hbWVcIixcbiAgICBdLFxuICAgIHZlcmJvc2U6XCJmdW5jdGlvbiBwYXJhbWV0ZXJzXCJcbiAgfSxcbiAgXCJMQU1CREFcIjoge3J1bGVzOltcbiAgICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIG9wZW5fcGFyIHBhcmFtczpGVU5DX0RFRl9QQVJBTVM/IGNsb3NlX3BhciBXIGJsb2NrOkVYUFJcIixcbiAgICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBvcGVuX3BhciBwYXJhbXM6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgVyBibG9jazpFWFBSXCIsXG4gICAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGJsb2NrOkVYUFJcIixcbiAgICBdLFxuICAgIGhvb2tzOiBbcmVmbGVjdCwgcmVmbGVjdCwgcmVmbGVjdF1cbiAgfSxcbiAgXCJGVU5DX0RFRlwiOiB7cnVsZXM6W1xuICAgICAgXCJmZDpmdW5jdGlvbl9kZWYgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIGJsb2NrOkJMT0NLXCIsXG4gICAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGZuOm5hbWUgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIGJsb2NrOkJMT0NLXCIsXG4gICAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGZuOm5hbWUgYmxvY2s6QkxPQ0tcIixcbiAgICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIGJsb2NrOkJMT0NLXCIsXG4gICAgXSxcbiAgICBob29rczogW3JlZmxlY3QsIHJlZmxlY3QsIHJlZmxlY3QsIHJlZmxlY3RdLFxuICAgIHZlcmJvc2U6XCJmdW5jdGlvbiBkZWZpbml0aW9uXCJcbiAgfSxcbiAgXCJFTFNFX0lGXCI6IHtydWxlczpbXCJzYW1lZGVudCBlbHNlaWYgZTpFWFBSIGI6QkxPQ0tcIl0sIGhvb2tzOltyZWZsZWN0XX0sXG4gIFwiRUxTRVwiOiB7cnVsZXM6W1wic2FtZWRlbnQgZWxzZSBiOkJMT0NLXCJdLCBob29rczpbcmVmbGVjdF19LFxuICBcIklGXCI6IHtydWxlczpbXCJpZiBlOkVYUFIgYjpCTE9DSyBlbGlmOkVMU0VfSUYqIGVsOkVMU0U/XCJdLCBob29rczpbcmVmbGVjdF19LFxuICBcIkVMU0VfRVhQUlwiOiB7cnVsZXM6W1wiVyBlbHNlIFcgYjpFWFBSXCJdLCBob29rczpbcmVmbGVjdF19LFxuICBcIklGX0VYUFJcIjoge3J1bGVzOltcImU6RVhQUiBXIGlmIHRlc3Q6RVhQUiBlbDpFTFNFX0VYUFI/XCJdLCBob29rczpbcmVmbGVjdF19LFxuICBcIldISUxFXCI6IHtydWxlczpbXCJ3aGlsZSBlOkVYUFIgYjpCTE9DS1wiXSwgaG9va3M6W3JlZmxlY3RdfSxcbiAgXCJNQVRIXCI6IHtydWxlczpbXCJlMTpFWFBSIFcgb3A6bWF0aCBXIGUyOkVYUFJcIl19LFxuICBcIlBBVEhcIjoge3J1bGVzOltcIlBBVEggZG90IG5hbWVcIiwgXCJQQVRIIG9wZW5fYnJhIG51bWJlciBjbG9zZV9icmFcIiwgXCJuYW1lXCJdfSxcbiAgXCJBU1NJR05cIjoge3J1bGVzOltcbiAgICBcImxlZnQ6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSIFcgb3A6YXNzaWduIFcgcmlnaHQ6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSXCIsXG4gICAgXCJsZWZ0OlNUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUiBXIG9wOmFzc2lnbiBXIHJpZ2h0OkVYUFJcIixcbiAgICBcImxlZnQ6RVhQUiBXIG9wOmFzc2lnbiBXIHJpZ2h0OkVYUFJcIixcbiAgXSwgaG9va3M6W3JlZmxlY3QsIHJlZmxlY3QsIHJlZmxlY3RdfSxcbiAgXCJXX09SX1NBTUVERU5UXCI6IHtydWxlczpbXCJXXCIsIFwic2FtZWRlbnRcIl0sIHZlcmJvc2U6IFwic2FtZWRlbnQgb3Igd2hpdGVzcGFjZVwifSxcbiAgXCJXX1NBTUVERU5UX0lOREVOVFwiOiB7cnVsZXM6W1wiV1wiLCBcInNhbWVkZW50XCIsIFwiaW5kZW50XCJdLCB2ZXJib3NlOiBcImluZGVudCBvciBzYW1lZGVudCBvciB3aGl0ZXNwYWNlXCJ9LFxuICBcIkFOWV9TUEFDRVwiOiB7cnVsZXM6W1wiV1wiLCBcInNhbWVkZW50XCIsIFwiaW5kZW50XCIsIFwiZGVkZW50XCJdLCB2ZXJib3NlOiBcImFueSBzcGFjZVwifSxcbiAgLy8gVE9ETzogd2h5IEFOWV9TUEFDRSogaGVyZT9cbiAgXCJGVU5DX0NBTExfUEFSQU1TXCI6IHtydWxlczpbXCJFWFBSIGNvbW1hIEFOWV9TUEFDRSsgRlVOQ19DQUxMX1BBUkFNUyBBTllfU1BBQ0UqXCIsIFwiRVhQUiBBTllfU1BBQ0UqXCJdfSxcbiAgXCJGVU5DX0NBTExcIjoge3J1bGVzOltcbiAgICBcIm9wZW5fcGFyIEZVTkNfQ0FMTF9QQVJBTVM/IGNsb3NlX3BhclwiLFxuICAgIC8vXCJvcGVuX3BhciBpbmRlbnQgRlVOQ19DQUxMX1BBUkFNUz8gZGVkZW50IHNhbWVkZW50IGNsb3NlX3BhclwiLFxuICAgIC8vXCJvcGVuX3BhciBpbmRlbnQgRlVOQ19DQUxMX1BBUkFNUz8gY2xvc2VfcGFyIGRlZGVudFwiXG4gIF19LFxuXG4gIFwiVFlQRVwiOiB7cnVsZXM6W1wibmFtZSBjb2xvblwiXX0sXG5cbiAgXCJGT1JcIjoge3J1bGVzOltcbiAgICBcImZvcl9sb29wIGs6bmFtZSBjb21tYSBXIHY6bmFtZSBXIGluIHQ6VFlQRT8gYTpuYW1lIGI6QkxPQ0tcIixcbiAgICBcImZvcl9sb29wIHY6bmFtZSBXIGluIHQ6VFlQRT8gYTpuYW1lIGI6QkxPQ0tcIl0sXG4gICAgaG9va3M6IFtyZWZsZWN0LCByZWZsZWN0XVxuICB9LFxuXG4gIFwiU1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSXCI6IHtydWxlczpbXG4gICAgXCJlMTpFWFBSIGNvbW1hIFcgZTI6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSXCIsXG4gICAgXCJlMTpFWFBSIGNvbW1hIFcgZTI6RVhQUlwiXG4gIF0sXG4gIGhvb2tzOiBbZnVuY3Rpb24ocCkge1xuICAgIC8vIHVucm9sbCByZWN1c3Jpb25cbiAgICByZXR1cm4gW3AuZTFdLmNvbmNhdChwLmUyLmNoaWxkcmVuKTtcbiAgfSxcbiAgZnVuY3Rpb24ocCkge1xuICAgIHJldHVybiBbcC5lMSwgcC5lMl07XG4gIH1dIFxuICB9LFxuXG4gIFwiQ09NTUFfU0VQQVJBVEVEX0VYUFJcIjoge3J1bGVzOltcbiAgICBcIkVYUFIgY29tbWEgQU5ZX1NQQUNFKyBDT01NQV9TRVBBUkFURURfRVhQUiBBTllfU1BBQ0UqXCIsXG4gICAgXCJFWFBSIEFOWV9TUEFDRSpcIlxuICBdfSxcblxuICBcIkFSUkFZXCI6IHtydWxlczpbXG4gICAgXCJvcGVuX2JyYSBBTllfU1BBQ0UqIGM6Q09NTUFfU0VQQVJBVEVEX0VYUFI/IEFOWV9TUEFDRSogY2xvc2VfYnJhXCIsXG4gICAgLy9cIm9wZW5fYnJhIGluZGVudCBjOkNPTU1BX1NFUEFSQVRFRF9FWFBSPyBkZWRlbnQgc2FtZWRlbnQgY2xvc2VfYnJhXCIsXG4gICAgLy9cIm9wZW5fYnJhIGluZGVudCBjOkNPTU1BX1NFUEFSQVRFRF9FWFBSPyBjbG9zZV9icmEgZGVkZW50XCIsXG4gIF19LFxuXG4gIFwiTUVNQkVSU1wiOiB7cnVsZXM6W1xuICAgIFwibmFtZSBjb2xvbiBXIEVYUFIgc2FtZWRlbnQ/IGNvbW1hIEFOWV9TUEFDRSsgTUVNQkVSUyBBTllfU1BBQ0UqXCIsXG4gICAgXCJuYW1lIGNvbG9uIFcgRVhQUiBBTllfU1BBQ0UqXCJcbiAgXX0sXG5cbiAgXCJPQkpFQ1RcIjoge3J1bGVzOltcbiAgICBcIm9wZW5fY3VybHkgaW5kZW50PyBNRU1CRVJTPyBjbG9zZV9jdXJseVwiLFxuICBdfSxcblxuICBcIlRBR19QQVJBTVNcIjoge3J1bGVzOltcbiAgICAgIFwibGVmdDpUQUdfUEFSQU1TIFcgcmlnaHQ6VEFHX1BBUkFNU1wiLFxuICAgICAgXCJuOm5hbWUgYXNzaWduIGU6RVhQUlwiLFxuICAgICAgXCJuOm5hbWVcIixcbiAgICBdLFxuICAgIGhvb2tzOltyZWZsZWN0LCByZWZsZWN0LCByZWZsZWN0XSxcbiAgICB2ZXJib3NlOlwidGFnIHBhcmFtZXRlcnNcIlxuICB9LFxuXG4gIFwiVEFHXCI6IHtydWxlczpbXG4gICAgXCJ0YWc6dGFnIFc/IHBhcmFtczpUQUdfUEFSQU1TPyBlbmQ6Pj8gYmxvY2s6QkxPQ0s/XCIsXG4gIF0sXG4gIGhvb2tzOltyZWZsZWN0XVxuICB9LFxuXG4gIFwiRE9NX0FTU0lHTlwiOiB7cnVsZXM6W1xuICAgIFwiYXNzaWduIEVYUFJcIixcbiAgXX0sXG5cbiAgXCJUUllfQ0FUQ0hcIjoge1xuICAgIHJ1bGVzOltcbiAgICAgIFwidHJ5IGIxOkJMT0NLIHNhbWVkZW50PyBjYXRjaCBvcGVuX3BhciBlcnI6bmFtZT8gY2xvc2VfcGFyIGIyOkJMT0NLXCIsXG4gICAgXSxcbiAgICBob29rczpbcmVmbGVjdF0sXG4gIH0sXG5cbiAgXCJUSFJPV1wiOiB7cnVsZXM6W1xuICAgIFwidGhyb3cgRVhQUlwiLFxuICBdfSxcblxuICBcIlJFVFVSTlwiOiB7cnVsZXM6W1wicmV0IFcgU1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSXCIsIFwicmV0IFcgRVhQUlwiLCBcInJldFwiXX0sXG4gIFwiUklHSFRfRVhQUlwiOiB7cnVsZXM6IFtcbiAgICBcIm1hdGhfb3BlcmF0b3JzXCIsXG4gICAgXCJXIGJpbmFyeV9vcGVyYXRvcnMgVyBFWFBSXCIsXG4gICAgXCJXIGNvbXBhcmlzb24gVyBFWFBSXCIsXG4gICAgXCJXID4gVyBFWFBSXCIsXG4gICAgXCJkb3QgRVhQUlwiLFxuICAgIFwib3Blbl9icmEgRVhQUiBjbG9zZV9icmFcIixcbiAgICBcIkZVTkNfQ0FMTFwiXG4gICAgXSxcbiAgICB2ZXJib3NlOlwiZXhwcmVzc2lvblwiXG4gIH0sXG5cbiAgXCJFWFBSXCI6IHtydWxlczogW1xuICAgIFwiSUZfRVhQUlwiLFxuICAgIFwiTUFUSFwiLFxuICAgIFwiT0JKRUNUXCIsXG4gICAgXCJGVU5DX0RFRlwiLFxuICAgIFwiRVhQUiBSSUdIVF9FWFBSXCIsXG4gICAgLy9cIkZVTkNfQ0FMTFwiLFxuICAgIFwiTEFNQkRBXCIsXG4gICAgXCJudW1iZXJcIixcbiAgICBcInJlZ2V4cFwiLFxuICAgIFwib3Blbl9wYXIgRVhQUiBjbG9zZV9wYXJcIixcbiAgICBcIm5ldyBFWFBSXCIsXG4gICAgXCJzdHJpbmdcIixcbiAgICBcIm5hbWVcIixcbiAgICBcIlBBVEhcIixcbiAgICBcIkFSUkFZXCJdLFxuICAgIHZlcmJvc2U6XCJleHByZXNzaW9uXCJcbiAgfSxcbn07XG5cbmZ1bmN0aW9uIHNwYWNlcihuKSB7XG4gIHZhciBvdXQgPSBcIlwiO1xuICBmb3IodmFyIGk9MDsgaTxuOyBpKyspIHtcbiAgICBvdXQgKz0gXCIgXCI7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cblxuZnVuY3Rpb24gc3AobW9kKSB7XG4gIGlmKG1vZCkge1xuICAgIHJldHVybiBzcGFjZXIoMiAqIChkZXB0aCttb2QpKTtcbiAgfVxuICByZXR1cm4gc3BhY2VyKDIgKiBkZXB0aCk7XG59XG5cbnZhciBuYyA9IDE7XG4vLyBjaGlsZHJlbiBuYW1lXG5mdW5jdGlvbiBDTigpIHtcbiAgcmV0dXJuICdfX2MnICsgbmM7XG59XG5mdW5jdGlvbiBwdXNoQ04oKSB7XG4gIG5jKys7XG4gIHJldHVybiAnX19jJyArIG5jO1xufVxuZnVuY3Rpb24gcG9wQ04oKSB7XG4gIG5jLS07XG4gIHJldHVybiAnX19jJyArIG5jO1xufVxuXG52YXIgYmFja2VuZCA9IHtcblxuICAnZGVkZW50JzogZnVuY3Rpb24obm9kZSkge1xuICAgIGRlcHRoID0gTWF0aC5tYXgoMCwgZGVwdGggLSAxKTtcbiAgICByZXR1cm4gJyc7XG4gIH0sXG4gICdpbmRlbnQnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgZGVwdGggPSBkZXB0aCArIDE7XG4gICAgcmV0dXJuICdcXG4nK3NwKCk7XG4gIH0sXG4gICdzYW1lZGVudCc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICByZXR1cm4gJ1xcbicrc3AoKTtcbiAgfSxcbiAgJ0RPTV9BU1NJR04nOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG5hbWUgPSBDTigpO1xuICAgIHJldHVybiBuYW1lKycucHVzaChTdHJpbmcoJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzFdKSArICcpKSc7XG4gIH0sXG4gICdUQUdfUEFSQU1TJzogZnVuY3Rpb24obm9kZSkge1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ubGVmdCkge1xuICAgICAgcmV0dXJuIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmxlZnQpICsgJywgJyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnJpZ2h0KTtcbiAgICB9XG4gICAgaWYobm9kZS5jaGlsZHJlbi5lKSB7XG4gICAgICByZXR1cm4gbm9kZS5jaGlsZHJlbi5uLnZhbHVlICsgJzonICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBub2RlLmNoaWxkcmVuLm4udmFsdWUgKyAnOiB0cnVlJztcbiAgICB9XG4gIH0sXG4gICdUQUcnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHN0ciA9ICcnLCBpLCBwYXJhbXMgPSBcIntcIjtcbiAgICB2YXIgbmFtZSA9IG5vZGUuY2hpbGRyZW4udGFnLnZhbHVlLnN1YnN0cmluZygxKTtcbiAgICBpZihub2RlLmNoaWxkcmVuLnBhcmFtcykge1xuICAgICAgcGFyYW1zICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnBhcmFtcyk7XG4gICAgfVxuICAgIHBhcmFtcyArPSAnfSc7XG4gICAgdmFyIHN1YiA9ICdbXSc7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgc3ViID0gcHVzaENOKCk7XG4gICAgICBzdHIgKz0gJ3ZhciAnICsgQ04oKSArICcgPSBbXTsnO1xuICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrKTtcbiAgICAgIHBvcENOKCk7XG4gICAgfVxuICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgQ04oKSArICcucHVzaChoKFwiJytuYW1lKydcIiwgJytwYXJhbXMrJywgJytzdWIrJykpJztcbiAgICByZXR1cm4gc3RyO1xuICB9LFxuICAnQ0xBU1MnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG5hbWUgPSBub2RlLmNoaWxkcmVuLm5hbWUudmFsdWUsIGk7XG4gICAgdmFyIGZ1bmNzID0gbm9kZS5jaGlsZHJlbi5tZXRob2RzO1xuICAgIHZhciBwYXJlbnQgPSBub2RlLmNoaWxkcmVuLnBhcmVudDtcbiAgICB2YXIgc3RyID0gJyc7XG4gICAgdmFyIGNvbnN0cnVjdG9yID0gbnVsbDtcbiAgICBmb3IoaT0wO2k8ZnVuY3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBmdW5jX2RlZiA9IGZ1bmNzW2ldLmNoaWxkcmVuO1xuICAgICAgdmFyIGZ1bmNfbmFtZSA9IGZ1bmNfZGVmLmNoaWxkcmVuLmZuLnZhbHVlO1xuICAgICAgaWYoZnVuY19uYW1lID09PSAnY29uc3RydWN0b3InKSB7XG4gICAgICAgIGNvbnN0cnVjdG9yID0gZnVuY19kZWY7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHIgKz0gJ1xcbicgKyBzcCgpICsgbmFtZSArICcucHJvdG90eXBlLicgKyBmdW5jX25hbWUgKyAnID0gJyArIGdlbmVyYXRlQ29kZShmdW5jX2RlZik7XG4gICAgICB9XG4gICAgfVxuICAgIHZhciBucyA9IGN1cnJlbnROcygpO1xuICAgIG5zW25hbWVdID0gdHJ1ZTtcbiAgICBucyA9IG5ld05zKCk7XG5cbiAgICB2YXIgcGFyYW1zID0gY29uc3RydWN0b3IgJiYgY29uc3RydWN0b3IuY2hpbGRyZW4ucGFyYW1zO1xuICAgIGlmKHBhcmFtcykge1xuICAgICAgcGFyYW1zID0gZ2VuZXJhdGVDb2RlKHBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcmFtcyA9ICcnO1xuICAgIH1cbiAgICB2YXIgYm9keSA9IGNvbnN0cnVjdG9yICYmIGNvbnN0cnVjdG9yLmNoaWxkcmVuLmJsb2NrO1xuICAgIHZhciBjb25zX3N0ciA9ICd2YXIgJyArIG5hbWUgKyAnID0gZnVuY3Rpb24gJyArIG5hbWUgKyAnKCcrIHBhcmFtcyArICcpIHsnO1xuICAgIGNvbnNfc3RyICs9ICdcXG4nK3NwKDEpKydpZighKHRoaXMgaW5zdGFuY2VvZiAnK25hbWUrJykpeyByZXR1cm4gbmV3ICcrbmFtZSsnKCcrT2JqZWN0LmtleXMobnMpLmpvaW4oJywnKSsnKTt9JztcbiAgICBmb3IodmFyIGtleSBpbiBucykge1xuICAgICAgaWYobnNba2V5XSAhPT0gdHJ1ZSAmJiBuc1trZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc19zdHIgKz0gJ1xcbicrc3AoMSkrJ2lmKCcra2V5KycgPT09IHVuZGVmaW5lZCkgeycra2V5KycgPSAnK2dlbmVyYXRlQ29kZShuc1trZXldKSsnfTsnO1xuICAgICAgfVxuICAgIH1cbiAgICBpZihib2R5KSB7XG4gICAgICBjb25zX3N0ciArPSBnZW5lcmF0ZUNvZGUoYm9keSk7XG4gICAgfVxuICAgIGNvbnNfc3RyICs9IHNwKCkgKyAnXFxufSc7XG5cbiAgICBpZihwYXJlbnQpIHtcbiAgICAgIGNvbnNfc3RyICs9ICdcXG4nK3NwKCkgKyBuYW1lICsgJy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKCcgKyBwYXJlbnQudmFsdWUgKyAnLnByb3RvdHlwZSk7JztcbiAgICAgIGNvbnNfc3RyICs9ICdcXG4nK3NwKCkgKyBuYW1lICsgJy5wcm90b3R5cGUuY29uc3RydWN0b3IgPSAnK25hbWUrJyc7XG4gICAgICAvL2NvbnNfc3RyICs9ICdcXG4nK3NwKCkgKyBuYW1lICsgJy5wcm90b3R5cGUuc3VwZXIgPSBmdW5jdGlvbigpeycgKyBwYXJlbnQudmFsdWUgKyAnLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7fSc7XG4gICAgfVxuXG4gICAgbmFtZXNwYWNlcy5wb3AoKTtcbiAgICByZXR1cm4gY29uc19zdHIgKyBzdHI7XG4gIH0sXG4gICdMQU1CREEnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG5hbWUgPSBcIlwiO1xuICAgIHZhciBucyA9IG5ld05zKCk7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5mbikge1xuICAgICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICBuc1tuYW1lXSA9IHRydWU7XG4gICAgfVxuICAgIHZhciBzdHIgPSBcImZ1bmN0aW9uIFwiICsgbmFtZSArIFwiKFwiO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ucGFyYW1zKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucGFyYW1zLCBucyk7XG4gICAgfVxuICAgIHN0ciArPSAnKSB7JztcbiAgICBmb3IodmFyIGtleSBpbiBucykge1xuICAgICAgaWYobnNba2V5XSAhPT0gdHJ1ZSAmJiBuc1trZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc3RyICs9ICdcXG4nK3NwKDEpKydpZignK2tleSsnID09PSB1bmRlZmluZWQpIHsnK2tleSsnID0gJytnZW5lcmF0ZUNvZGUobnNba2V5XSkrJ307JztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgc3RyICs9ICcgcmV0dXJuICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5ibG9jaywgbnMpO1xuICAgIH1cbiAgICBuYW1lc3BhY2VzLnBvcCgpO1xuICAgIHJldHVybiBzdHIgKyBcIjsgfVwiO1xuICB9LFxuICAnRlVOQ19ERUYnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIG5hbWUgPSBcIlwiO1xuICAgIHZhciBucyA9IGN1cnJlbnROcygpO1xuICAgIHZhciBpc19kb20gPSBub2RlLmNoaWxkcmVuLmZkLnZhbHVlID09PSAnZG9tJztcbiAgICBpZihub2RlLmNoaWxkcmVuLmZuKSB7XG4gICAgICBuYW1lID0gbm9kZS5jaGlsZHJlbi5mbi52YWx1ZTtcbiAgICAgIG5zW25hbWVdID0gdHJ1ZTtcbiAgICB9XG4gICAgbnMgPSBuZXdOcygpO1xuICAgIHZhciBzdHIgPSBcImZ1bmN0aW9uIFwiICsgbmFtZSArIFwiKFwiO1xuICAgIGlmKG5vZGUuY2hpbGRyZW4ucGFyYW1zKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucGFyYW1zKTtcbiAgICB9XG4gICAgc3RyICs9ICcpIHsnO1xuICAgIGZvcih2YXIga2V5IGluIG5zKSB7XG4gICAgICBpZihuc1trZXldICE9PSB0cnVlICYmIG5zW2tleV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzdHIgKz0gJ1xcbicrc3AoMSkrJ2lmKCcra2V5KycgPT09IHVuZGVmaW5lZCkgeycra2V5KycgPSAnK2dlbmVyYXRlQ29kZShuc1trZXldKSsnO30nO1xuICAgICAgfVxuICAgIH1cbiAgICBpZihpc19kb20pIHtcbiAgICAgIHN0ciArPSAnXFxuJytzcCgxKSArICd2YXIgJyArIENOKCkgKyAnID0gW107JztcbiAgICB9XG5cbiAgICBpZihub2RlLmNoaWxkcmVuLmJsb2NrKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYmxvY2spO1xuICAgIH1cbiAgICBuYW1lc3BhY2VzLnBvcCgpO1xuXG4gICAgaWYoaXNfZG9tKSB7XG4gICAgICBzdHIgKz0gJ1xcbicrc3AoMSkgKyAncmV0dXJuICcgKyBDTigpICsgJzsnO1xuICAgIH1cbiAgICByZXR1cm4gc3RyICsgJ1xcbicrc3AoKSsnfSc7XG4gIH0sXG4gICdGVU5DX0RFRl9QQVJBTVMnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHN0ciA9IFwiXCIsIGk7XG4gICAgdmFyIG5zID0gY3VycmVudE5zKCk7XG4gICAgaWYobm9kZS5jaGlsZHJlblswXS50eXBlID09PSAnbmFtZScpIHtcbiAgICAgIG5zW25vZGUuY2hpbGRyZW5bMF0udmFsdWVdID0gdHJ1ZTtcbiAgICAgIGlmKG5vZGUuY2hpbGRyZW5bMV0gJiYgbm9kZS5jaGlsZHJlblsxXS50eXBlID09PSAnYXNzaWduJykge1xuICAgICAgICBuc1tub2RlLmNoaWxkcmVuWzBdLnZhbHVlXSA9IG5vZGUuY2hpbGRyZW5bMl07XG4gICAgICB9XG4gICAgfVxuICAgIGZvcihpPTA7aTxub2RlLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgbiA9IG5vZGUuY2hpbGRyZW5baV07XG4gICAgICBpZihuLnR5cGUgPT09ICduYW1lJyB8fCBuLnR5cGUgPT09ICdGVU5DX0RFRl9QQVJBTVMnIHx8IG4udHlwZSA9PT0gJ2NvbW1hJyB8fCBuLnR5cGUgPT09ICd3aW5kb3cnKSB7XG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbltpXSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG4gIH0sXG4gICdBU1NJR04nOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHByZWZpeCA9IFwiXCIsIHN0ciA9IFwiXCIsIGk7XG4gICAgdmFyIG9wID0gbm9kZS5jaGlsZHJlbi5vcC52YWx1ZTtcbiAgICB2YXIgZXhwbGljaXRfZ2xvYmFsID0gb3AgPT09ICc6PSc7XG4gICAgaWYob3AgPT0gJzo9Jykge1xuICAgICAgb3AgPSAnPSc7XG4gICAgfVxuICAgIHZhciBucyA9IGN1cnJlbnROcygpO1xuICAgIHZhciBsZWZ0ID0gbm9kZS5jaGlsZHJlbi5sZWZ0O1xuICAgIHZhciByaWdodF9jb2RlID0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucmlnaHQpO1xuICAgIGlmKGxlZnQudHlwZSA9PT0gJ1NUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUicpIHtcbiAgICAgIHVucGFja2luZysrO1xuICAgICAgdmFyIHVucGFja19uYW1lID0gJ19fdW5wYWNrJyArIHVucGFja2luZztcbiAgICAgIHN0ciArPSAndmFyICcgKyB1bnBhY2tfbmFtZSArICcgPSAnICsgcmlnaHRfY29kZSArICc7XFxuJytzcCgpO1xuICAgICAgZm9yKGk9MDtpPGxlZnQuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIG4gPSBsZWZ0LmNoaWxkcmVuW2ldLmNoaWxkcmVuWzBdO1xuICAgICAgICBwcmVmaXggPSBcIlwiO1xuICAgICAgICBpZihuLnR5cGUgPT09ICduYW1lJykge1xuICAgICAgICAgIGlmKG5zW24udmFsdWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIG5zW24udmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmKCFleHBsaWNpdF9nbG9iYWwpIHtcbiAgICAgICAgICAgICAgcHJlZml4ID0gJ3ZhciAnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzdHIgKz0gcHJlZml4ICsgZ2VuZXJhdGVDb2RlKG4pICsgJyAnICsgb3AgKyAnICcgKyB1bnBhY2tfbmFtZSArJ1snK2krJ107XFxuJytzcCgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG4gICAgaWYobGVmdC5jaGlsZHJlblswXS50eXBlID09PSAnbmFtZScpIHtcbiAgICAgIHZhciBjaCA9IGxlZnQuY2hpbGRyZW5bMF07XG4gICAgICBpZihuc1tjaC52YWx1ZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZighZXhwbGljaXRfZ2xvYmFsKSB7XG4gICAgICAgICAgcHJlZml4ID0gJ3ZhciAnO1xuICAgICAgICB9XG4gICAgICAgIG5zW2NoLnZhbHVlXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBwcmVmaXggKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5sZWZ0KSArICcgJyArIG9wICsgJyAnICsgcmlnaHRfY29kZTtcbiAgfSxcbiAgJ1NUQVRFTUVOVCc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgZSA9IG5vZGUuY2hpbGRyZW5bMF0uY2hpbGRyZW5bMF07XG4gICAgaWYobm9kZS5jaGlsZHJlblswXS50eXBlID09PSAnRk9SJyB8fCBcbiAgICAgICBub2RlLmNoaWxkcmVuWzBdLnR5cGUgPT09ICdUUllfQ0FUQ0gnIHx8IFxuICAgICAgIG5vZGUuY2hpbGRyZW5bMF0udHlwZSA9PT0gJ1dISUxFJyB8fCBcbiAgICAgICBlICYmIChlLnR5cGUgPT09ICdGVU5DX0RFRicgfHwgZS50eXBlID09PSAnTEFNQkRBJykpIHtcbiAgICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblswXSk7XG4gICAgfVxuICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblswXSkgKyAnOyc7XG4gIH0sXG4gICdJRic6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgc3RyID0gJyc7XG4gICAgc3RyID0gJ2lmKCcrZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZSkgKyAnKXsnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYikgKyAnXFxuJytzcCgpKyd9JztcbiAgICB2YXIgZWxpZiA9IG5vZGUuY2hpbGRyZW4uZWxpZjtcbiAgICBpZihlbGlmKSB7XG4gICAgICBpZihBcnJheS5pc0FycmF5KGVsaWYpKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZWxpZi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoZWxpZltpXSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoZWxpZik7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKG5vZGUuY2hpbGRyZW4uZWwpIHtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lbCk7XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG4gIH0sXG4gICdJRl9FWFBSJzogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBzdHIgPSAnJztcbiAgICBzdHIgPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi50ZXN0KSArICcgPyAnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZSkgKyAnIDogJztcbiAgICBpZihub2RlLmNoaWxkcmVuLmVsKSB7XG4gICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgKz0gJ3VuZGVmaW5lZCc7XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG4gIH0sXG4gICdFTFNFX0VYUFInOiBmdW5jdGlvbihub2RlKSB7XG4gICAgcmV0dXJuIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpO1xuICB9LFxuICAnV0hJTEUnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgcmV0dXJuICd3aGlsZSgnK2dlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpICsgJyl7JyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicrc3AoKSsnfSc7XG4gIH0sXG4gICdGT1InOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIGtleUluZGV4TmFtZSA9IFwiX2luZGV4XCIgKyBmb3JMb29wQ291bnQ7XG4gICAgdmFyIGtleUFycmF5TmFtZSA9IFwiX2tleXNcIiArIGZvckxvb3BDb3VudDtcbiAgICBmb3JMb29wQ291bnQrKztcbiAgICB2YXIgaW5kZXhOYW1lID0gZmFsc2U7XG4gICAgaWYobm9kZS5jaGlsZHJlbi5rKSB7XG4gICAgICBpbmRleE5hbWUgPSBub2RlLmNoaWxkcmVuLmsudmFsdWU7XG4gICAgfVxuICAgIHZhciBzdHIgPSAndmFyICcra2V5QXJyYXlOYW1lKycgPSBPYmplY3Qua2V5cygnK25vZGUuY2hpbGRyZW4uYS52YWx1ZSsnKTtcXG4nO1xuICAgIHN0ciArPSBzcCgpICsgJ2Zvcih2YXIgJytrZXlJbmRleE5hbWUrJyA9IDA7ICcra2V5SW5kZXhOYW1lKycgPCAnK2tleUFycmF5TmFtZSsnLmxlbmd0aDsgJytrZXlJbmRleE5hbWUrJysrICkge1xcbic7XG4gICAgaWYoaW5kZXhOYW1lKSB7XG4gICAgICBzdHIgKz0gc3AoMSkgKyAndmFyICcgKyBpbmRleE5hbWUgKyAnID0gJyArIGtleUFycmF5TmFtZSArJ1snICsga2V5SW5kZXhOYW1lICsgJ107XFxuJztcbiAgICB9XG4gICAgc3RyICs9IHNwKDEpICsgJ3ZhciAnICsgbm9kZS5jaGlsZHJlbi52LnZhbHVlICsgJyA9ICcgKyBub2RlLmNoaWxkcmVuLmEudmFsdWUgKyAnWycgKyBrZXlBcnJheU5hbWUgKydbJyArIGtleUluZGV4TmFtZSArICddXTsnO1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArJ1xcbicrc3AoKSsnfSc7XG4gICAgcmV0dXJuIHN0cjtcbiAgfSxcbiAgJ0VMU0VfSUYnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgcmV0dXJuICcgZWxzZSBpZignK2dlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmUpKycpIHsnK2dlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpKyAnXFxuJytzcCgpKyd9JztcbiAgfSxcbiAgJ0VMU0UnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgcmV0dXJuICcgZWxzZSB7JytnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSsgJ1xcbicrc3AoKSsnfSc7XG4gIH0sXG4gICdUUllfQ0FUQ0gnOiBmdW5jdGlvbihub2RlKSB7XG4gICAgdmFyIHN0ciA9IFwidHJ5IHtcIjtcbiAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYjEpO1xuICAgIHN0ciArPSAnXFxuJytzcCgpK1wifSBjYXRjaChcIitnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lcnIpK1wiKSB7XCI7XG4gICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIyKTtcbiAgICByZXR1cm4gc3RyKydcXG4nK3NwKCkrXCJ9XCI7XG4gIH0sXG4gIC8vJ1JFVFVSTic6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgLy8gIGlmKCFub2RlLmNoaWxkcmVuWzJdKSB7XG4gIC8vICAgIHJldHVybiAncmV0dXJuJztcbiAgLy8gIH1cbiAgLy8gIHJldHVybiAncmV0dXJuICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlblsyXSk7XG4gIC8vfSxcbiAgJ1NUUklDVF9DT01NQV9TRVBBUkFURURfRVhQUic6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgZWxlbWVudHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGVsZW1lbnRzLnB1c2goZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW5baV0pKTtcbiAgICB9XG4gICAgcmV0dXJuICdbJyArIGVsZW1lbnRzLmpvaW4oXCIsIFwiKSArICddJztcbiAgfSxcbiAgJ3N0cmluZyc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICB2YXIgdiA9IG5vZGUudmFsdWU7XG4gICAgdiA9IHYucmVwbGFjZSgvXFxuL2csIFwiXFxcXG5cIik7XG4gICAgdmFyIGFzdCA9IHN0ckdyYW0ucGFyc2Uodik7XG4gICAgaWYoIWFzdC5jb21wbGV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGFzdC5oaW50KTtcbiAgICB9XG4gICAgcmV0dXJuIGdlbmVyYXRlU3RyaW5nQ29kZShhc3QpO1xuICB9LFxuICAnY29tbWVudCc6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICByZXR1cm4gbm9kZS52YWx1ZS5yZXBsYWNlKC9eIy9nLCBcIi8vXCIpO1xuICB9LFxuICAnY29tcGFyaXNvbic6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICBpZihub2RlLnZhbHVlID09ICc9PScpIHtcbiAgICAgIHJldHVybiAnPT09JztcbiAgICB9XG4gICAgaWYobm9kZS52YWx1ZSA9PSAnIT0nKSB7XG4gICAgICByZXR1cm4gJyE9PSc7XG4gICAgfVxuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9XG59O1xuXG5mdW5jdGlvbiBnZW5lcmF0ZUNvZGUobm9kZSkge1xuICBpZighbm9kZSkge1xuICAgIC8vZGVidWdnZXJcbiAgfVxuICBpZihiYWNrZW5kW25vZGUudHlwZV0pIHtcbiAgICByZXR1cm4gYmFja2VuZFtub2RlLnR5cGVdKG5vZGUpO1xuICB9XG4gIGlmKG5vZGUudmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBub2RlLnZhbHVlO1xuICB9XG4gIHZhciBzdHIgPSBcIlwiLCBpO1xuICBpZighbm9kZS5jaGlsZHJlbikge1xuICAgIHJldHVybiAnJztcbiAgfVxuICBmb3IoaT0wO2k8bm9kZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbltpXSk7XG4gIH1cbiAgcmV0dXJuIHN0cjtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVFeHBvcnRzKGtleXMpIHtcbiAgdmFyIHN0ciA9ICdcXG5tb2R1bGUuZXhwb3J0cyA9IHsnO1xuICBrZXlzID0ga2V5cyB8fCBPYmplY3Qua2V5cyhjdXJyZW50TnMoKSk7XG4gIGZvcih2YXIgaT0wOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgIHN0ciArPSAnXFxuICAnICsga2V5c1tpXSArICc6ICcgKyBrZXlzW2ldICsgJywnO1xuICB9XG4gIHJldHVybiBzdHIgKyAnXFxufSc7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlTW9kdWxlKGlucHV0LCBvcHRzKSB7XG4gIHJlc2V0R2xvYmFsKCk7XG4gIHZhciBhc3QgPSBncmFtLnBhcnNlKGlucHV0ICsgXCJcXG5cIik7XG4gIGlmKCFhc3QuY29tcGxldGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYXN0LmhpbnQpO1xuICB9XG4gIHZhciBvYmogPSB7YXN0OmFzdCwgY29kZTpnZW5lcmF0ZUNvZGUoYXN0KSwgbnM6Y3VycmVudE5zKCl9O1xuICByZXR1cm4gb2JqO1xufVxuXG52YXIgZ3JhbSA9IGVwZWdqcy5jb21waWxlR3JhbW1hcihncmFtbWFyRGVmLCB0b2tlbkRlZik7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBncmFtbWFyOiBncmFtLFxuICBzdHJHcmFtbWFyOiBzdHJHcmFtLFxuICBncmFtbWFyRGVmOiBncmFtbWFyRGVmLFxuICBlcGVnanM6ZXBlZ2pzLFxuICB0b2tlbkRlZjogdG9rZW5EZWYsXG4gIGdlbmVyYXRlTW9kdWxlOiBnZW5lcmF0ZU1vZHVsZSxcbiAgZ2VuZXJhdGVDb2RlOiBnZW5lcmF0ZUNvZGUsXG4gIGdlbmVyYXRlRXhwb3J0czogZ2VuZXJhdGVFeHBvcnRzXG59O1xuXG4iXX0=
