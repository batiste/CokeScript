
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
function newNs() {
  namespaces.push({});
  return namespaces[namespaces.length - 1];
}
function resetGlobal() {
  var namespaces = [{}];
  var forLoopCount = 1;
  var levelStack = [0];
  var depth = 0;
  var unpacking = 0;
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
  {key: "number", reg: /^[0-9]+\.?[0-9]*/},
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
  if(last && last.value === "\\"){
    return;
  };
  if(input.match(/^#{/)){
    return "#{";
  };
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
  if(node.type === 'VAR'){
    return c + ' + ' + generateStringCode(node.children[1], c) + ' + ' + c;
  };
  if(node.value !== undefined){
    return node.value;
  };
  var str = '';
  if(!node.children){
    return '';
  };
  var children = node.children;
  var _keys1 = Object.keys(children);
  for(var _index1 = 0; _index1 < _keys1.length; _index1++ ) {
    var child = children[_keys1[_index1]];
    str += generateStringCode(child, c);
  }
  return str;
}
function currentLevel() {
  return levelStack[levelStack.length - 1];
}
function indentType(l) {
  if(l > currentLevel()){
    return 'indent';
  };
  if(l < currentLevel()){
    return 'dedent';
  };
  if(l === currentLevel()){
    return 'samedent';
  };
}
function dent(dentType) {
  return function _dent(input) {
    // empty line is a samedent
    var m = input.match(/^\n[\s]*/);
    if(m){
      var lines = m[0].split("\n");
      var indent = lines[lines.length - 1].length;
      if(indentType(indent) === dentType){
        if(dentType === 'dedent'){
          levelStack.pop();
          return '';
        };
        if(dentType === 'indent'){
          levelStack.push(indent);
        };
        return m[0];
      };
    };
  };
}
function stringDef(input) {
  var first = input.charAt(0);
  if(first === '"' || first === "'"){
    var i = 1;
    while(input.charAt(i)){
      var ch = input.charAt(i);
      if(ch === '\\'){
        i++;
      } else if(ch === first) {
        return input.slice(0, i + 1);
      };
      i++;
    }
  };
}
function regExpDef(input) {
  if(input.charAt(0) === '/'){
    var i = 1;
    while(input.charAt(i)){
      var ch = input.charAt(i);
      if(ch === '\\'){
        i++;
      } else if(ch === '/') {
        i++;;// modifiers
        while(input.charAt(i) && "igm".indexOf(input.charAt(i)) !== -1){
          i++;
        }
        return input.slice(0, i);
      };
      i++;
    }
  };
}
function defDef(input) {
  if(input.match(/^def[\(| |\n]/)){
    return "def";
  };
  if(input.indexOf("dom ") === 0){
    return "dom";
  };
}
function commentDef(input) {
  var m = input.match(/^#/);
  if(m){
    var i = m[0].length;
    while(input.charAt(i)){
      var ch = input.charAt(i);
      if(ch === '\n'){
        return input.slice(0, i);
      };
      i++;
    }
  };
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
  if(mod){
    return spacer(2 * (depth + mod));
  };
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
    var depth = Math.max(0, depth - 1);
    return '';
  }
  ,
  indent: function (node) {
    var depth = depth + 1;
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
    if(node.children.left){
      return generateCode(node.children.left) + ', ' + generateCode(node.children.right);
    };
    if(node.children.e){
      return node.children.n.value + ': ' + generateCode(node.children.e);
    } else {
      return node.children.n.value + ': true';
    };
  }
  ,
  TAG: function (node) {
    var str = '';
    var params = "{";
    var name = node.children.tag.value.substring(1);
    if(node.children.params){
      params += generateCode(node.children.params);
    };
    params += '}';
    var sub = '[]';
    if(node.children.block){
      sub = pushCN();
      str += '' + CN() + ' = []';
      str += generateCode(node.children.block);
      popCN();
    };
    str += '\n' + sp(1) + CN() + '.push(h("' + name + '", ' + params + ', ' + sub + '))';
    return str;
  }
  ,
  CLASS: function (node) {
    var name = node.children.name.value;
    var funcs = node.children.methods;
    var parent = node.children.parent;
    var str = '';
    constructor = null;
    var _keys2 = Object.keys(funcs);
    for(var _index2 = 0; _index2 < _keys2.length; _index2++ ) {
      var func = funcs[_keys2[_index2]];
      var func_def = func.children;
      var func_name = func_def.children.fn.value;
      if(func_name === 'constructor'){
        constructor = func_def;
      } else {
        str += '\n' + sp() + name + '.prototype.' + func_name + ' = ' + generateCode(func_def);
      };
    }
    var ns = currentNs();
    ns[name] = true;
    ns = newNs();
    var params = constructor && constructor.children.params;
    if(params){
      params = generateCode(params);
    } else {
      params = '';
    };
    var body = constructor && constructor.children.block;
    var cons_str = '' + name + ' = function ' + name + '(' + params + ') {';
    cons_str += '\n' + sp(1) + 'if(!(this instanceof ' + name + ')){ return new ' + name + '(' + Object.keys(ns).join(',') + ')}';
    var _keys3 = Object.keys(ns);
    for(var _index3 = 0; _index3 < _keys3.length; _index3++ ) {
      var key = _keys3[_index3];
      var value = ns[_keys3[_index3]];
      if(value !== true && value !== undefined){
        cons_str += '\n' + sp(1) + 'if(' + key + ' === undefined) {' + key + ' = ' + generateCode(value) + '}';
      };
    }
    if(body){
      cons_str += generateCode(body);
    };
    cons_str += sp() + '\n}';
    if(parent){
      cons_str += '\n' + sp() + '' + name + '.prototype = Object.create(' + parent.value + '.prototype)';
      cons_str += '\n' + sp() + '' + name + '.prototype.constructor = ' + name + '';
    };
    namespaces.pop();
    return cons_str + str;
  }
  ,
  LAMBDA: function (node) {
    var name = "";
    var ns = newNs();
    if(node.children.fn){
      name = node.children.fn.value;
      ns[name] = true;
    };
    var str = "function " + name + "(";
    if(node.children.params){
      str += generateCode(node.children.params, ns);
    };
    str += ') {';
    var _keys4 = Object.keys(ns);
    for(var _index4 = 0; _index4 < _keys4.length; _index4++ ) {
      var key = _keys4[_index4];
      var value = ns[_keys4[_index4]];
      if(value !== true && value !== undefined){
        var code = generateCode(value);
        str += '\n' + sp(1) + 'if(' + key + ' === undefined) {' + key + ' = ' + code + '}';
      };
    }
    if(node.children.block){
      str += ' return ' + generateCode(node.children.block, ns);
    };
    namespaces.pop();
    return str + "; }";
  }
  ,
  FUNC_DEF: function (node) {
    var name = "";
    var ns = currentNs();
    var is_dom = node.children.fd.value === 'dom';
    if(node.children.fn){
      name = node.children.fn.value;
      ns[name] = true;
    };
    ns = newNs();
    var str = "function " + name + "(";
    if(node.children.params){
      str += generateCode(node.children.params);
    };
    str += ') {';
    var _keys5 = Object.keys(ns);
    for(var _index5 = 0; _index5 < _keys5.length; _index5++ ) {
      var key = _keys5[_index5];
      var value = ns[_keys5[_index5]];
      if(value !== true && value !== undefined){
        var code = generateCode(value);
        str += '\n' + sp(1) + 'if(' + key + ' === undefined) {' + key + ' = ' + code + ';}';
      };
    }
    if(is_dom){
      str += '\n' + sp(1) + '' + CN() + ' = [];';
    };
    if(node.children.block){
      str += generateCode(node.children.block);
    };
    namespaces.pop();
    if(is_dom){
      str += '\n' + sp(1) + 'return ' + CN() + ';';
    };
    return str + '\n' + sp() + '}';
  }
  ,
  FUNC_DEF_PARAMS: function (node) {
    var str = "";
    var ns = currentNs();
    if(node.children[0].type === 'name'){
      ns[node.children[0].value] = true;
      if(node.children[1] && node.children[1].type === 'assign'){
        ns[node.children[0].value] = node.children[2];
      };
    };;// TODO: fix this
    var children = node.children;
    var _keys6 = Object.keys(children);
    for(var _index6 = 0; _index6 < _keys6.length; _index6++ ) {
      var n = children[_keys6[_index6]];
      if(n.type === 'name' || n.type === 'FUNC_DEF_PARAMS' || n.type === 'comma' || n.type === 'window'){
        str += generateCode(n);
      };
    }
    return str;
  }
  ,
  ASSIGN: function (node) {
    var prefix = "";
    var str = "";
    var op = node.children.op.value;
    var explicit_global = op === ': =';
    if(op === ': ='){
      op = '=';
    };
    var ns = currentNs();
    var left = node.children.left;
    var right_code = generateCode(node.children.right);
    if(left.type === 'STRICT_COMMA_SEPARATED_EXPR'){
      unpacking++;
      var unpack_name = '__unpack' + unpacking;
      str += unpack_name + " = " + right_code + "\n" + sp();
      var children = left.children;
      var i = 0;
      var _keys7 = Object.keys(children);
      for(var _index7 = 0; _index7 < _keys7.length; _index7++ ) {
        var child = children[_keys7[_index7]];
        var n = child.children[0];
        prefix = "";
        if(n.type === 'name'){
          if(ns[n.value] === undefined){
            ns[n.value] = true;
            if(!explicit_global){
              prefix = '';
            };
          };
        };
        str += prefix + generateCode(n) + ' ' + op + ' ' + unpack_name + '[' + i + '];\n' + sp();
        i++;
      }
      return str;
    };
    if(left.children[0].type === 'name'){
      var ch = left.children[0];
      if(ns[ch.value] === undefined){
        if(!explicit_global){
          prefix = '';
        };
        ns[ch.value] = true;
      };
    };
    return prefix + generateCode(node.children.left) + ' ' + op + ' ' + right_code;
  }
  ,
  STATEMENT: function (node) {
    var e = node.children[0].children[0];;// TODO: this should be possible
    if(node.children[0].type === 'FOR' || node.children[0].type === 'TRY_CATCH' || node.children[0].type === 'WHILE' || e && (e.type === 'FUNC_DEF' || e.type === 'LAMBDA')){
      return generateCode(node.children[0]);
    };
    return generateCode(node.children[0]) + '';
  }
  ,
  IF: function (node) {
    var str = '';
    str = 'if(' + generateCode(node.children.e) + '){' + generateCode(node.children.b) + '\n' + sp() + '}';
    var elif = node.children.elif;
    if(elif){
      if(Array.isArray(elif)){
        var _keys8 = Object.keys(elif);
        for(var _index8 = 0; _index8 < _keys8.length; _index8++ ) {
          var value = elif[_keys8[_index8]];
          str += generateCode(value);
        }
      } else {
        str += generateCode(elif);
      };
    };
    if(node.children.el){
      str += generateCode(node.children.el);
    };
    return str;
  }
  ,
  IF_EXPR: function (node) {
    var str = '';
    str = generateCode(node.children.test) + ' ? ' + generateCode(node.children.e) + ' : ';
    if(node.children.el){
      str += generateCode(node.children.el);
    } else {
      str += 'undefined';
    };
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
    if(node.children.k){
      indexName = node.children.k.value;
    };
    var str = '' + keyArrayName + ' = Object.keys(' + node.children.a.value + ')\n';
    str += sp() + 'for(' + keyIndexName + '; ' + keyIndexName + ' = 0; ' + keyIndexName + ' < ' + keyArrayName + '.length; ' + keyIndexName + '++) {\n';
    if(indexName){
      str += sp(1) + '' + indexName + ' = ' + keyArrayName + '[' + keyIndexName + ']\n';
    };
    str += sp(1) + '' + node.children.v.value + ' = ' + node.children.a.value + '[' + keyArrayName + '[' + keyIndexName + ']]';
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
    for(var _index9 = 0; _index9 < _keys9.length; _index9++ ) {
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
    if(!ast.complete){
      throw new Error(ast.hint);
    };
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
    if(node.value === '=='){
      return '===';
    };
    if(node.value === '!='){
      return '!==';
    };
    return node.value;
  }
};
function generateCode(node) {
  if(!node){
    // debugger
  };
  if(backend[node.type]){
    return backend[node.type](node);
  };
  if(node.value !== undefined){
    return node.value;
  };
  var str = "";
  if(!node.children){
    return '';
  };
  var children = node.children;
  var _keys10 = Object.keys(children);
  for(var _index10 = 0; _index10 < _keys10.length; _index10++ ) {
    var child = children[_keys10[_index10]];
    str += generateCode(child);
  }
  return str;
}
function generateExports(keys) {
  var str = '\nmodule.exports = {';
  keys = keys || Object.keys(currentNs());
  var _keys11 = Object.keys(keys);
  for(var _index11 = 0; _index11 < _keys11.length; _index11++ ) {
    var key = keys[_keys11[_index11]];
    str += '\n  ' + key + ': ' + key + ',';
  }
  return str + '\n}';
}
function generateModule(input,opts) {
  resetGlobal();
  var ast = gram.parse(input + "\n");
  if(!ast.complete){
    throw new Error(ast.hint);
  };
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

