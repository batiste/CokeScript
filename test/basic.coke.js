var cokescript, assert, vm;
cokescript = require("../dist/cokescript");
assert = require("assert");
vm = require("vm");

function gen(source) {
  return cokescript.generateModule(source).code.trim();
}

function exe(js,context) {
  try {
    return vm.runInNewContext(js, context);
  } catch(e) {
    throw "JS error\n" + js + "";
  }
}

describe("CokeScript features test suite", function () {
  it("Lambda function", function () {
    var code;
    code = gen("def test() 1");
    assert.equal(code, "function test() { return 1; }");
    assert.equal(exe(code), undefined);
    
    code = gen("def test(a=41 + 1)\n  return a\ntest()");
    assert.equal(exe(code), 42);
    
    code = gen("def test() a = 1");
    assert.equal(code, "function test() { return a = 1; }");
  }
  );
  
  it("If doesn't have ;", function () {
    var code;
    code = gen("\nif 1\n  1");
    assert.equal(code, "if(1) {\n  1;\n}");
  }
  );
  
  it("Normal function", function () {
    var code;
    code = gen("def test()\n  1");
    assert.equal(code, "function test() {\n  1;\n}");
    assert.equal(exe(code), undefined);
  }
  );
  
  it("Function pass", function () {
    var code;
    code = gen("def test()\n  pass");
    assert.equal(code, "function test() {\n  \n}");
  }
  );
  
  it("Function pass", function () {
    function test() {
      
    }
    assert.equal(test(), undefined);
  }
  );
  
  it("Lambda", function () {
    assert.equal((function () { return 1 + 1; })(), 2);
  }
  );
  
  it("Function addition", function () {
    var code;
    code = gen("def test() 1 + 3\ntest()");
    assert.equal(exe(code), 4);
  }
  );
  
  it("Function params indentation", function () {
    function test(a,b,c,d,e) {
      return a + b + c + d + e;
    }
    
    assert.equal(test(1,
      2, 3,
      4,
      5),
    15);
  }
  );
  
  it("String interpolation", function () {
    var toto, code;
    function test(alpha,beta) {
      return "hello " + alpha + " world " + beta + "";
    }
    assert.equal(test(1, 2), "hello 1 world 2");
    toto = {tata: 42};
    assert.equal("something " + toto.tata + " something", "something 42 something");
    
    code = gen("\"\#{test}\""); // for coverage
    assert.equal(exe(code, {test: 42}), "42");
  }
  );
  
  it("Return an array", function () {
    function test(a,b,c) {
      if(a === undefined) {a = 1;}
      if(c === undefined) {c = "test";}
      return [a, b, c];
    }
    assert.deepEqual(test(undefined, 3), [1, 3, "test"]);
  }
  );
  
  it("Return an object", function () {
    function test(a,b,c) {
      if(a === undefined) {a = 1;}
      if(c === undefined) {c = "test";}
      return {a: a, b: b, c: c};
    }
    test(undefined, 3);
    assert.deepEqual(test(undefined, 3), {a: 1, b: 3, c: "test"});
  }
  );
  
  it("Multiline string", function () {
    var a;
    a = "hello\nhello";
    assert.equal(a, "hello\nhello");
  }
  );
  
  it("single quoted string", function () {
    var a;
    a = 'hello hello';
    assert.equal(a, "hello hello");
  }
  );
  
  it("not expression", function () {
    var code;
    code = gen("not false");
    assert.equal(exe(code), true, code);
  }
  );
  
  it("Multiline interpolated string", function () {
    var w, x, y, a;
    w = 1;
    x = 2;
    y = 3;
    a = "hello " + w + "\nhello " + x + "\nhello " + y + "";
    assert.equal(a, "hello 1\nhello 2\nhello 3");
  }
  );
  
  it("If else elseif", function () {
    var code;
    code = gen("\nif a == 0\n  1\nelseif a == 10\n  20\nelse\n  42");
    assert.equal(exe(code, {a: 0}), 1);
    assert.equal(exe(code, {a: 10}), 20);
    assert.equal(exe(code, {a: 100}), 42);
  }
  );
  
  it("For loop", function () {
    var code;
    code = gen("for k, v in array\n  array[k] = v * v\narray");
    assert.deepEqual(exe(code, {array: [1, 2, 3]}), [1, 4, 9]);
  }
  );
  
  it("For loop accept expression", function () {
    var code;
    code = gen("acc = 0\nfor k, v in [1, 3, 4]\n  acc += v\nacc");
    assert.deepEqual(exe(code, {acc: 0}), 8);
  }
  );
  
  it("Class", function () {
    var code;
    code = gen("\nclass Test(Array)\n    def constructor(a=10, b)\n        this.a = b\n\nb = Test(1, 20)\nb.a");
    assert.deepEqual(exe(code), 20);
    
    code = gen("\nclass Test\n\n  def constructor()\n    this.a = 1\n\n  def other()\n    1\n\nb = Test()\nb.a");
    assert.deepEqual(exe(code, {}), 1);
  }
  );
  
  it("Invalid syntax", function () {
    var t;
    t = function test() { return gen("a=1"); };
    assert.throws(t, Error);
  }
  );
  
  it("Invalid token", function () {
    var t;
    t = function test() { return gen("a = 1;"); };
    assert.throws(t, Error);
  }
  );
  
  it("Comments", function () {
    var code;
    code = gen("# nothing\n1 # nothing");
    assert.equal(exe(code, {}), 1);
  }
  );
  
  it("Comment samedent", function () {
    var code;
    code = gen("1\n# nothing");
    assert.equal(code, "1;\n// nothing");
  }
  );
  
  it("Comments", function () {
    var code;
    code = gen("# nothing\n# nothing 2");
    assert.equal(code, "// nothing\n// nothing 2");
  }
  );
  
  it("Empty lines", function () {
    var code;
    code = gen("1\n\n2");
    assert.equal(code, "1;\n\n2;");
  }
  );
  
  it("Array syntax on several lines", function () {
    var code;
    code = gen("[1, 2, 3]");
    assert.deepEqual(exe(code), [1, 2, 3]);
    code = gen("[\n  1,\n  2,\n  3\n]");
    assert.deepEqual(exe(code), [1, 2, 3]);
  }
  );
  
  it("DOM gen", function () {
    var code;
    code = gen("dom makeDom(list)\n      for item in list\n        <input enabled>\n        <li className=\"cls\#{item}\" data-dummy=\"1\">\n          =item");
  }
  
  );
  
  it("DOM", function () {
    var virtualDom, first_li;
    virtualDom = {h: function h(n,p,c) { return {n: n, p: p, c: c}; }};
    function makeDom(list) {
      var __c1 = [];
      var __index1, __keys1, item, __c2, __tmp;
      __keys1 = Object.keys(list);
      for(__index1 = 0; __index1 < __keys1.length; __index1++) {
        item = list[__keys1[__index1]];
        __c2 = [];
          __tmp = item; __tmp instanceof Array ? (__c2 = __c2.concat(__tmp)) : __c2.push(String(__tmp));
        __c1.push(cokescript.h("li", {"className": "cls" + item + "", "data-dummy": "1"}, __c2));
      }
      return __c1;
    }
    first_li = makeDom([1, 2, 3])[0];
    assert.equal(first_li.tagName, 'LI');
    assert.deepEqual(first_li.children, [{text: '1' }]);
    assert.deepEqual(first_li.properties.attributes.className, "cls1");
    assert.deepEqual(first_li.properties.attributes['data-dummy'], '1');
  }
  );
  
  it("Function call accept function def", function () {
    var code, context;
    code = gen("\ntest(1, def toto()\n  return 42\n, 1)");
    context = {test: function (a,b,c) { return b(); }};
    assert.equal(exe(code, context), 42);
  }
  );
  
  it("Object function def 1", function () {
    var code;
    code = gen("\na = {a: def test()\n  return 42\n}\na.a()");
    assert.equal(exe(code), 42);
  }
  );
  
  it("Object function def 2", function () {
    var code;
    code = gen("\na = {\n  a: def test()\n    return 43\n}\na.a()");
    assert.equal(exe(code), 43);
  }
  );
  
  it("Object function def 3", function () {
    var code;
    code = gen("\na = {\n    a: def test()\n      return 44\n    , c: 1\n}\na.a()");
    assert.equal(exe(code), 44);
  }
  );
  
  it("Array and whitespace", function () {
    var a;
    a = [
      1, 2,
      5
    ];
    assert.deepEqual(a, [1, 2, 5]);
    a = [
      1
    ];
    assert.deepEqual(a, [1]);
    a = [1,
      2, 3,
    4];
    assert.deepEqual(a, [1, 2, 3, 4]);
    a = [1, 3,
      2
    ];
    assert.deepEqual(a, [1, 3, 2]);
  }
  );
  
  it("Object and whitspace", function () {
    var o;
    o = {
      a: 1, b: 2, c: 5
    };
    o = {c: 2, a: 1, b: 2, c: 5};
  }
  );
  
  it("While loop", function () {
    var n;
    n = 5;
    while(n > 0){
      n = n - 1;
    }
    assert.equal(n, 0);
  }
  );
  
  it("For loop", function () {
    var array, array2, __index2, __keys2, index, value;
    array = [1, 2, 3];
    array2 = [];
    __keys2 = Object.keys(array);
    for(__index2 = 0; __index2 < __keys2.length; __index2++) {
      index = __keys2[__index2];
      value = array[__keys2[__index2]];
      array2[index] = value * value;
    }
    assert.deepEqual(array2, [1, 4, 9]);
  }
  );
  
  it("Try catch", function () {
    var code;
    code = gen("\ntry\n  wrong()\ncatch(e)\n  42");
    assert.equal(exe(code), 42);
  }
  );
  
  it("Strict comparison", function () {
    var code;
    code = gen("23 == \"23\"");
    assert.equal(exe(code, {}), false);
    code = gen("23 == 23");
    assert.equal(exe(code, {}), true);
    code = gen("23 != \"23\"");
    assert.equal(exe(code, {}), true);
  }
  );
  
  it("Regular expression", function () {
    var code;
    code = gen("\"abc\".match(/abc/)");
    assert.equal(exe(code, {})[0], "abc");
    code = gen("\"a\/bc\".match(/a\\\/bc/)");
    assert.equal(exe(code, {})[0], "a\/bc");
    code = gen("\"Abc\ndef\".match(/abc/mig)");
    assert.equal(exe(code, {})[0], "Abc");
  }
  );
  
  it("If expression", function () {
    var code;
    code = gen("2 if 1 else 3");
    assert.equal(exe(code), 2);
    code = gen("2 if 0 else 3");
    assert.equal(exe(code), 3);
    code = gen("a = 2 if 0 else 3\na");
    assert.equal(exe(code), 3);
    code = gen("a = 2 if 1\na");
    assert.equal(exe(code), 2);
    code = gen("a = 2 if false\na");
    assert.equal(exe(code), undefined);
  }
  );
  
  it("Var hoisting in if", function () {
    var code;
    code = gen("if 1\n a = 1\nelse\n  a = 2");
    assert.equal(code, "var a;\nif(1) {\n  a = 1;\n} else {\n  a = 2;\n}");
  }
  );
  
  it("Var hoisting in function", function () {
    var code;
    code = gen("def test()\n  if 1\n    a = 1\n  else\n    a = 2");
    assert.equal(code, "function test() {\n  var a;\n  if(1) {\n    a = 1;\n  } else {\n    a = 2;\n  }\n}");
  }
  );
  
  it("New object", function () {
    var code;
    code = gen("new Number(42)");
    assert.equal(exe(code), 42);
    code = gen("throw new Error(42)");
  }
  );
  
  it("Value unpacking", function () {
    var code;
    code = gen("\na, b, c = [1, 2, 3]\nc");
    assert.equal(exe(code), 3);
  }
  );
  
  it("Assignement unpacking", function () {
    var code;
    code = gen("\na, b, c = 1, 2, 3\nb");
    assert.equal(exe(code), 2);
  }
  );
  
  it("Assignement mapping", function () {
    var code;
    code = gen("\na = {b: 1, c: 2}\nhello = {world: 'a string'}\n{b: a, world: hello} = {b: 'worked', world: 'mapping '}\nhello.world + a.b");
    assert.equal(exe(code), "mapping worked");
  }
  );
  
  it("Return comma separated", function () {
    var code;
    code = gen("\ndef test\n  return 1, 1 + 1, 3\n\na, b, c = test()\na + b + c");
    assert.equal(exe(code), 6);
  }
  );
}

);

