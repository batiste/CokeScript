# CokeScript Language Specification

You can assume CokeScript is JavaScript with a Python like syntax. Some elements from Ruby might appear as well.

## Language basics

### Variable and scoping

Variable are simply declared without type

```python
a = 1
a = 2
def test()
  a = 3
```

Generates

```javascript
var a = 1;
a = 2;
function test() {
  var a = 3;
}
```

CokeScript notion of scope is by function. You can assign explicitly to a higher scope
by using an eplicit assign `:=`.

```python
a = 2
def test()
  a := 3
```

Generates

```javascript
var a = 2;
function test() {
  a = 3;
}
```

### Functions and lambda

All following forms are valid ways to declare functions

```python
a = def
  return 1

def function_name(a, b=1 + 1)
  return a + b

def(a, b=1 + 1)
  return a + b

def lambda_name(a, b) a + b

def(a, b) a + b
```

### Assignement Unpacking

Assignement can unpack positionnal values

```python
def test()
  return 1, 1 + 1, 2

obj = {}
obj.first, obj.toto, other = test()

hello, world = "something", "else"
```

Generates

```javascript
var obj, other, hello, world;
function test() {
  return [1, 1 + 1, 2];
}

obj = {};
var __unpack1 = test();
obj.first = __unpack1[0];
obj.toto = __unpack1[1];
other = __unpack1[2];

var __unpack2 = ["something", "else"];
hello = __unpack2[0];
world = __unpack2[1];
```

### Assignement Mapping

Assignement can map atrtibute to separate objects

```python
great = {}
language = {name: " JavaScript"}

# map attribute greeting to great, and name to language
{greeting: great, name: language} = {greeting: "Hello! ", name: "CoffeScript"}
great.greeting + language.name
```

```javascript
var great, language;
great = {};
language = {name: " JavaScript"};

// map attribute greeting to great, and name to language
var __unpack1 = {greeting: "Hello! ", name: "CoffeScript"};
great.greeting = __unpack1.greeting;
language.name = __unpack1.name;
great.greeting + language.name;
```

### Loops

Both Objects and Arrays are iterable using the same type of loop.

```python
for value in iterable
  console.log(value)

for index, value in iterable
  console.log(index, value)

i = 10
while i > 0
  i--
```

### Conditionnal

```python
if false or 2 < 0
  1
elseif true and 0
  2
else
  3

a = "Elephant" if weight > 1000 else "Mouse"

can_be_tamed = "Yes" if a == "Elephant"
```

### Strings

Strings can be interpolated ruby style

```python
data = {
  h: "Hello",
  w: "world"
}

string = "#{data.d}
#{data.w}"
```

Generates

```javascript
var data;
var string;
data = {
  h: "Hello",
  w: "world"
};

string = "" + data.d + "\n" + data.w + "";
```

### Try / Catch / Throw

Simply mirror JavaScript

```python
try
  something_wrong()
catch(e)
  console.log(e)
  throw new Error("Something else")
```

### Regular expression

Are identical to JavaScript

```python
"Abc".match(/abc/i)
```

### Classes

```python
class Animal()
  
  def constructor(name)
    this.name = name

class Tiger(Animal)

  def eat()
    return "Meat"
```

### Pass

Like python empty blocks are not allowed but you can use the pass keyword.

```python
if 1 == 2
  pass
```

Generates

```javascript
if(1 === 2) {
  
}
```

## Virtual DOM

By adding 2 keywords and a special function declared with `dom` CokeScript
can generate virtual DOM objects using the [virtual-dom library](https://github.com/Matt-Esch/virtual-dom).
This quite useful and be used like [JSX from React](http://facebook.github.io/react/docs/jsx-in-depth.html) to create
HTML components that can be updated with DOM diff.

```python
dom generateVirtualDom(links)
  <ul className="nav">
    for index, content in links
      <li className="cls#{ index }">
        =content
```

Generates

```javascript
function generateVirtualDom(links) {
  var __c1 = [];
  var __c2 = [];
    var _keys1 = Object.keys(links);
    for(var _index1 = 0; _index1 < _keys1.length; _index1++ ) {
      var index = _keys1[_index1];
      var content = links[_keys1[_index1]];
      var __c3 = [];
        __c3.push(String(content));
        __c2.push(h("li", {className:"cls#{ index }"}, __c3));
    };
    __c1.push(h("ul", {className:"nav"}, __c2));
  return __c1;
};
```