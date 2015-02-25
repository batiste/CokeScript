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
    throw "JS error\n" + js;
  };
};

describe("CokeScript features test suite", function () {
  
  it("Simple function", function () {
    var code = gen("def test() 1");
    assert.equal(code, "function test() { return 1; };");
    assert.equal(exe(code), undefined);
  }
  );
  
  it("Function call", function () {
    var code = gen("\ndef test() 1\ntest()");
    assert.equal(exe(code), 1);
  }
  );
  
  it("Function addition", function () {
    var code = gen("def test() 1 + 3\ntest()");
    assert.equal(exe(code), 4);
  }
  );
  
  it("String interpolation", function () {
    function test(alpha,beta) {
      return "hello " + alpha + " world " + beta + "";
    };
    assert.equal(test(1, 2), "hello 1 world 2");
    var toto = {tata: 42};
    assert.equal("something " + toto.tata + " something", "something 42 something");
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
    function test_if(a) {
      if(a === 0){
        return 1;
      } else if(a === 10) {
        return 20;
      } else {
        return 42;
      };
    };
    assert.equal(test_if(0), 1);
    assert.equal(test_if(10), 20);
    assert.equal(test_if(20), 42);
  }
  );
  
  it("For loop", function () {
    var code = gen("for k, v in array\n  array[k] = v * v\narray");
    assert.deepEqual(exe(code, {array: [1, 2, 3]}), [1, 4, 9]);
  }
  );
  
  it("Class", function () {
    var code = gen("class Test\n  def constructor()\n    this.a = 1\nb = Test()\nb.a");
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
    var code = gen("# nothing\n// nop\n1");
    assert.equal(exe(code, {}), 1, code);
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
    assert.deepEqual(makeDom([1, 2, 3])[0], {n: "li", c: ["1"], p: {className: "cls1"}});
  }
  );
  
  it("Function call accept function def", function () {
    var code = gen("\ntest(1, def toto()\n  return 42\n, 1)");
    var context = {test: function (a,b,c) { return b(); }};
    assert.equal(exe(code, context), 42);
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
}
);

