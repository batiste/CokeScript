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
    START: {rules: ["LINE* EOF"]}, ELC: {rules: ["W* comment"], verbose: "comment"}, LINE: {rules: ["STATEMENT ELC? samedent+", "STATEMENT ELC? !dedent", 
      "ELC? samedent", "ELC !dedent"], verbose: "new line"}, BLOCK: {rules: ["indent pazz dedent", "indent LINE+ dedent"]}, STATEMENT: {rules: ["ASSIGN", "EXPR", "IF", "WHILE", "FOR", "RETURN", 
        "CLASS", "TAG", "DOM_ASSIGN", "TRY_CATCH", "THROW"]}, CLASS_METHODS: {
          rules: ["samedent* f:FUNC_DEF samedent*"], hooks: [function (p) { return p.f; }]}, CLASS: {
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
                      "n:name colon W e:EXPR samedent? comma ANY_SPACE+ m:MEMBERS ANY_SPACE*",
                      "n:name colon W e:EXPR ANY_SPACE*"
                    ], hooks: [
                      function (p) { return [{name: p.n, value: p.e}].concat(p.m.children); }, function (p) { return [{name: p.n, value: p.e}]; }
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
                              }, LAMBDA: function (node) {
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
                              }, FUNC_DEF: function (node) {
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
                              }, FUNC_DEF_PARAMS: function (node) {
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
                              }, ASSIGN: function (node) {
                                var str, op, explicit_global, ns, left, right_code, unpack_name, i, n, members, name, value, ch;
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
                                    var child = left.children[__keys9[__index9]];
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
                                    var member = members[__keys10[__index10]];
                                    name = generateCode(member.name);
                                    value = generateCode(member.value);
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
                                var str, e, t, other;
                                str = '';
                                var __keys11 = Object.keys(node.children);
                                for(var __index11 = 0; __index11 < __keys11.length; __index11++) {
                                  var child = node.children[__keys11[__index11]];
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
                                var str, elif;
                                str = '';
                                str = 'if(' + generateCode(node.children.e) + ') {' + generateCode(node.children.b) + '\n' + sp() + '}';
                                elif = node.children.elif;
                                if(elif) {
                                  if(Array.isArray(elif)) {
                                    var __keys12 = Object.keys(elif);
                                    for(var __index12 = 0; __index12 < __keys12.length; __index12++) {
                                      var value = elif[__keys12[__index12]];
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
                                
                                str = 'var ' + keyArrayName + ' = Object.keys(' + arrayName + ');\n';
                                str += sp() + 'for(var ' + keyIndexName + ' = 0; ' + keyIndexName + ' < ' + keyArrayName + '.length; ' + keyIndexName + '++) {\n';
                                if(indexName) {
                                  str += sp(1) + 'var ' + indexName + ' = ' + keyArrayName + '[' + keyIndexName + '];\n';
                                }
                                
                                str += sp(1) + 'var ' + varName + ' = ' + arrayName + '[' + keyArrayName + '[' + keyIndexName + ']];';
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
                                var elements;
                                elements = [];
                                var __keys13 = Object.keys(node.children);
                                for(var __index13 = 0; __index13 < __keys13.length; __index13++) {
                                  var child = node.children[__keys13[__index13]];
                                  elements.push(generateCode(child));
                                }
                                return '[' + elements.join(", ") + ']';
                              }, MEMBERS: function (node) {
                                var elements;
                                elements = [];
                                var __keys14 = Object.keys(node.children);
                                for(var __index14 = 0; __index14 < __keys14.length; __index14++) {
                                  var child = node.children[__keys14[__index14]];
                                  elements.push(generateCode(child.name) + ': ' + generateCode(child.value));
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
                                
                                var __keys15 = Object.keys(node.children);
                                for(var __index15 = 0; __index15 < __keys15.length; __index15++) {
                                  var child = node.children[__keys15[__index15]];
                                  str += generateCode(child);
                                }
                                
                                return str;
                              }
                              
                              
                              function generateExports(keys) {
                                var str;
                                str = '\nmodule.exports = {';
                                keys = keys || Object.keys(currentNs());
                                var __keys16 = Object.keys(keys);
                                for(var __index16 = 0; __index16 < __keys16.length; __index16++) {
                                  var key = keys[__keys16[__index16]];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb2tlc2NyaXB0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUQzMkJBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBlcGVnanMsIGRlcHRoLCBmb3JMb29wQ291bnQsIHVucGFja2luZywgbmFtZXNwYWNlcywgbGV2ZWxTdGFjaywgcHJlZml4LCB0b2tlbkRlZiwgc3RySW50ZXJwb2xhdGlvblRva2VuRGVmLCBzdHJJbnRlcnBvbGF0aW9uR3JhbW1hckRlZiwgc3RyR3JhbSwgZ3JhbW1hckRlZiwgbmMsIGJhY2tlbmQsIGdyYW07XG4vLyBDb2tlU2NyaXB0IGxhbmd1YWdlIGJ5IEJhdGlzdGUgQmllbGVyIDIwMTVcbi8vIEltcGxlbWVudGVkIHVzaW5nIEVQRUcuSlNcblxuZXBlZ2pzID0gcmVxdWlyZShcImVwZWdqc1wiKTtcblxuZGVwdGggPSAwO1xuZm9yTG9vcENvdW50ID0gMTtcbnVucGFja2luZyA9IDA7XG5uYW1lc3BhY2VzID0gW3t9XTtcbmxldmVsU3RhY2sgPSBbMF07XG5wcmVmaXggPSAnX18nO1xuXG5mdW5jdGlvbiBjdXJyZW50TnMoKSB7XG4gIHJldHVybiBuYW1lc3BhY2VzW25hbWVzcGFjZXMubGVuZ3RoIC0gMV07XG59XG5cbmZ1bmN0aW9uIGN1cnJlbnROc0hhcyhwKSB7XG4gIHJldHVybiBuYW1lc3BhY2VzW25hbWVzcGFjZXMubGVuZ3RoIC0gMV0uaGFzT3duUHJvcGVydHkocCk7XG59XG5cbmZ1bmN0aW9uIG5ld05zKCkge1xuICBuYW1lc3BhY2VzLnB1c2goe30pO1xuICByZXR1cm4gbmFtZXNwYWNlc1tuYW1lc3BhY2VzLmxlbmd0aCAtIDFdO1xufVxuXG5mdW5jdGlvbiByZXNldEdsb2JhbCgpIHtcbiAgbmFtZXNwYWNlcyA9IFt7fV07XG4gIGZvckxvb3BDb3VudCA9IDE7XG4gIGxldmVsU3RhY2sgPSBbMF07XG4gIGRlcHRoID0gMDtcbiAgdW5wYWNraW5nID0gMDtcbn1cblxuLy8gdG9rZW4gYXJlIG1hdGNoZWQgaW4gb3JkZXIgb2YgZGVjbGFyYXRpb247XG4vLyBUT0RPOiBhZGQgZnVuY3Rpb25zXG5cbnRva2VuRGVmID0gW1xuICB7a2V5OiBcInN0cmluZ1wiLCBmdW5jOiBzdHJpbmdEZWZ9LFxuICB7a2V5OiBcImNvbW1lbnRcIiwgZnVuYzogY29tbWVudERlZn0sXG4gIHtrZXk6IFwiZnVuY3Rpb25fZGVmXCIsIGZ1bmM6IGRlZkRlZiwgdmVyYm9zZTogXCJmdW5jdGlvblwifSxcbiAge2tleTogXCJjbGFzc1wiLCByZWc6IC9eY2xhc3MgL30sXG4gIHtrZXk6IFwicmV0XCIsIHJlZzogL15yZXR1cm4vLCB2ZXJib3NlOiBcInJldHVyblwifSxcbiAge2tleTogXCJpZlwiLCByZWc6IC9eaWYgL30sXG4gIHtrZXk6IFwib3JcIiwgcmVnOiAvXm9yIC99LFxuICB7a2V5OiBcImFuZFwiLCByZWc6IC9eYW5kIC99LFxuICB7a2V5OiBcIndoaWxlXCIsIHJlZzogL153aGlsZSAvfSxcbiAge2tleTogXCJpbnN0YW5jZW9mXCIsIHJlZzogL15pbnN0YW5jZW9mIC99LFxuICB7a2V5OiBcInRyeVwiLCByZWc6IC9edHJ5L30sXG4gIHtrZXk6IFwiY2F0Y2hcIiwgcmVnOiAvXmNhdGNoL30sXG4gIHtrZXk6IFwidGhyb3dcIiwgcmVnOiAvXnRocm93IC99LFxuICB7a2V5OiBcInBhenpcIiwgcmVnOiAvXnBhc3MvLCB2ZXJib3NlOiBcInBhc3NcIn0sXG4gIHtrZXk6IFwibmV3XCIsIHJlZzogL15uZXcgL30sXG4gIHtrZXk6IFwidGFnXCIsIHJlZzogL148W2EtekEtWl1bMC05YS16QS1aXXswLDI5fS99LFxuICB7a2V5OiBcIj5cIiwgcmVnOiAvXj4vfSxcbiAge2tleTogXCJlbHNlaWZcIiwgcmVnOiAvXmVsc2VpZiAvfSxcbiAge2tleTogXCJlbHNlXCIsIHJlZzogL15lbHNlL30sXG4gIHtrZXk6IFwiZm9yX2xvb3BcIiwgcmVnOiAvXmZvciAvLCB2ZXJib3NlOiBcImZvciBsb29wXCJ9LFxuICB7a2V5OiBcImluXCIsIHJlZzogL15pbiAvfSxcbiAge2tleTogXCJub3RcIiwgcmVnOiAvXm5vdCAvLCB2ZXJib3NlOiBcIm5vdFwifSxcbiAge2tleTogXCJuYW1lXCIsIHJlZzogL15bYS16QS1aXyRdWzAtOWEtekEtWl8kXXswLDI5fS99LFxuICB7a2V5OiBcInJlZ2V4cFwiLCBmdW5jOiByZWdFeHBEZWYsIHZlcmJvc2U6IFwicmVndWxhciBleHByZXNzaW9uXCJ9LFxuICB7a2V5OiBcIm1hdGhfb3BlcmF0b3JzXCIsIHJlZzogL14oXFwrXFwrfFxcLVxcLSkvLCB2ZXJib3NlOiBcIm1hdGggb3BlcmF0b3JcIn0sXG4gIHtrZXk6IFwiYmluYXJ5X29wZXJhdG9yc1wiLCByZWc6IC9eKFxcJlxcJnxcXHxcXHx8XFwmfFxcfHw8PHxcXD5cXD4pLywgdmVyYm9zZTogXCJiaW5hcnkgb3BlcmF0b3JcIn0sXG4gIHtrZXk6IFwiY29tcGFyaXNvblwiLCByZWc6IC9eKDw9fD49fDx8PnwhPXw9PSkvfSxcbiAge2tleTogXCJhc3NpZ25cIiwgcmVnOiAvXihcXCs9fC09fD18Oj0pL30sXG4gIHtrZXk6IFwibnVtYmVyXCIsIHJlZzogL15bLV0/WzAtOV0rXFwuP1swLTldKi99LFxuICB7a2V5OiBcImNvbW1hXCIsIHJlZzogL15cXCwvfSxcbiAge2tleTogXCJkb3RcIiwgcmVnOiAvXlxcLi99LFxuICB7a2V5OiBcImNvbG9uXCIsIHJlZzogL15cXDovLCB2ZXJib3NlOiBcIjpcIn0sXG4gIHtrZXk6IFwib3Blbl9wYXJcIiwgcmVnOiAvXlxcKC8sIHZlcmJvc2U6IFwiKFwifSxcbiAge2tleTogXCJjbG9zZV9wYXJcIiwgcmVnOiAvXlxcKS8sIHZlcmJvc2U6IFwiKVwifSxcbiAge2tleTogXCJvcGVuX2JyYVwiLCByZWc6IC9eXFxbLywgdmVyYm9zZTogXCJbXCJ9LFxuICB7a2V5OiBcImNsb3NlX2JyYVwiLCByZWc6IC9eXFxdLywgdmVyYm9zZTogXCJdXCJ9LFxuICB7a2V5OiBcIm9wZW5fY3VybHlcIiwgcmVnOiAvXlxcey8sIHZlcmJvc2U6IFwie1wifSxcbiAge2tleTogXCJjbG9zZV9jdXJseVwiLCByZWc6IC9eXFx9LywgdmVyYm9zZTogXCJ9XCJ9LFxuICB7a2V5OiBcIm1hdGhcIiwgcmVnOiAvXlstfFxcK3xcXCp8XFwvfCVdL30sXG4gIHtrZXk6IFwic2FtZWRlbnRcIiwgZnVuYzogZGVudChcInNhbWVkZW50XCIpLCB2ZXJib3NlOiBcInNhbWUgaW5kZW50YXRpb25cIn0sXG4gIHtrZXk6IFwiZGVkZW50XCIsIGZ1bmM6IGRlbnQoXCJkZWRlbnRcIil9LFxuICB7a2V5OiBcImluZGVudFwiLCBmdW5jOiBkZW50KFwiaW5kZW50XCIpfSxcbiAge2tleTogXCJXXCIsIHJlZzogL15bIF0vLCB2ZXJib3NlOiBcInNpbmdsZSB3aGl0ZXNwYWNlXCJ9XG5dO1xuXG5mdW5jdGlvbiBzdGFydFN0cihpbnB1dCxzdHJlYW0pIHtcbiAgdmFyIGxhc3Q7XG4gIGxhc3QgPSBzdHJlYW1bc3RyZWFtLmxlbmd0aCAtIDFdO1xuICBpZihsYXN0ICYmIGxhc3QudmFsdWUgPT09IFwiXFxcXFwiKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmKGlucHV0Lm1hdGNoKC9eI3svKSkge1xuICAgIHJldHVybiBcIiN7XCI7XG4gIH1cbn1cblxuc3RySW50ZXJwb2xhdGlvblRva2VuRGVmID0gW1xuICB7a2V5OiBcInN0YXJ0XCIsIGZ1bmM6IHN0YXJ0U3RyfSxcbiAge2tleTogXCJlbmRcIiwgcmVnOiAvXn0vfSxcbiAge2tleTogXCJuYW1lXCIsIHJlZzogL15bYS16QS1aXyRdWzAtOWEtekEtWl9dezAsMjl9L30sXG4gIHtrZXk6IFwiZG90XCIsIHJlZzogL15cXC4vfSxcbiAge2tleTogXCJjaGFyXCIsIHJlZzogL14uL31cbl07XG5cbnN0ckludGVycG9sYXRpb25HcmFtbWFyRGVmID0ge1xuICBTVEFSVDoge3J1bGVzOiBbXCJFTCogRU9GXCJdfSwgRUw6IHtydWxlczogW1wiVkFSXCIsIFwiY2hhclwiLCBcIm5hbWVcIiwgXCJzdGFydFwiLCBcImVuZFwiLCBcImRvdFwiXX0sIFZBUjoge3J1bGVzOiBbXCJzdGFydCBOQU1FIGVuZFwiXX0sIE5BTUU6IHtydWxlczogW1wibmFtZSBkb3QgTkFNRVwiLCBcIm5hbWVcIl19fTtcbiAgXG4gIHN0ckdyYW0gPSBlcGVnanMuY29tcGlsZUdyYW1tYXIoc3RySW50ZXJwb2xhdGlvbkdyYW1tYXJEZWYsIHN0ckludGVycG9sYXRpb25Ub2tlbkRlZik7XG4gIFxuICBmdW5jdGlvbiBnZW5lcmF0ZVN0cmluZ0NvZGUobm9kZSxjKSB7XG4gICAgdmFyIHN0cjtcbiAgICBpZihub2RlLnR5cGUgPT09ICdWQVInKSB7XG4gICAgICByZXR1cm4gYyArICcgKyAnICsgZ2VuZXJhdGVTdHJpbmdDb2RlKG5vZGUuY2hpbGRyZW5bMV0sIGMpICsgJyArICcgKyBjO1xuICAgIH1cbiAgICBcbiAgICBpZihub2RlLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBub2RlLnZhbHVlO1xuICAgIH1cbiAgICBcbiAgICBzdHIgPSAnJztcbiAgICBpZighbm9kZS5jaGlsZHJlbikge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgICBcbiAgICB2YXIgX19rZXlzMSA9IE9iamVjdC5rZXlzKG5vZGUuY2hpbGRyZW4pO1xuICAgIGZvcih2YXIgX19pbmRleDEgPSAwOyBfX2luZGV4MSA8IF9fa2V5czEubGVuZ3RoOyBfX2luZGV4MSsrKSB7XG4gICAgICB2YXIgY2hpbGQgPSBub2RlLmNoaWxkcmVuW19fa2V5czFbX19pbmRleDFdXTtcbiAgICAgIHN0ciArPSBnZW5lcmF0ZVN0cmluZ0NvZGUoY2hpbGQsIGMpO1xuICAgIH1cbiAgICByZXR1cm4gc3RyO1xuICB9XG4gIFxuICBmdW5jdGlvbiBjdXJyZW50TGV2ZWwoKSB7XG4gICAgcmV0dXJuIGxldmVsU3RhY2tbbGV2ZWxTdGFjay5sZW5ndGggLSAxXTtcbiAgfVxuICBcbiAgZnVuY3Rpb24gaW5kZW50VHlwZShsKSB7XG4gICAgaWYobCA+IGN1cnJlbnRMZXZlbCgpKSB7XG4gICAgICByZXR1cm4gJ2luZGVudCc7XG4gICAgfVxuICAgIFxuICAgIGlmKGwgPCBjdXJyZW50TGV2ZWwoKSkge1xuICAgICAgcmV0dXJuICdkZWRlbnQnO1xuICAgIH1cbiAgICBcbiAgICBpZihsID09PSBjdXJyZW50TGV2ZWwoKSkge1xuICAgICAgcmV0dXJuICdzYW1lZGVudCc7XG4gICAgfVxuICB9XG4gIFxuICBmdW5jdGlvbiBkZW50KGRlbnRUeXBlKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIF9kZW50KGlucHV0KSB7XG4gICAgICB2YXIgbSwgbGluZXMsIGluZGVudDtcbiAgICAgIC8vIGVtcHR5IGxpbmUgaXMgYSBzYW1lZGVudFxuICAgICAgbSA9IGlucHV0Lm1hdGNoKC9eXFxuW1xcc10qLyk7XG4gICAgICBpZihtKSB7XG4gICAgICAgIGxpbmVzID0gbVswXS5zcGxpdChcIlxcblwiKTtcbiAgICAgICAgaW5kZW50ID0gbGluZXNbbGluZXMubGVuZ3RoIC0gMV0ubGVuZ3RoO1xuICAgICAgICBpZihpbmRlbnRUeXBlKGluZGVudCkgPT09IGRlbnRUeXBlKSB7XG4gICAgICAgICAgaWYoZGVudFR5cGUgPT09ICdkZWRlbnQnKSB7XG4gICAgICAgICAgICBsZXZlbFN0YWNrLnBvcCgpO1xuICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBpZihkZW50VHlwZSA9PT0gJ2luZGVudCcpIHtcbiAgICAgICAgICAgIGxldmVsU3RhY2sucHVzaChpbmRlbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4gbVswXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gIH1cbiAgXG4gIGZ1bmN0aW9uIHN0cmluZ0RlZihpbnB1dCkge1xuICAgIHZhciBmaXJzdCwgaSwgY2g7XG4gICAgZmlyc3QgPSBpbnB1dC5jaGFyQXQoMCk7XG4gICAgaWYoZmlyc3QgPT09ICdcIicgfHwgZmlyc3QgPT09IFwiJ1wiKSB7XG4gICAgICBpID0gMTtcbiAgICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSl7XG4gICAgICAgIGNoID0gaW5wdXQuY2hhckF0KGkpO1xuICAgICAgICBpZihjaCA9PT0gJ1xcXFwnKSB7XG4gICAgICAgICAgaSsrO1xuICAgICAgICB9IGVsc2UgaWYoY2ggPT09IGZpcnN0KSB7XG4gICAgICAgICAgcmV0dXJuIGlucHV0LnNsaWNlKDAsIGkgKyAxKTtcbiAgICAgICAgfVxuICAgICAgICBpKys7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIFxuICBmdW5jdGlvbiByZWdFeHBEZWYoaW5wdXQpIHtcbiAgICB2YXIgaSwgY2g7XG4gICAgaWYoaW5wdXQuY2hhckF0KDApID09PSAnLycpIHtcbiAgICAgIGkgPSAxO1xuICAgICAgd2hpbGUoaW5wdXQuY2hhckF0KGkpKXtcbiAgICAgICAgY2ggPSBpbnB1dC5jaGFyQXQoaSk7XG4gICAgICAgIGlmKGNoID09PSAnXFxcXCcpIHtcbiAgICAgICAgICBpKys7XG4gICAgICAgIH0gZWxzZSBpZihjaCA9PT0gJy8nKSB7XG4gICAgICAgICAgaSsrO1xuICAgICAgICAgIC8vIG1vZGlmaWVyc1xuICAgICAgICAgIHdoaWxlKGlucHV0LmNoYXJBdChpKSAmJiBcImlnbVwiLmluZGV4T2YoaW5wdXQuY2hhckF0KGkpKSAhPT0gLTEpe1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gaW5wdXQuc2xpY2UoMCwgaSk7XG4gICAgICAgIH1cbiAgICAgICAgaSsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBcbiAgZnVuY3Rpb24gZGVmRGVmKGlucHV0KSB7XG4gICAgaWYoaW5wdXQubWF0Y2goL15kZWZbXFwofCB8XFxuXS8pKSB7XG4gICAgICByZXR1cm4gXCJkZWZcIjtcbiAgICB9XG4gICAgXG4gICAgaWYoaW5wdXQuaW5kZXhPZihcImRvbSBcIikgPT09IDApIHtcbiAgICAgIHJldHVybiBcImRvbVwiO1xuICAgIH1cbiAgfVxuICBcbiAgZnVuY3Rpb24gY29tbWVudERlZihpbnB1dCkge1xuICAgIHZhciBtLCBpLCBjaDtcbiAgICBtID0gaW5wdXQubWF0Y2goL14jLyk7XG4gICAgaWYobSkge1xuICAgICAgaSA9IG1bMF0ubGVuZ3RoO1xuICAgICAgd2hpbGUoaW5wdXQuY2hhckF0KGkpKXtcbiAgICAgICAgY2ggPSBpbnB1dC5jaGFyQXQoaSk7XG4gICAgICAgIGlmKGNoID09PSAnXFxuJykge1xuICAgICAgICAgIHJldHVybiBpbnB1dC5zbGljZSgwLCBpKTtcbiAgICAgICAgfVxuICAgICAgICBpKys7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIFxuICBmdW5jdGlvbiByZWZsZWN0KHBhcmFtcykgeyByZXR1cm4gcGFyYW1zOyB9XG4gIFxuICBncmFtbWFyRGVmID0ge1xuICAgIFNUQVJUOiB7cnVsZXM6IFtcIkxJTkUqIEVPRlwiXX0sIEVMQzoge3J1bGVzOiBbXCJXKiBjb21tZW50XCJdLCB2ZXJib3NlOiBcImNvbW1lbnRcIn0sIExJTkU6IHtydWxlczogW1wiU1RBVEVNRU5UIEVMQz8gc2FtZWRlbnQrXCIsIFwiU1RBVEVNRU5UIEVMQz8gIWRlZGVudFwiLCBcbiAgICAgIFwiRUxDPyBzYW1lZGVudFwiLCBcIkVMQyAhZGVkZW50XCJdLCB2ZXJib3NlOiBcIm5ldyBsaW5lXCJ9LCBCTE9DSzoge3J1bGVzOiBbXCJpbmRlbnQgcGF6eiBkZWRlbnRcIiwgXCJpbmRlbnQgTElORSsgZGVkZW50XCJdfSwgU1RBVEVNRU5UOiB7cnVsZXM6IFtcIkFTU0lHTlwiLCBcIkVYUFJcIiwgXCJJRlwiLCBcIldISUxFXCIsIFwiRk9SXCIsIFwiUkVUVVJOXCIsIFxuICAgICAgICBcIkNMQVNTXCIsIFwiVEFHXCIsIFwiRE9NX0FTU0lHTlwiLCBcIlRSWV9DQVRDSFwiLCBcIlRIUk9XXCJdfSwgQ0xBU1NfTUVUSE9EUzoge1xuICAgICAgICAgIHJ1bGVzOiBbXCJzYW1lZGVudCogZjpGVU5DX0RFRiBzYW1lZGVudCpcIl0sIGhvb2tzOiBbZnVuY3Rpb24gKHApIHsgcmV0dXJuIHAuZjsgfV19LCBDTEFTUzoge1xuICAgICAgICAgICAgcnVsZXM6IFtcbiAgICAgICAgICAgICAgXCJjbGFzcyBuOm5hbWUgb3Blbl9wYXIgcDpuYW1lIGNsb3NlX3BhciBpbmRlbnQgbTpDTEFTU19NRVRIT0RTKyBkZWRlbnRcIixcbiAgICAgICAgICAgICAgXCJjbGFzcyBuOm5hbWUgaW5kZW50IG06Q0xBU1NfTUVUSE9EUysgZGVkZW50XCJcbiAgICAgICAgICAgIF0sIGhvb2tzOiBbXG4gICAgICAgICAgICAgIGZ1bmN0aW9uIChwKSB7IHJldHVybiB7bmFtZTogcC5uLCBtZXRob2RzOiBwLm0sIHBhcmVudDogcC5wfTsgfSxcbiAgICAgICAgICAgICAgZnVuY3Rpb24gKHApIHsgcmV0dXJuIHtuYW1lOiBwLm4sIG1ldGhvZHM6IHAubX07IH1cbiAgICAgICAgICAgIF19LCBGVU5DX0RFRl9QQVJBTVM6IHtydWxlczogW1xuICAgICAgICAgICAgICBcInAxOkZVTkNfREVGX1BBUkFNUyBjb21tYSBXIHAyOkZVTkNfREVGX1BBUkFNU1wiLFxuICAgICAgICAgICAgICBcInAxOm5hbWUgYXNzaWduIGU6RVhQUlwiLFxuICAgICAgICAgICAgICBcInAxOm5hbWVcIlxuICAgICAgICAgICAgICBdLCB2ZXJib3NlOiBcImRlZiBwYXJhbWV0ZXJzXCJ9LCBMQU1CREE6IHtydWxlczogW1xuICAgICAgICAgICAgICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIG9wZW5fcGFyIHBhcmFtczpGVU5DX0RFRl9QQVJBTVM/IGNsb3NlX3BhciBXIGJsb2NrOkVYUFJcIixcbiAgICAgICAgICAgICAgICBcImZkOmZ1bmN0aW9uX2RlZiBXIGZuOm5hbWUgb3Blbl9wYXIgcGFyYW1zOkZVTkNfREVGX1BBUkFNUz8gY2xvc2VfcGFyIFcgYmxvY2s6RVhQUlwiLFxuICAgICAgICAgICAgICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgYmxvY2s6RVhQUlwiXG4gICAgICAgICAgICAgICAgXSwgaG9va3M6IHJlZmxlY3R9LCBGVU5DX0RFRjoge3J1bGVzOiBbXG4gICAgICAgICAgICAgICAgICBcImZkOmZ1bmN0aW9uX2RlZiBvcGVuX3BhciBwYXJhbXM6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgYmxvY2s6QkxPQ0tcIixcbiAgICAgICAgICAgICAgICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBvcGVuX3BhciBwYXJhbXM6RlVOQ19ERUZfUEFSQU1TPyBjbG9zZV9wYXIgYmxvY2s6QkxPQ0tcIixcbiAgICAgICAgICAgICAgICAgIFwiZmQ6ZnVuY3Rpb25fZGVmIFcgZm46bmFtZSBibG9jazpCTE9DS1wiLFxuICAgICAgICAgICAgICAgICAgXCJmZDpmdW5jdGlvbl9kZWYgYmxvY2s6QkxPQ0tcIlxuICAgICAgICAgICAgICAgICAgXSwgaG9va3M6IHJlZmxlY3QsIHZlcmJvc2U6IFwiZGVmIGRlZmluaXRpb25cIn0sIEVMU0VfSUY6IHtydWxlczogW1wic2FtZWRlbnQgZWxzZWlmIGU6RVhQUiBiOkJMT0NLXCJdLCBob29rczogcmVmbGVjdH0sIEVMU0U6IHtydWxlczogW1wic2FtZWRlbnQgZWxzZSBiOkJMT0NLXCJdLCBob29rczogcmVmbGVjdH0sIElGOiB7cnVsZXM6IFtcImlmIGU6RVhQUiBiOkJMT0NLIGVsaWY6RUxTRV9JRiogZWw6RUxTRT9cIl0sIGhvb2tzOiByZWZsZWN0fSwgRUxTRV9FWFBSOiB7cnVsZXM6IFtcIlcgZWxzZSBXIGI6RVhQUlwiXSwgaG9va3M6IHJlZmxlY3R9LCBJRl9FWFBSOiB7cnVsZXM6IFtcImU6RVhQUiBXIGlmIHRlc3Q6RVhQUiBlbDpFTFNFX0VYUFI/XCJdLCBob29rczogcmVmbGVjdH0sIFdISUxFOiB7cnVsZXM6IFtcIndoaWxlIGU6RVhQUiBiOkJMT0NLXCJdLCBob29rczogcmVmbGVjdH0sIE1BVEg6IHtydWxlczogW1wiZTE6RVhQUiBXIG9wOm1hdGggVyBlMjpFWFBSXCJdfSwgUEFUSDoge3J1bGVzOiBbXCJQQVRIIGRvdCBuYW1lXCIsIFwiUEFUSCBvcGVuX2JyYSBudW1iZXIgY2xvc2VfYnJhXCIsIFwibmFtZVwiXX0sIEFTU0lHTjoge3J1bGVzOiBbXG4gICAgICAgICAgICAgICAgICAgIFwibGVmdDpPQkpFQ1QgVyBvcDphc3NpZ24gVyByaWdodDpFWFBSXCIsXG4gICAgICAgICAgICAgICAgICAgIFwibGVmdDpFWFBSIFcgb3A6YXNzaWduIFcgcmlnaHQ6RVhQUlwiLFxuICAgICAgICAgICAgICAgICAgICBcImxlZnQ6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSIFcgb3A6YXNzaWduIFcgcmlnaHQ6U1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSXCIsXG4gICAgICAgICAgICAgICAgICAgIFwibGVmdDpTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFIgVyBvcDphc3NpZ24gVyByaWdodDpFWFBSXCJcbiAgICAgICAgICAgICAgICAgIF0sIGhvb2tzOiByZWZsZWN0fSwgV19PUl9TQU1FREVOVDoge3J1bGVzOiBbXCJXXCIsIFwic2FtZWRlbnRcIl0sIHZlcmJvc2U6IFwic2FtZWRlbnQgb3Igd2hpdGVzcGFjZVwifSwgV19TQU1FREVOVF9JTkRFTlQ6IHtydWxlczogW1wiV1wiLCBcInNhbWVkZW50XCIsIFwiaW5kZW50XCJdLCB2ZXJib3NlOiBcImluZGVudCBvciBzYW1lZGVudCBvciB3aGl0ZXNwYWNlXCJ9LCBBTllfU1BBQ0U6IHtydWxlczogW1wiV1wiLCBcInNhbWVkZW50XCIsIFwiaW5kZW50XCIsIFwiZGVkZW50XCIsIFwiY29tbWVudFwiXSwgdmVyYm9zZTogXCJhbnkgc3BhY2VcIn0sIEZVTkNfQ0FMTF9QQVJBTVM6IHtydWxlczogW1wiRVhQUiBjb21tYSBBTllfU1BBQ0UrIEZVTkNfQ0FMTF9QQVJBTVMgQU5ZX1NQQUNFKlwiLCBcIkVYUFIgQU5ZX1NQQUNFKlwiXX0sIEZVTkNfQ0FMTDoge3J1bGVzOiBbXG4gICAgICAgICAgICAgICAgICAgIFwib3Blbl9wYXIgRlVOQ19DQUxMX1BBUkFNUz8gY2xvc2VfcGFyXCJcbiAgICAgICAgICAgICAgICAgIF19LCBUWVBFOiB7cnVsZXM6IFtcIm5hbWUgY29sb25cIl19LCBGT1I6IHtydWxlczogW1xuICAgICAgICAgICAgICAgICAgICBcImZvcl9sb29wIGs6bmFtZSBjb21tYSBXIHY6bmFtZSBXIGluIGE6RVhQUiBiOkJMT0NLXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiZm9yX2xvb3AgdjpuYW1lIFcgaW4gYTpFWFBSIGI6QkxPQ0tcIl0sIGhvb2tzOiByZWZsZWN0fSwgU1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSOiB7cnVsZXM6IFtcbiAgICAgICAgICAgICAgICAgICAgICBcImUxOkVYUFIgY29tbWEgVyBlMjpTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFJcIixcbiAgICAgICAgICAgICAgICAgICAgICBcImUxOkVYUFIgY29tbWEgVyBlMjpFWFBSXCJcbiAgICAgICAgICAgICAgICAgICAgXSwgaG9va3M6IFtcbiAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiAocCkgeyByZXR1cm4gW3AuZTFdLmNvbmNhdChwLmUyLmNoaWxkcmVuKTsgfSwgZnVuY3Rpb24gKHApIHsgcmV0dXJuIFtwLmUxLCBwLmUyXTsgfVxuICAgICAgICAgICAgICAgICAgICBdfSwgQ09NTUFfU0VQQVJBVEVEX0VYUFI6IHtydWxlczogW1xuICAgICAgICAgICAgICAgICAgICAgIFwiRVhQUiBjb21tYSBBTllfU1BBQ0UrIENPTU1BX1NFUEFSQVRFRF9FWFBSIEFOWV9TUEFDRSpcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIkVYUFIgQU5ZX1NQQUNFKlwiXG4gICAgICAgICAgICAgICAgICAgIF19LCBBUlJBWToge3J1bGVzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgXCJvcGVuX2JyYSBBTllfU1BBQ0UqIGM6Q09NTUFfU0VQQVJBVEVEX0VYUFI/IEFOWV9TUEFDRSogY2xvc2VfYnJhXCJcbiAgICAgICAgICAgICAgICAgICAgXX0sIE1FTUJFUlM6IHtydWxlczogW1xuICAgICAgICAgICAgICAgICAgICAgIFwibjpuYW1lIGNvbG9uIFcgZTpFWFBSIHNhbWVkZW50PyBjb21tYSBBTllfU1BBQ0UrIG06TUVNQkVSUyBBTllfU1BBQ0UqXCIsXG4gICAgICAgICAgICAgICAgICAgICAgXCJuOm5hbWUgY29sb24gVyBlOkVYUFIgQU5ZX1NQQUNFKlwiXG4gICAgICAgICAgICAgICAgICAgIF0sIGhvb2tzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKHApIHsgcmV0dXJuIFt7bmFtZTogcC5uLCB2YWx1ZTogcC5lfV0uY29uY2F0KHAubS5jaGlsZHJlbik7IH0sIGZ1bmN0aW9uIChwKSB7IHJldHVybiBbe25hbWU6IHAubiwgdmFsdWU6IHAuZX1dOyB9XG4gICAgICAgICAgICAgICAgICAgIF19LCBPQkpFQ1Q6IHtydWxlczogW1xuICAgICAgICAgICAgICAgICAgICAgIFwib3Blbl9jdXJseSBpbmRlbnQ/IE1FTUJFUlM/IGNsb3NlX2N1cmx5XCJcbiAgICAgICAgICAgICAgICAgICAgXX0sIFRBR19QQVJBTVM6IHtydWxlczogW1xuICAgICAgICAgICAgICAgICAgICAgIFwibGVmdDpUQUdfUEFSQU1TIFcgcmlnaHQ6VEFHX1BBUkFNU1wiLFxuICAgICAgICAgICAgICAgICAgICAgIFwibjpuYW1lIGFzc2lnbiBlOkVYUFJcIixcbiAgICAgICAgICAgICAgICAgICAgICBcIm46bmFtZVwiXG4gICAgICAgICAgICAgICAgICAgICAgXSwgaG9va3M6IHJlZmxlY3QsIHZlcmJvc2U6IFwidGFnIHBhcmFtZXRlcnNcIn0sIFRBRzoge3J1bGVzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICBcInRhZzp0YWcgVz8gcGFyYW1zOlRBR19QQVJBTVM/IGVuZDo+PyBibG9jazpCTE9DSz9cIlxuICAgICAgICAgICAgICAgICAgICAgIF0sIGhvb2tzOiByZWZsZWN0fSwgRE9NX0FTU0lHTjoge3J1bGVzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICBcImFzc2lnbiBFWFBSXCJcbiAgICAgICAgICAgICAgICAgICAgICBdfSwgVFJZX0NBVENIOiB7cnVsZXM6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidHJ5IGIxOkJMT0NLIHNhbWVkZW50PyBjYXRjaCBvcGVuX3BhciBlcnI6bmFtZT8gY2xvc2VfcGFyIGIyOkJMT0NLXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIF0sIGhvb2tzOiByZWZsZWN0fSwgVEhST1c6IHtydWxlczogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICBcInRocm93IEVYUFJcIlxuICAgICAgICAgICAgICAgICAgICAgICAgXX0sIFJFVFVSTjoge3J1bGVzOiBbXCJyZXQgVyBTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFJcIiwgXCJyZXQgVyBFWFBSXCIsIFwicmV0XCJdfSwgUklHSFRfRVhQUjoge3J1bGVzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFwibWF0aF9vcGVyYXRvcnNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXCJXIGJpbmFyeV9vcGVyYXRvcnMgVyBFWFBSXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFwiVyBvciBFWFBSXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFwiVyBhbmQgRVhQUlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBcIlcgY29tcGFyaXNvbiBXIEVYUFJcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXCJXID4gVyBFWFBSXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFwiZG90IEVYUFJcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXCJXIGluc3RhbmNlb2YgRVhQUlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBcIm9wZW5fYnJhIEVYUFIgY2xvc2VfYnJhXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFwiRlVOQ19DQUxMXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXSwgdmVyYm9zZTogXCJleHByZXNzaW9uXCJ9LCBFWFBSOiB7cnVsZXM6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIklGX0VYUFJcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIk1BVEhcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIk9CSkVDVFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiRlVOQ19ERUZcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkVYUFIgUklHSFRfRVhQUlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwibmFtZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwibnVtYmVyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJMQU1CREFcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcInN0cmluZ1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwicmVnZXhwXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJvcGVuX3BhciBFWFBSIGNsb3NlX3BhclwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwibmV3IEVYUFJcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm5vdCBFWFBSXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJBUlJBWVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXSwgdmVyYm9zZTogXCJleHByZXNzaW9uXCJ9fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBzcGFjZXIobikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG91dCwgaTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG91dCA9IFwiXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdoaWxlKGkgPCBuKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0ICs9IFwiIFwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpKys7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gb3V0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBzcChtb2QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKG1vZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3BhY2VyKDIgKiAoZGVwdGggKyBtb2QpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzcGFjZXIoMiAqIGRlcHRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmMgPSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNoaWxkcmVuIG5hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBDTigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVmaXggKyAnYycgKyBuYztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gcHVzaENOKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmMrKztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmVmaXggKyAnYycgKyBuYztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gcG9wQ04oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYy0tO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWZpeCArICdjJyArIG5jO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBnZW5lcmF0ZUhvaXN0ZWRWYXIoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbnMsIGhvaXN0ZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBucyA9IGN1cnJlbnROcygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaG9pc3RlZCA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIF9fa2V5czIgPSBPYmplY3Qua2V5cyhucyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IodmFyIF9faW5kZXgyID0gMDsgX19pbmRleDIgPCBfX2tleXMyLmxlbmd0aDsgX19pbmRleDIrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIga2V5ID0gX19rZXlzMltfX2luZGV4Ml07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IG5zW19fa2V5czJbX19pbmRleDJdXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYodmFsdWUgPT09ICdob2lzdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBob2lzdGVkLnB1c2goa2V5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoaG9pc3RlZC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICd2YXIgJyArIGhvaXN0ZWQuam9pbignLCAnKSArICc7JztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gaG9pc3RWYXIobmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5zO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnMgPSBjdXJyZW50TnMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5zW25hbWVdID0gJ2hvaXN0JztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmFja2VuZCA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFNUQVJUOiBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3RyLCBob2lzdGVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgPSAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIF9fa2V5czMgPSBPYmplY3Qua2V5cyhub2RlLmNoaWxkcmVuKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yKHZhciBfX2luZGV4MyA9IDA7IF9faW5kZXgzIDwgX19rZXlzMy5sZW5ndGg7IF9faW5kZXgzKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2hpbGQgPSBub2RlLmNoaWxkcmVuW19fa2V5czNbX19pbmRleDNdXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKGNoaWxkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBob2lzdGVkID0gZ2VuZXJhdGVIb2lzdGVkVmFyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGhvaXN0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2VuZXJhdGVIb2lzdGVkVmFyKCkgKyAnXFxuJyArIHN0cjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3RyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgZGVkZW50OiBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXB0aCA9IE1hdGgubWF4KDAsIGRlcHRoIC0gMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGluZGVudDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVwdGggPSBkZXB0aCArIDE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnXFxuJyArIHNwKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBzYW1lZGVudDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGwsIGksIHN0cjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbCA9IG5vZGUudmFsdWUuc3BsaXQoJ1xcbicpLmxlbmd0aCAtIDE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGkgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgPSAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUoaSA8IGwpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ciArPSAnXFxuJyArIHNwKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzdHI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBET01fQVNTSUdOOiBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmFtZSwgdmFybmFtZSwgc3RyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lID0gQ04oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFybmFtZSA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuWzFdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaG9pc3RWYXIoQ04oKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhvaXN0VmFyKCcnICsgcHJlZml4ICsgJ3RtcCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgPSAnJyArIHByZWZpeCArICd0bXAgPSAnICsgdmFybmFtZSArICc7ICcgKyBwcmVmaXggKyAndG1wIGluc3RhbmNlb2YgQXJyYXkgPyAoJyArIG5hbWUgKyAnID0gJyArIG5hbWUgKyAnLmNvbmNhdCgnICsgcHJlZml4ICsgJ3RtcCkpIDogJyArIG5hbWUgKyAnLnB1c2goU3RyaW5nKCcgKyBwcmVmaXggKyAndG1wKSknO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3RyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgVEFHX1BBUkFNUzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKG5vZGUuY2hpbGRyZW4ubGVmdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5sZWZ0KSArICcsICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5yaWdodCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUgPSBub2RlLmNoaWxkcmVuLm4udmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihub2RlLmNoaWxkcmVuLmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmFtZSArICc6ICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmFtZSArICc6IHRydWUnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBUQUc6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzdHIsIHBhcmFtcywgbmFtZSwgc3ViLCBucztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyID0gJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtcyA9IFwie1wiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lID0gbm9kZS5jaGlsZHJlbi50YWcudmFsdWUuc3Vic3RyaW5nKDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihub2RlLmNoaWxkcmVuLnBhcmFtcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtcyArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJhbXMgKz0gJ30nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWIgPSAnW10nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBucyA9IGN1cnJlbnROcygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYobm9kZS5jaGlsZHJlbi5ibG9jaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1YiA9IHB1c2hDTigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ciArPSBDTigpICsgJyA9IFtdOyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaG9pc3RWYXIoQ04oKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3BDTigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgKz0gJ1xcbicgKyBzcCgpICsgQ04oKSArICcucHVzaCh2aXJ0dWFsRG9tLmgoXCInICsgbmFtZSArICdcIiwge2F0dHJpYnV0ZXM6ICcgKyBwYXJhbXMgKyAnfSwgJyArIHN1YiArICcpKSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzdHI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBDTEFTUzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5hbWUsIGZ1bmNzLCBwYXJlbnQsIHN0ciwgY29uc3RydWN0b3IsIGZ1bmNfZGVmLCBmdW5jX25hbWUsIG5zLCBwYXJhbXMsIGJvZHksIGNvbnNfc3RyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lID0gbm9kZS5jaGlsZHJlbi5uYW1lLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jcyA9IG5vZGUuY2hpbGRyZW4ubWV0aG9kcztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50ID0gbm9kZS5jaGlsZHJlbi5wYXJlbnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ciA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdHJ1Y3RvciA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBfX2tleXM0ID0gT2JqZWN0LmtleXMoZnVuY3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IodmFyIF9faW5kZXg0ID0gMDsgX19pbmRleDQgPCBfX2tleXM0Lmxlbmd0aDsgX19pbmRleDQrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBmdW5jID0gZnVuY3NbX19rZXlzNFtfX2luZGV4NF1dO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmNfZGVmID0gZnVuYy5jaGlsZHJlbjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jX25hbWUgPSBmdW5jX2RlZi5jaGlsZHJlbi5mbi52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihmdW5jX25hbWUgPT09ICdjb25zdHJ1Y3RvcicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0cnVjdG9yID0gZnVuY19kZWY7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ciArPSAnXFxuJyArIHNwKCkgKyBuYW1lICsgJy5wcm90b3R5cGUuJyArIGZ1bmNfbmFtZSArICcgPSAnICsgZ2VuZXJhdGVDb2RlKGZ1bmNfZGVmKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhvaXN0VmFyKG5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBucyA9IG5ld05zKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJhbXMgPSBjb25zdHJ1Y3RvciAmJiBjb25zdHJ1Y3Rvci5jaGlsZHJlbi5wYXJhbXM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHBhcmFtcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtcyA9IGdlbmVyYXRlQ29kZShwYXJhbXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtcyA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBib2R5ID0gY29uc3RydWN0b3IgJiYgY29uc3RydWN0b3IuY2hpbGRyZW4uYmxvY2s7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNfc3RyID0gJycgKyBuYW1lICsgJyA9IGZ1bmN0aW9uICcgKyBuYW1lICsgJyAoICcgKyBwYXJhbXMgKyAnICkgeyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNfc3RyICs9ICdcXG4nICsgc3AoMSkgKyAnaWYoISh0aGlzIGluc3RhbmNlb2YgJyArIG5hbWUgKyAnKSl7IHJldHVybiBuZXcgJyArIG5hbWUgKyAnKCcgKyBPYmplY3Qua2V5cyhucykuam9pbignLCcpICsgJyl9JztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIF9fa2V5czUgPSBPYmplY3Qua2V5cyhucyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvcih2YXIgX19pbmRleDUgPSAwOyBfX2luZGV4NSA8IF9fa2V5czUubGVuZ3RoOyBfX2luZGV4NSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGtleSA9IF9fa2V5czVbX19pbmRleDVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IG5zW19fa2V5czVbX19pbmRleDVdXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZih2YWx1ZSAhPT0gdHJ1ZSAmJiB2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zX3N0ciArPSAnXFxuJyArIHNwKDEpICsgJ2lmKCcgKyBrZXkgKyAnID09PSB1bmRlZmluZWQpIHsnICsga2V5ICsgJyA9ICcgKyBnZW5lcmF0ZUNvZGUodmFsdWUpICsgJ30nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihib2R5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc19zdHIgKz0gZ2VuZXJhdGVDb2RlKGJvZHkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNfc3RyICs9IHNwKCkgKyAnXFxufSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zX3N0ciArPSAnXFxuJyArIHNwKCkgKyAnJyArIG5hbWUgKyAnLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoJyArIHBhcmVudC52YWx1ZSArICcucHJvdG90eXBlKSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc19zdHIgKz0gJ1xcbicgKyBzcCgpICsgJycgKyBuYW1lICsgJy5wcm90b3R5cGUuY29uc3RydWN0b3IgPSAnICsgbmFtZSArICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lc3BhY2VzLnBvcCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29uc19zdHIgKyBzdHI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBMQU1CREE6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuYW1lLCBucywgc3RyLCBjb2RlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lID0gXCJcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnMgPSBuZXdOcygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihub2RlLmNoaWxkcmVuLmZuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZSA9IG5vZGUuY2hpbGRyZW4uZm4udmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnNbbmFtZV0gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgPSBcImZ1bmN0aW9uIFwiICsgbmFtZSArIFwiKFwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihub2RlLmNoaWxkcmVuLnBhcmFtcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5wYXJhbXMsIG5zKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9ICcpIHsnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgX19rZXlzNiA9IE9iamVjdC5rZXlzKG5zKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yKHZhciBfX2luZGV4NiA9IDA7IF9faW5kZXg2IDwgX19rZXlzNi5sZW5ndGg7IF9faW5kZXg2KyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIga2V5ID0gX19rZXlzNltfX2luZGV4Nl07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gbnNbX19rZXlzNltfX2luZGV4Nl1dO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHZhbHVlICE9PSB0cnVlICYmIHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgPSBnZW5lcmF0ZUNvZGUodmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyAnaWYoJyArIGtleSArICcgPT09IHVuZGVmaW5lZCkgeycgKyBrZXkgKyAnID0gJyArIGNvZGUgKyAnfSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihub2RlLmNoaWxkcmVuLmJsb2NrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9ICcgcmV0dXJuICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5ibG9jaywgbnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lc3BhY2VzLnBvcCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3RyICsgXCI7IH1cIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIEZVTkNfREVGOiBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmFtZSwgbnMsIGlzX2RvbSwgc3RyLCBjb2RlLCBib2R5LCBob2lzdGVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lID0gXCJcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnMgPSBjdXJyZW50TnMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNfZG9tID0gbm9kZS5jaGlsZHJlbi5mZC52YWx1ZSA9PT0gJ2RvbSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKG5vZGUuY2hpbGRyZW4uZm4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lID0gbm9kZS5jaGlsZHJlbi5mbi52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuc1tuYW1lXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5zID0gbmV3TnMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyID0gXCJmdW5jdGlvbiBcIiArIG5hbWUgKyBcIihcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYobm9kZS5jaGlsZHJlbi5wYXJhbXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ucGFyYW1zKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9ICcpIHsnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgX19rZXlzNyA9IE9iamVjdC5rZXlzKG5zKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yKHZhciBfX2luZGV4NyA9IDA7IF9faW5kZXg3IDwgX19rZXlzNy5sZW5ndGg7IF9faW5kZXg3KyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIga2V5ID0gX19rZXlzN1tfX2luZGV4N107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gbnNbX19rZXlzN1tfX2luZGV4N11dO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHZhbHVlICE9PSB0cnVlICYmIHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUgPSBnZW5lcmF0ZUNvZGUodmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyAnaWYoJyArIGtleSArICcgPT09IHVuZGVmaW5lZCkgeycgKyBrZXkgKyAnID0gJyArIGNvZGUgKyAnO30nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9keSA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihub2RlLmNoaWxkcmVuLmJsb2NrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9keSA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmJsb2NrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoaXNfZG9tKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyAndmFyICcgKyBDTigpICsgJyA9IFtdOyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhvaXN0ZWQgPSBnZW5lcmF0ZUhvaXN0ZWRWYXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoaG9pc3RlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ciArPSAnXFxuJyArIHNwKDEpICsgaG9pc3RlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9IGJvZHk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lc3BhY2VzLnBvcCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoaXNfZG9tKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9ICdcXG4nICsgc3AoMSkgKyAncmV0dXJuICcgKyBDTigpICsgJzsnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3RyICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgRlVOQ19ERUZfUEFSQU1TOiBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3RyLCBucztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyID0gXCJcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnMgPSBjdXJyZW50TnMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYobm9kZS5jaGlsZHJlblswXS50eXBlID09PSAnbmFtZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuc1tub2RlLmNoaWxkcmVuWzBdLnZhbHVlXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYobm9kZS5jaGlsZHJlblsxXSAmJiBub2RlLmNoaWxkcmVuWzFdLnR5cGUgPT09ICdhc3NpZ24nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuc1tub2RlLmNoaWxkcmVuWzBdLnZhbHVlXSA9IG5vZGUuY2hpbGRyZW5bMl07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgX19rZXlzOCA9IE9iamVjdC5rZXlzKG5vZGUuY2hpbGRyZW4pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IodmFyIF9faW5kZXg4ID0gMDsgX19pbmRleDggPCBfX2tleXM4Lmxlbmd0aDsgX19pbmRleDgrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuID0gbm9kZS5jaGlsZHJlbltfX2tleXM4W19faW5kZXg4XV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYobi50eXBlID09PSAnbmFtZScgfHwgbi50eXBlID09PSAnRlVOQ19ERUZfUEFSQU1TJyB8fCBuLnR5cGUgPT09ICdjb21tYScgfHwgbi50eXBlID09PSAnd2luZG93Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShuKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzdHI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBBU1NJR046IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzdHIsIG9wLCBleHBsaWNpdF9nbG9iYWwsIG5zLCBsZWZ0LCByaWdodF9jb2RlLCB1bnBhY2tfbmFtZSwgaSwgbiwgbWVtYmVycywgbmFtZSwgdmFsdWUsIGNoO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgPSBcIlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcCA9IG5vZGUuY2hpbGRyZW4ub3AudmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4cGxpY2l0X2dsb2JhbCA9IG9wID09PSAnOj0nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihleHBsaWNpdF9nbG9iYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcCA9ICc9JztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnMgPSBjdXJyZW50TnMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGVmdCA9IG5vZGUuY2hpbGRyZW4ubGVmdDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmlnaHRfY29kZSA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnJpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFzc2lnbmVtZW50IHVucGFja2luZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihsZWZ0LnR5cGUgPT09ICdTVFJJQ1RfQ09NTUFfU0VQQVJBVEVEX0VYUFInKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5wYWNraW5nKys7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5wYWNrX25hbWUgPSAnJyArIHByZWZpeCArICd1bnBhY2snICsgdW5wYWNraW5nICsgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9ICd2YXIgJyArIHVucGFja19uYW1lICsgJyA9ICcgKyByaWdodF9jb2RlICsgJztcXG4nICsgc3AoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgX19rZXlzOSA9IE9iamVjdC5rZXlzKGxlZnQuY2hpbGRyZW4pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvcih2YXIgX19pbmRleDkgPSAwOyBfX2luZGV4OSA8IF9fa2V5czkubGVuZ3RoOyBfX2luZGV4OSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2hpbGQgPSBsZWZ0LmNoaWxkcmVuW19fa2V5czlbX19pbmRleDldXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG4gPSBjaGlsZC5jaGlsZHJlblswXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKG4udHlwZSA9PT0gJ25hbWUnICYmIGNoaWxkLmNoaWxkcmVuLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBob2lzdFZhcihuLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoY2hpbGQpICsgJyAnICsgb3AgKyAnICcgKyB1bnBhY2tfbmFtZSArICdbJyArIGkgKyAnXSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihpIDwgbGVmdC5jaGlsZHJlbi5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ciArPSAnO1xcbicgKyBzcCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3RyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhc3NpZ25lbWVudCBtYXBwaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGxlZnQudHlwZSA9PT0gJ09CSkVDVCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bnBhY2tpbmcrKztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bnBhY2tfbmFtZSA9ICcnICsgcHJlZml4ICsgJ3VucGFjaycgKyB1bnBhY2tpbmcgKyAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgKz0gJ3ZhciAnICsgdW5wYWNrX25hbWUgKyAnID0gJyArIHJpZ2h0X2NvZGUgKyAnO1xcbicgKyBzcCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGkgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbWJlcnMgPSBsZWZ0LmNoaWxkcmVuWzFdLmNoaWxkcmVuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBfX2tleXMxMCA9IE9iamVjdC5rZXlzKG1lbWJlcnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvcih2YXIgX19pbmRleDEwID0gMDsgX19pbmRleDEwIDwgX19rZXlzMTAubGVuZ3RoOyBfX2luZGV4MTArKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1lbWJlciA9IG1lbWJlcnNbX19rZXlzMTBbX19pbmRleDEwXV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lID0gZ2VuZXJhdGVDb2RlKG1lbWJlci5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlID0gZ2VuZXJhdGVDb2RlKG1lbWJlci52YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgKz0gXCJcIiArIHZhbHVlICsgXCIuXCIgKyBuYW1lICsgXCIgPSBcIiArIHVucGFja19uYW1lICsgXCIuXCIgKyBuYW1lICsgXCJcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGkgPCBtZW1iZXJzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9ICc7XFxuJyArIHNwKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpKys7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzdHI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihsZWZ0LmNoaWxkcmVuWzBdLnR5cGUgPT09ICduYW1lJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoID0gbGVmdC5jaGlsZHJlblswXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZighY3VycmVudE5zSGFzKGNoLnZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoIWV4cGxpY2l0X2dsb2JhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBob2lzdFZhcihjaC52YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4ubGVmdCkgKyAnICcgKyBvcCArICcgJyArIHJpZ2h0X2NvZGU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBTVEFURU1FTlQ6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzdHIsIGUsIHQsIG90aGVyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgPSAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIF9fa2V5czExID0gT2JqZWN0LmtleXMobm9kZS5jaGlsZHJlbik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvcih2YXIgX19pbmRleDExID0gMDsgX19pbmRleDExIDwgX19rZXlzMTEubGVuZ3RoOyBfX2luZGV4MTErKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX19rZXlzMTFbX19pbmRleDExXV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZSA9IGNoaWxkLmNoaWxkcmVuICYmIGNoaWxkLmNoaWxkcmVuWzBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IHRoaXMgc2hvdWxkIGJlIHBvc3NpYmxlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdCA9IGNoaWxkLnR5cGU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShjaGlsZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3RoZXIgPSBlICYmIChlLnR5cGUgPT09ICdGVU5DX0RFRicgfHwgZS50eXBlID09PSAnTEFNQkRBJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYodCA9PT0gJ0ZPUicgfHwgdCA9PT0gJ1RSWV9DQVRDSCcgfHwgdCA9PT0gJ1dISUxFJyB8fCB0ID09PSAnSUYnIHx8IHQgPT09ICdTVEFURU1FTlQnIHx8IHQgPT09ICdzYW1lZGVudCcgfHwgb3RoZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgKz0gJzsnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN0cjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIElGOiBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3RyLCBlbGlmO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgPSAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyID0gJ2lmKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcpIHsnICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uYikgKyAnXFxuJyArIHNwKCkgKyAnfSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsaWYgPSBub2RlLmNoaWxkcmVuLmVsaWY7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGVsaWYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihBcnJheS5pc0FycmF5KGVsaWYpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgX19rZXlzMTIgPSBPYmplY3Qua2V5cyhlbGlmKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvcih2YXIgX19pbmRleDEyID0gMDsgX19pbmRleDEyIDwgX19rZXlzMTIubGVuZ3RoOyBfX2luZGV4MTIrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsdWUgPSBlbGlmW19fa2V5czEyW19faW5kZXgxMl1dO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShlbGlmKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKG5vZGUuY2hpbGRyZW4uZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgKz0gZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3RyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgSUZfRVhQUjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHN0cjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyID0gJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ciA9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLnRlc3QpICsgJyA/ICcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcgOiAnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihub2RlLmNoaWxkcmVuLmVsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmVsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgKz0gJ3VuZGVmaW5lZCc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzdHI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LCBFTFNFX0VYUFI6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIFdISUxFOiBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ3doaWxlKCcgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lKSArICcpeycgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iKSArICdcXG4nICsgc3AoKSArICd9JztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIEZPUjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGtleUluZGV4TmFtZSwga2V5QXJyYXlOYW1lLCBhcnJheU5hbWUsIHZhck5hbWUsIGluZGV4TmFtZSwgc3RyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXlJbmRleE5hbWUgPSBwcmVmaXggKyBcImluZGV4XCIgKyBmb3JMb29wQ291bnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleUFycmF5TmFtZSA9IHByZWZpeCArIFwia2V5c1wiICsgZm9yTG9vcENvdW50O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcnJheU5hbWUgPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5hKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyTmFtZSA9IG5vZGUuY2hpbGRyZW4udi52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yTG9vcENvdW50Kys7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4TmFtZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihub2RlLmNoaWxkcmVuLmspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleE5hbWUgPSBub2RlLmNoaWxkcmVuLmsudmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ciA9ICd2YXIgJyArIGtleUFycmF5TmFtZSArICcgPSBPYmplY3Qua2V5cygnICsgYXJyYXlOYW1lICsgJyk7XFxuJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9IHNwKCkgKyAnZm9yKHZhciAnICsga2V5SW5kZXhOYW1lICsgJyA9IDA7ICcgKyBrZXlJbmRleE5hbWUgKyAnIDwgJyArIGtleUFycmF5TmFtZSArICcubGVuZ3RoOyAnICsga2V5SW5kZXhOYW1lICsgJysrKSB7XFxuJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoaW5kZXhOYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9IHNwKDEpICsgJ3ZhciAnICsgaW5kZXhOYW1lICsgJyA9ICcgKyBrZXlBcnJheU5hbWUgKyAnWycgKyBrZXlJbmRleE5hbWUgKyAnXTtcXG4nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgKz0gc3AoMSkgKyAndmFyICcgKyB2YXJOYW1lICsgJyA9ICcgKyBhcnJheU5hbWUgKyAnWycgKyBrZXlBcnJheU5hbWUgKyAnWycgKyBrZXlJbmRleE5hbWUgKyAnXV07JztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3RyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgRUxTRV9JRjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICcgZWxzZSBpZignICsgZ2VuZXJhdGVDb2RlKG5vZGUuY2hpbGRyZW4uZSkgKyAnKSB7JyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgRUxTRTogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICcgZWxzZSB7JyArIGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIpICsgJ1xcbicgKyBzcCgpICsgJ30nO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgVFJZX0NBVENIOiBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgc3RyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgPSBcInRyeSB7XCI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5iMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ciArPSAnXFxuJyArIHNwKCkgKyBcIn0gY2F0Y2goXCIgKyBnZW5lcmF0ZUNvZGUobm9kZS5jaGlsZHJlbi5lcnIpICsgXCIpIHtcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyICs9IGdlbmVyYXRlQ29kZShub2RlLmNoaWxkcmVuLmIyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN0ciArICdcXG4nICsgc3AoKSArIFwifVwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgU1RSSUNUX0NPTU1BX1NFUEFSQVRFRF9FWFBSOiBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZWxlbWVudHM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBfX2tleXMxMyA9IE9iamVjdC5rZXlzKG5vZGUuY2hpbGRyZW4pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IodmFyIF9faW5kZXgxMyA9IDA7IF9faW5kZXgxMyA8IF9fa2V5czEzLmxlbmd0aDsgX19pbmRleDEzKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2hpbGQgPSBub2RlLmNoaWxkcmVuW19fa2V5czEzW19faW5kZXgxM11dO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnRzLnB1c2goZ2VuZXJhdGVDb2RlKGNoaWxkKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdbJyArIGVsZW1lbnRzLmpvaW4oXCIsIFwiKSArICddJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIE1FTUJFUlM6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBlbGVtZW50cztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIF9fa2V5czE0ID0gT2JqZWN0LmtleXMobm9kZS5jaGlsZHJlbik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvcih2YXIgX19pbmRleDE0ID0gMDsgX19pbmRleDE0IDwgX19rZXlzMTQubGVuZ3RoOyBfX2luZGV4MTQrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjaGlsZCA9IG5vZGUuY2hpbGRyZW5bX19rZXlzMTRbX19pbmRleDE0XV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudHMucHVzaChnZW5lcmF0ZUNvZGUoY2hpbGQubmFtZSkgKyAnOiAnICsgZ2VuZXJhdGVDb2RlKGNoaWxkLnZhbHVlKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnRzLmpvaW4oXCIsIFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIHN0cmluZzogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHYsIGFzdDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdiA9IG5vZGUudmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHYgPSB2LnJlcGxhY2UoL1xcbi9nLCBcIlxcXFxuXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QgPSBzdHJHcmFtLnBhcnNlKHYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZighYXN0LmNvbXBsZXRlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGFzdC5oaW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2VuZXJhdGVTdHJpbmdDb2RlKGFzdCwgdi5jaGFyQXQoMCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgY29tbWVudDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5vZGUudmFsdWUucmVwbGFjZSgvXiMvZywgXCIvL1wiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIHBheno6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIG5vdDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICchJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGFuZDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICcmJiAnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgb3I6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnfHwgJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIGNvbXBhcmlzb246IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKG5vZGUudmFsdWUgPT09ICc9PScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJz09PSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKG5vZGUudmFsdWUgPT09ICchPScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJyE9PSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBub2RlLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfX07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGdlbmVyYXRlQ29kZShub2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzdHI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKCFub2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZGVidWdnZXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihiYWNrZW5kW25vZGUudHlwZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYmFja2VuZFtub2RlLnR5cGVdKG5vZGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihub2RlLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbm9kZS52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyID0gXCJcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoIW5vZGUuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBfX2tleXMxNSA9IE9iamVjdC5rZXlzKG5vZGUuY2hpbGRyZW4pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IodmFyIF9faW5kZXgxNSA9IDA7IF9faW5kZXgxNSA8IF9fa2V5czE1Lmxlbmd0aDsgX19pbmRleDE1KyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2hpbGQgPSBub2RlLmNoaWxkcmVuW19fa2V5czE1W19faW5kZXgxNV1dO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ciArPSBnZW5lcmF0ZUNvZGUoY2hpbGQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3RyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGdlbmVyYXRlRXhwb3J0cyhrZXlzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzdHI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ciA9ICdcXG5tb2R1bGUuZXhwb3J0cyA9IHsnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXlzID0ga2V5cyB8fCBPYmplY3Qua2V5cyhjdXJyZW50TnMoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBfX2tleXMxNiA9IE9iamVjdC5rZXlzKGtleXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IodmFyIF9faW5kZXgxNiA9IDA7IF9faW5kZXgxNiA8IF9fa2V5czE2Lmxlbmd0aDsgX19pbmRleDE2KyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIga2V5ID0ga2V5c1tfX2tleXMxNltfX2luZGV4MTZdXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHIgKz0gJ1xcbiAgJyArIGtleSArICcgOiAnICsga2V5ICsgJywnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzdHIgKyAnXFxufSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGdlbmVyYXRlTW9kdWxlKGlucHV0LG9wdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFzdCwgb2JqO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNldEdsb2JhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QgPSBncmFtLnBhcnNlKGlucHV0ICsgXCJcXG5cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKCFhc3QuY29tcGxldGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYXN0LmhpbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmogPSB7YXN0OiBhc3QsIGNvZGU6IGdlbmVyYXRlQ29kZShhc3QpLCBuczogY3VycmVudE5zKCl9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdyYW0gPSBlcGVnanMuY29tcGlsZUdyYW1tYXIoZ3JhbW1hckRlZiwgdG9rZW5EZWYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ3JhbW1hcjogZ3JhbSwgc3RyR3JhbW1hcjogc3RyR3JhbSwgZ3JhbW1hckRlZjogZ3JhbW1hckRlZiwgZXBlZ2pzOiBlcGVnanMsIHRva2VuRGVmOiB0b2tlbkRlZiwgZ2VuZXJhdGVNb2R1bGU6IGdlbmVyYXRlTW9kdWxlLCBnZW5lcmF0ZUNvZGU6IGdlbmVyYXRlQ29kZSwgZ2VuZXJhdGVFeHBvcnRzOiBnZW5lcmF0ZUV4cG9ydHN9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIl19
