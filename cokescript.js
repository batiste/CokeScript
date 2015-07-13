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
    "W or EXPR",
    "W and EXPR",
    "W comparison W EXPR",
    "W > W EXPR",
    "dot EXPR",
    "W instanceof EXPR",
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
    var name, varname, str;
    name = CN();
    varname = generateCode(node.children[1]);
    hoistVar(CN());
    hoistVar('' + prefix + 'tmp');
    str = '' + prefix + 'tmp = ' + varname + '; ' + prefix + 'tmp instanceof Array ? (' + name + ' = ' + name + '.concat(' + prefix + 'tmp)) : ' + name + '.push(String(' + prefix + 'tmp))';
    return str;
  }
  ,
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
  }
  ,
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
  }
  ,
  CLASS: function (node) {
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
    cons_str = '' + name + ' = function ' + name + '(' + params + ') {';
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
    
    var __keys8 = Object.keys(node.children);
    for(var __index8 = 0; __index8 < __keys8.length; __index8++) {
      var n = node.children[__keys8[__index8]];
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
      unpack_name = '' + prefix + 'unpack' + unpacking + '';
      str += 'var ' + unpack_name + ' = ' + right_code + ';\n' + sp();
      i = 0;
      var __keys9 = Object.keys(left.children);
      for(var __index9 = 0; __index9 < __keys9.length; __index9++) {
        var child = left.children[__keys9[__index9]];
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
    var __keys10 = Object.keys(node.children);
    for(var __index10 = 0; __index10 < __keys10.length; __index10++) {
      var child = node.children[__keys10[__index10]];
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
        var __keys11 = Object.keys(elif);
        for(var __index11 = 0; __index11 < __keys11.length; __index11++) {
          var value = elif[__keys11[__index11]];
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
    var __keys12 = Object.keys(node.children);
    for(var __index12 = 0; __index12 < __keys12.length; __index12++) {
      var child = node.children[__keys12[__index12]];
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
  and: function (node) {
    return '&& ';
  }
  ,
  or: function (node) {
    return '|| ';
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
  
  var __keys13 = Object.keys(node.children);
  for(var __index13 = 0; __index13 < __keys13.length; __index13++) {
    var child = node.children[__keys13[__index13]];
    str += generateCode(child);
  }
  
  return str;
}


function generateExports(keys) {
  var str;
  str = '\nmodule.exports = {';
  keys = keys || Object.keys(currentNs());
  var __keys14 = Object.keys(keys);
  for(var __index14 = 0; __index14 < __keys14.length; __index14++) {
    var key = keys[__keys14[__index14]];
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


