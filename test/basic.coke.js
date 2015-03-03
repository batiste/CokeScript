var cokescript = require("../dist/cokescript");
var assert = require("assert");
var vm = require("vm");
function gen(source) {
  return cokescript.generateModule(source).code.trim();
};
function exe(js,context) {
  try {
    return vm.runInNewContext(js, context);
  } catch(e) {
    throw "JS error\n" + js + "";
  };
};
describe("CokeScript features test suite", function () {
  it("Simple function", function () {
    var code = gen("def test() 1");
    assert.equal(code, "function test() { return 1; };");
    assert.equal(exe(code), undefined);
    code = gen("def test()\n  1");
    assert.equal(code, "function test() {\n  1;\n};");
    assert.equal(exe(code), undefined);
    code = gen("def test(a=41 + 1)\n  return a\ntest()");
    assert.equal(exe(code), 42);
  }
  );
  it("Function call", function () {
    function test() {
      return 1;
    };
    assert.equal(test(), 1);
  }
  );
  it("Lambda", function () {
    assert.equal((function () { return 1 + 1; })(), 2);
  }
  );
  it("Function addition", function () {
    var code = gen("def test() 1 + 3\ntest()");
    assert.equal(exe(code), 4);
  }
  );
  it("Function params indentation", function () {
    function test(a,b,c,d,e) {
      return a + b + c + d + e;
    };
    assert.equal(test(1,
      2, 3,
      4,
      5),
    15);
  }
  );
  it("String interpolation", function () {
    function test(alpha,beta) {
      return "hello " + alpha + " world " + beta + "";
    };
    assert.equal(test(1, 2), "hello 1 world 2");
    var toto = {tata: 42};
    assert.equal("something " + toto.tata + " something", "something 42 something");
    var code = gen("\"\#{test}\""); // for coverage
    assert.equal(exe(code, {test: 42}), "42");
  }
  );
  it("Return an array", function () {
    function test(a,b,c) {
      if(a === undefined) {a = 1};
      if(c === undefined) {c = "test"};
      return [a, b, c];
    };
    assert.deepEqual(test(undefined, 3), [1, 3, "test"]);
  }
  );
  it("Return an object", function () {
    function test(a,b,c) {
      if(a === undefined) {a = 1};
      if(c === undefined) {c = "test"};
      return {a: a, b: b, c: c};
    };
    test(undefined, 3);
    assert.deepEqual(test(undefined, 3), {a: 1, b: 3, c: "test"});
  }
  );
  it("Multiline string", function () {
    var a = "hello\nhello";
    assert.equal(a, "hello\nhello");
  }
  );
  it("Multiline interpolated string", function () {
    var w = 1;
    var x = 2;
    var y = 3;
    var a = "hello " + w + "\nhello " + x + "\nhello " + y + "";
    assert.equal(a, "hello 1\nhello 2\nhello 3");
  }
  );
  it("If else elseif", function () {
    var code = gen("\nif a == 0\n  1\nelseif a == 10\n  20\nelse\n  42");
    assert.equal(exe(code, {a: 0}), 1);
    assert.equal(exe(code, {a: 10}), 20);
    assert.equal(exe(code, {a: 100}), 42);
  }
  );
  it("For loop", function () {
    var code = gen("for k, v in array\n  array[k] = v * v\narray");
    assert.deepEqual(exe(code, {array: [1, 2, 3]}), [1, 4, 9]);
  }
  );
  it("Class", function () {
    var code = gen("\nclass Test(Array)\n    def constructor(a=10, b)\n        this.a = b\n\nb = Test(1, 20)\nb.a");
    assert.deepEqual(exe(code), 20);
    code = gen("\nclass Test\n\n  def constructor()\n    this.a = 1\n\n  def other()\n    1\n\nb = Test()\nb.a");
    assert.deepEqual(exe(code, {}), 1);
  }
  );
  it("Invalid syntax", function () {
    var t = function test() { return gen("a=1"); };
    assert.throws(t, Error);
  }
  );
  it("Invalid token", function () {
    var t = function test() { return gen("a = 1;"); };
    assert.throws(t, Error);
  }
  );
  it("Comments", function () {
    var code = gen("# nothing\n1 # nothing");
    assert.equal(exe(code, {}), 1);
  }
  );
  it("Array syntax on several lines", function () {
    var code = gen("[1, 2, 3]");
    assert.deepEqual(exe(code), [1, 2, 3]);
    code = gen("[\n  1,\n  2,\n  3\n]");
    assert.deepEqual(exe(code), [1, 2, 3]);
  }
  );
  it("DOM gen", function () {
    var code = gen("dom makeDom(list)\n      for item in list\n        <input enabled>\n        <li className=\"cls\#{item}\" dummy=\"1\">\n          =item");
  }
  );
  it("DOM", function () {
    function h(n,p,c) { return {n: n, p: p, c: c}; };
    function makeDom(list) {
      var __c1 = [];
      var _keys1 = Object.keys(list);
      for(var _index1 = 0; _index1 < _keys1.length; _index1++ ) {
        var item = list[_keys1[_index1]];
        var __c2 = [];
          __c2.push(String(item));
          __c1.push(h("li", {className:"cls" + item + ""}, __c2));
      };
      return __c1;
    };
    assert.deepEqual(makeDom([1, 2, 3])[0], 
      {
        n: "li",
        c: ["1"], 
        p: {className: "cls1"}
      }
    );
  }
  );
  it("Function call accept function def", function () {
    var code = gen("\ntest(1, def toto()\n  return 42\n, 1)");
    var context = {test: function (a,b,c) { return b(); }};
    assert.equal(exe(code, context), 42);
  }
  );
  it("Object function def", function () {
    var code = gen("\na = {a: def test()\n  return 42\n}\na.a()");
    assert.equal(exe(code), 42);
    code = gen("\na = {\n  a: def test()\n    return 43\n}\na.a()");
    assert.equal(exe(code), 43);
    code = gen("\na = {\n    a: def test()\n      return 44\n    , c: 1\n}\na.a()");
    assert.equal(exe(code), 44);
  }
  );
  it("Array and whitespace", function () {
    var a = [
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
    var o = {
      a: 1, b: 2,
      c: 5
    };
    o = {c: 2,
      a: 1, b: 2,
    c: 5};
  }
  );
  it("While loop", function () {
    var n = 5;
    while(n > 0){
      n = n - 1;
    };
    assert.equal(n, 0);
  }
  );
  it("For loop", function () {
    var array = [1, 2, 3];
    var array2 = [];
    var _keys2 = Object.keys(array);
    for(var _index2 = 0; _index2 < _keys2.length; _index2++ ) {
      var index = _keys2[_index2];
      var value = array[_keys2[_index2]];
      array2[index] = value * value;
    };
    assert.deepEqual(array2, [1, 4, 9]);
  }
  );
  it("Try catch", function () {
    var code = gen("\ntry\n  wrong()\ncatch(e)\n  42");
    assert.equal(exe(code), 42);
  }
  );
  it("Strict comparison", function () {
    var code = gen("23 == \"23\"");
    assert.equal(exe(code, {}), false);
    code = gen("23 == 23");
    assert.equal(exe(code, {}), true);
    code = gen("23 != \"23\"");
    assert.equal(exe(code, {}), true);
  }
  );
  it("Regular expression", function () {
    var code = gen("\"abc\".match(/abc/)");
    assert.equal(exe(code, {})[0], "abc");
    code = gen("\"a\/bc\".match(/a\\\/bc/)");
    assert.equal(exe(code, {})[0], "a\/bc");
  }
  );
  it("If expression", function () {
    var code = gen("2 if 1 else 3");
    assert.equal(exe(code), 2);
    code = gen("2 if 0 else 3");
    assert.equal(exe(code), 3);
    code = gen("a = 2 if 0 else 3\na");
    assert.equal(exe(code), 3);
  }
  );
}
);
